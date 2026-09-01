using System.Collections.Concurrent;
using System.Management;
using System.Text.Json;
using System.Text.Json.Serialization;

var command = args.FirstOrDefault() ?? "get";
var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);

try
{
    switch (command)
    {
        case "get":
            Console.WriteLine(JsonSerializer.Serialize(BrightnessHelper.GetBrightness(), jsonOptions));
            break;
        case "set" when args.Length > 1 && byte.TryParse(args[1], out var brightness):
            Console.WriteLine(JsonSerializer.Serialize(BrightnessHelper.SetBrightness(brightness), jsonOptions));
            break;
        case "set":
            Console.WriteLine(JsonSerializer.Serialize(new { success = false, error = "Missing or invalid brightness value" }, jsonOptions));
            break;
        case "monitor":
            BrightnessHelper.Monitor();
            break;
        case "serve":
            BrightnessHelper.Serve(jsonOptions);
            break;
        default:
            Console.WriteLine(JsonSerializer.Serialize(new { error = $"Unknown command: {command}" }, jsonOptions));
            break;
    }
}
catch (Exception ex)
{
    Console.WriteLine(JsonSerializer.Serialize(new { error = ex.Message }, jsonOptions));
}

static class BrightnessHelper
{
    public static object? GetBrightness()
    {
        var wmiSnapshot = WmiBrightnessController.GetBrightness();
        if (wmiSnapshot is not null)
        {
            return new
            {
                currentBrightness = wmiSnapshot.CurrentBrightness,
                levels = wmiSnapshot.Levels,
                instanceName = wmiSnapshot.InstanceName,
                source = "wmi"
            };
        }

        var ddcCiSnapshot = DdcCiBrightnessController.GetBrightness();
        if (ddcCiSnapshot is null)
        {
            return null;
        }

        return new
        {
            currentBrightness = ddcCiSnapshot.CurrentBrightness,
            levels = (int[]?)null,
            instanceName = ddcCiSnapshot.Description,
            source = "ddc-ci"
        };
    }

    public static object SetBrightness(byte brightness)
    {
        if (WmiBrightnessController.SetBrightness(brightness))
        {
            return new { success = true, brightness, source = "wmi" };
        }

        if (DdcCiBrightnessController.SetBrightness(brightness))
        {
            return new { success = true, brightness, source = "ddc-ci" };
        }

        return new { success = false, error = "No controllable monitor found" };
    }

    public static int? GetCurrentBrightness()
    {
        var wmiSnapshot = WmiBrightnessController.GetBrightness();
        if (wmiSnapshot is not null)
        {
            return wmiSnapshot.CurrentBrightness;
        }

        return DdcCiBrightnessController.GetBrightness()?.CurrentBrightness;
    }

    /**
     * 常驻服务模式（serve）：进程只启动一次，之后通过 stdin/stdout 用行式 JSON 通信。
     *
     * 动机：每次 get/set 都 spawn 一个新进程要启动整个 .NET 运行时（实测 250-380ms），
     * 拖动滑条时写入严重滞后 → 系统值追不上 UI，还会把 UI 拉回旧值造成闪烁。
     * serve 模式把单次调用降到亚毫秒级，并顺带承担 monitor（WMI 事件）推送。
     *
     * 协议：
     *   请求（stdin 一行）：{"id":1,"cmd":"get"} | {"id":2,"cmd":"set","value":50} | {"id":3,"cmd":"ping"} | {"cmd":"quit"}
     *   响应（stdout 一行）：{"id":1,"ok":true,"result":{...}} | {"id":1,"ok":false,"error":"..."}
     *   事件（stdout 一行，无 id）：{"event":"brightness-changed","brightness":50,"timestamp":...}
     *
     * 线程模型：stdin 在后台线程读取并投递到队列，所有 WMI 调用都在主线程执行，
     * 避免跨线程使用 WMI/ManagementEventWatcher 带来的不确定性。
     */
    public static void Serve(JsonSerializerOptions jsonOptions)
    {
        var commandQueue = new ConcurrentQueue<string>();
        var commandEvent = new AutoResetEvent(false);
        var stopEvent = new ManualResetEvent(false);
        var outputLock = new object();

        void Emit(object payload)
        {
            lock (outputLock)
            {
                Console.WriteLine(JsonSerializer.Serialize(payload, jsonOptions));
                Console.Out.Flush();
            }
        }

        void HandleLine(string line)
        {
            if (string.IsNullOrWhiteSpace(line))
            {
                return;
            }

            string? id = null;
            try
            {
                using var document = JsonDocument.Parse(line);
                var root = document.RootElement;
                if (root.TryGetProperty("id", out var idElement))
                {
                    id = idElement.ToString();
                }

                var cmd = root.TryGetProperty("cmd", out var cmdElement) ? cmdElement.GetString() : null;
                switch (cmd)
                {
                    case "ping":
                        Emit(new { id, ok = true, pong = true });
                        break;

                    case "get":
                        Emit(new { id, ok = true, result = GetBrightness() });
                        break;

                    case "set":
                        {
                            var raw = root.GetProperty("value").GetDouble();
                            var target = (byte)Math.Clamp((int)Math.Round(raw), 0, 100);
                            Emit(new { id, ok = true, result = SetBrightness(target) });
                            break;
                        }

                    case "quit":
                        Emit(new { id, ok = true });
                        stopEvent.Set();
                        break;

                    default:
                        Emit(new { id, ok = false, error = $"Unknown command: {cmd}" });
                        break;
                }
            }
            catch (Exception exception)
            {
                Emit(new { id, ok = false, error = exception.Message });
            }
        }

        _ = Task.Run(() =>
        {
            try
            {
                string? line;
                while ((line = Console.In.ReadLine()) is not null)
                {
                    commandQueue.Enqueue(line);
                    commandEvent.Set();
                }
            }
            catch
            {
                // stdin 关闭即视为退出信号
            }

            stopEvent.Set();
        });

        using var watcher = new ManagementEventWatcher(@"root\wmi", "SELECT * FROM WmiMonitorBrightnessEvent");
        watcher.EventArrived += (sender, e) =>
        {
            try
            {
                var brightness = (byte)e.NewEvent.Properties["Brightness"].Value;
                Emit(new
                {
                    @event = "brightness-changed",
                    brightness,
                    timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                });
            }
            catch
            {
                // ignore malformed events
            }
        };
        watcher.Start();

        // ready + 首推当前值：调用方据此确认 serve 链路可用并校准缓存
        Emit(new { @event = "ready" });
        var current = GetCurrentBrightness();
        if (current is not null)
        {
            Emit(new
            {
                @event = "brightness-changed",
                brightness = current.Value,
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            });
        }

        var handles = new WaitHandle[] { stopEvent, commandEvent };
        while (true)
        {
            var signaled = WaitHandle.WaitAny(handles);
            if (signaled == 0)
            {
                break;
            }

            while (commandQueue.TryDequeue(out var line))
            {
                HandleLine(line);
            }
        }

        watcher.Stop();
    }

    public static void Monitor()
    {
        using var watcher = new ManagementEventWatcher(@"root\wmi", "SELECT * FROM WmiMonitorBrightnessEvent");
        watcher.EventArrived += (sender, e) =>
        {
            try
            {
                var brightness = (byte)e.NewEvent.Properties["Brightness"].Value;
                var json = JsonSerializer.Serialize(new { brightness, timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() });
                Console.WriteLine(json);
                Console.Out.Flush();
            }
            catch { /* ignore parse errors */ }
        };
        watcher.Start();

        // 保持进程运行，直到 stdin 关闭或收到退出信号
        Console.CancelKeyPress += (sender, e) =>
        {
            e.Cancel = true;
            watcher.Stop();
            Environment.Exit(0);
        };

        // 阻塞等待（stdin 关闭时进程自然退出）
        try { while (Console.In.Peek() != -1) Console.In.Read(); }
        catch { /* stdin closed */ }

        watcher.Stop();
    }
}
