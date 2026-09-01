using System.Collections.Concurrent;
using System.Text.Json;

var command = args.FirstOrDefault() ?? "get";
var jsonOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web);

try
{
    switch (command)
    {
        case "get-mute":
            Console.WriteLine(JsonSerializer.Serialize(
                AudioEndpointController.GetMute() is bool muted
                    ? new { muted }
                    : null,
                jsonOptions));
            break;

        case "set-mute" when args.Length > 1 && bool.TryParse(args[1], out var requestedMute):
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                success = AudioEndpointController.SetMute(requestedMute),
                muted = requestedMute
            }, jsonOptions));
            break;

        case "set-mute":
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                success = false,
                error = "Missing or invalid mute state"
            }, jsonOptions));
            break;

        case "get":
            Console.WriteLine(JsonSerializer.Serialize(
                AudioEndpointController.GetVolume() is int level
                    ? new { level }
                    : null,
                jsonOptions));
            break;

        case "set" when args.Length > 1 && int.TryParse(args[1], out var requestedLevel):
            var normalizedLevel = Math.Clamp(requestedLevel, 0, 100);
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                success = AudioEndpointController.SetVolume(normalizedLevel),
                level = normalizedLevel
            }, jsonOptions));
            break;

        case "set":
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                success = false,
                error = "Missing or invalid volume level"
            }, jsonOptions));
            break;

        case "monitor":
            using (var monitor = new AudioEndpointMonitor())
            {
                Console.CancelKeyPress += (_, eventArgs) =>
                {
                    eventArgs.Cancel = true;
                    monitor.Stop();
                };
                _ = Task.Run(() =>
                {
                    try
                    {
                        Console.In.ReadLine();
                    }
                    catch
                    {
                        // Stdin closure still stops the monitor.
                    }
                    monitor.Stop();
                });
                monitor.Run();
            }
            break;

        case "serve":
            Serve(jsonOptions);
            break;

        default:
            Console.WriteLine(JsonSerializer.Serialize(new
            {
                error = $"Unknown command: {command}"
            }, jsonOptions));
            break;
    }
}
catch (Exception exception)
{
    Console.WriteLine(JsonSerializer.Serialize(new { error = exception.Message }, jsonOptions));
}

/**
 * 常驻服务模式（serve）：进程只启动一次，之后通过 stdin/stdout 行式 JSON 通信。
 *
 * 动机：每次 get/set 都 spawn 新进程要启动整个 .NET 运行时（实测 250-320ms），
 * 拖动滑条时写入严重滞后 → 系统值追不上 UI，还会把 UI 拉回旧值造成闪烁。
 * serve 模式把单次调用降到亚毫秒级，并顺带承担 monitor（Core Audio 回调）推送。
 *
 * 协议：
 *   请求：{"id":1,"cmd":"get"} | {"id":2,"cmd":"set","value":50}
 *        | {"id":3,"cmd":"get-mute"} | {"id":4,"cmd":"set-mute","value":true} | {"cmd":"quit"}
 *   响应：{"id":1,"ok":true,"result":{...}} | {"id":1,"ok":false,"error":"..."}
 *   事件：{"event":"volume-changed","level":50,"timestamp":...}
 *
 * 线程模型：stdin 在后台线程读取并投递队列；所有 Core Audio COM 调用都在主线程
 * （monitor 主循环里）执行，避免跨 apartment 使用 COM 对象。
 */
static void Serve(JsonSerializerOptions jsonOptions)
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
                    Emit(new { id, ok = true, result = AudioEndpointController.GetVolume() });
                    break;

                case "set":
                    {
                        var raw = root.GetProperty("value").GetDouble();
                        var target = (int)Math.Clamp((int)Math.Round(raw), 0, 100);
                        Emit(new
                        {
                            id,
                            ok = true,
                            result = new { success = AudioEndpointController.SetVolume(target), level = target }
                        });
                        break;
                    }

                case "get-mute":
                    Emit(new { id, ok = true, result = AudioEndpointController.GetMute() });
                    break;

                case "set-mute":
                    {
                        var muted = root.GetProperty("value").GetBoolean();
                        Emit(new
                        {
                            id,
                            ok = true,
                            result = new { success = AudioEndpointController.SetMute(muted), muted }
                        });
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

    // 事件与命令响应共用 outputLock，保证 stdout 行不会交错
    using var monitor = new AudioEndpointMonitor(jsonOptions, outputLock);

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

        // stdin 关闭 → 唤醒 monitor 主循环退出（monitor 内部持有自己的 stop 事件）
        try
        {
            monitor.Stop();
        }
        catch
        {
            // 已在退出过程中
        }
    });

    Emit(new { @event = "ready" });

    monitor.Run(commandEvent, () =>
    {
        while (commandQueue.TryDequeue(out var line))
        {
            HandleLine(line);
        }
    });
}
