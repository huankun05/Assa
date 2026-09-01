using System.Runtime.InteropServices;
using System.Text.Json;

internal sealed class AudioEndpointMonitor : IDisposable
{
    private readonly ManualResetEvent _stopEvent = new(false);
    private readonly AutoResetEvent _rebindEvent = new(false);
    private readonly JsonSerializerOptions _jsonOptions;
    private readonly object _outputLock;
    private readonly EndpointNotificationClient _notificationClient;
    private readonly EndpointVolumeCallback _volumeCallback;

    private IMMDeviceEnumerator? _enumerator;
    private IMMDevice? _endpoint;
    private IAudioEndpointVolume? _endpointVolume;
    private bool _disposed;

    /**
     * @param jsonOptions 事件序列化选项（serve 模式传入，保证与响应同风格）
     * @param outputLock 输出锁（serve 模式传入，使事件与命令响应共用一把锁，避免行交错）
     */
    public AudioEndpointMonitor(JsonSerializerOptions? jsonOptions = null, object? outputLock = null)
    {
        _jsonOptions = jsonOptions ?? new JsonSerializerOptions(JsonSerializerDefaults.Web);
        _outputLock = outputLock ?? new object();
        _notificationClient = new EndpointNotificationClient(_rebindEvent);
        _volumeCallback = new EndpointVolumeCallback(EmitVolumeChanged);
    }

    /**
     * 运行监控主循环（阻塞）。
     * @param commandEvent 外部命令到达信号（serve 模式），触发时在主线程回调 onCommand
     * @param onCommand    命令处理回调（保证所有 COM 调用都在主线程执行）
     */
    public void Run(WaitHandle? commandEvent = null, Action? onCommand = null)
    {
        try
        {
            _enumerator = CoreAudioFactory.CreateDeviceEnumerator();
            _enumerator.RegisterEndpointNotificationCallback(_notificationClient);
            RebindDefaultEndpoint();

            var waitHandles = commandEvent is null
                ? new WaitHandle[] { _stopEvent, _rebindEvent }
                : new WaitHandle[] { _stopEvent, _rebindEvent, commandEvent };
            while (true)
            {
                var signaled = WaitHandle.WaitAny(waitHandles);
                if (signaled == 0)
                {
                    break;
                }

                if (signaled == 1)
                {
                    RebindDefaultEndpoint();
                    continue;
                }

                onCommand?.Invoke();
            }
        }
        catch (Exception exception)
        {
            EmitError(exception.Message);
        }
        finally
        {
            Dispose();
        }
    }

    public void Stop()
    {
        _stopEvent.Set();
    }

    public void Dispose()
    {
        if (_disposed)
        {
            return;
        }

        _disposed = true;
        ReleaseEndpoint();

        if (_enumerator is not null)
        {
            try
            {
                _enumerator.UnregisterEndpointNotificationCallback(_notificationClient);
            }
            catch
            {
                // The endpoint service may already be shutting down.
            }

            Marshal.FinalReleaseComObject(_enumerator);
            _enumerator = null;
        }

        _stopEvent.Dispose();
        _rebindEvent.Dispose();
    }

    private void RebindDefaultEndpoint()
    {
        ReleaseEndpoint();

        try
        {
            _endpointVolume = AudioEndpointController.CreateDefaultEndpointVolume(out var endpoint);
            _endpoint = endpoint;
            _endpointVolume.RegisterControlChangeNotify(_volumeCallback);
            _endpointVolume.GetMasterVolumeLevelScalar(out var level);
            EmitVolumeChanged(AudioEndpointController.NormalizeVolume(level));
        }
        catch (Exception exception)
        {
            ReleaseEndpoint();
            EmitError(exception.Message);
        }
    }

    private void ReleaseEndpoint()
    {
        if (_endpointVolume is not null)
        {
            try
            {
                _endpointVolume.UnregisterControlChangeNotify(_volumeCallback);
            }
            catch
            {
                // The endpoint may disappear while the default device changes.
            }

            Marshal.FinalReleaseComObject(_endpointVolume);
            _endpointVolume = null;
        }

        if (_endpoint is not null)
        {
            Marshal.FinalReleaseComObject(_endpoint);
            _endpoint = null;
        }
    }

    private void EmitVolumeChanged(int level)
    {
        Emit(new
        {
            @event = "volume-changed",
            eventName = "volume-changed",
            level,
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
    }

    private void EmitError(string message)
    {
        Emit(new
        {
            @event = "error",
            eventName = "error",
            message,
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        });
    }

    private void Emit(object payload)
    {
        lock (_outputLock)
        {
            Console.WriteLine(JsonSerializer.Serialize(payload, _jsonOptions));
            Console.Out.Flush();
        }
    }

    [ComVisible(true)]
    [ClassInterface(ClassInterfaceType.None)]
    private sealed class EndpointVolumeCallback(Action<int> onVolumeChanged) : IAudioEndpointVolumeCallback
    {
        public int OnNotify(IntPtr notificationData)
        {
            if (notificationData == IntPtr.Zero)
            {
                return 0;
            }

            var data = Marshal.PtrToStructure<AudioVolumeNotificationData>(notificationData);
            onVolumeChanged(AudioEndpointController.NormalizeVolume(data.MasterVolume));
            return 0;
        }
    }

    [ComVisible(true)]
    [ClassInterface(ClassInterfaceType.None)]
    private sealed class EndpointNotificationClient(AutoResetEvent rebindEvent) : IMMNotificationClient
    {
        public int OnDeviceStateChanged(string deviceId, uint newState) => 0;
        public int OnDeviceAdded(string deviceId) => 0;
        public int OnDeviceRemoved(string deviceId) => 0;
        public int OnPropertyValueChanged(string deviceId, PropertyKey key) => 0;

        public int OnDefaultDeviceChanged(EDataFlow flow, ERole role, string? defaultDeviceId)
        {
            if (flow == EDataFlow.Render && role == ERole.Multimedia)
            {
                rebindEvent.Set();
            }

            return 0;
        }
    }
}