# 汐月 Xiyue —— Electron 版现状（2026-08-31）

> 本文档为当前实现的事实记录，取代 Tauri 时代的设计文档作为架构现状参考。
> 旧文档（`AI管家设计方案.md` v1.2 等）基于 Tauri2+Rust 方案，因 2026-08-30 战略转向
> 已不适用于当前代码，仅保留作历史决策记录。

## 一、定位

本地常驻 AI 管家「汐月」，**Windows + Electron**（fork 自 eIsland，GPL-3.0-or-later + 附加条款），
灵动岛式浮窗 + 原生 Agent 对话 + 全本地语音链路。**数据不出本机**。

## 二、当前架构

```
Electron 主进程（src/main）
 ├─ child_process.spawn ──► Python 侧车 agent/server.py（.venv/Scripts/python.exe）
 │     HTTP 127.0.0.1:8765（XIYUE_AGENT_PORT 可覆盖）
 │     ├─ GET  /health         {ok, model}
 │     ├─ POST /chat {text}    → Ollama(qwen3-4b-32k) + persona/xiyue.md + 历史≤10轮 → kokoro TTS
 │     ├─ POST /voice          → 侧车录音(sounddevice) → STT → LLM → TTS
 │     ├─ POST /transcribe     → 渲染层录音 wav(base64) → faster-whisper → {text}
 │     └─ SSE  /agent/stream   → 真流式（think/chunk/tool_call_request/.../final），工具经主进程终审
 ├─ IPC 桥（ipc/agent/xiyueAgentIpc.ts）：xiyue:health/chat/voice/transcribe
 ├─ 主进程工具终审（services/xiyueToolSchema.ts）：xiyueFinalCheck + xiyueAuditLog（落盘 logs/xiyue-tools.log）
 │     └─ 入口：ipc/app/app.ts executeAgentLocalTool（SSE 工具调用与本地工具 IPC 的统一入口，顶部即终审）
 └─ preload：window.api.xiyueHealth/xiyueChat/xiyueVoice/xiyueTranscribe/xiyueStreamChatStart/executeAgentLocalTool

渲染进程（eIsland React UI）
 ├─ 原生 Agent（states/agent + maxExpand AiChatTab）：useAgentRunner/useChatSend 只跑汐月
 │     api/ai/xiyueLocalAgent.ts：window.api.xiyueStreamChatStart → 原生 SSE 事件流（think→chunk→final）+ TTS 自动播放
 │     api/ai/xiyueLocalTool.ts：工具结果经 window.api.xiyueToolResult 回传侧车（替代原 mihtnelis 平台回传）
 ├─ 语音球（agentVoiceInput）：录音 → PCM 累积 → wav → xiyueTranscribe（本地 faster-whisper）
 ├─ 身份层（主进程/渲染进程）：
 │     agent/persona/xiyue.json：程序化身份事实源（名字/模型/语言/情绪/记忆/工具参数）
 │     agent/identity.py：统一身份接口（get_name/get_visible_name/get_model_default/build_system_prompt）
 │     src/main/ipc/agent/xiyueIdentity.ts + src/main/window/mainWindow.ts + src/main/tray.ts：身份读接入
 │     src/preload/index.ts：暴露 window.api.xiyueIdentity()
 └─ hover 导航点「汐月」→ setAgent()
```

## 三、关键文件地图

| 层 | 文件 | 说明 |
|---|---|---|
| 侧车 | `agent/persona/xiyue.md` | 汐月人设（system prompt） |
| 侧车 | `agent/persona/xiyue.json` | 程序化身份配置（名字/模型/语言/情绪/记忆/工具参数） |
| 侧车 | `agent/identity.py` | 统一身份接口（get_name/get_visible_name/get_model_default/build_system_prompt） |
| 侧车 | `agent/emotion.py` | 情绪状态机（6 态：calm/pleased/focused/tired/worried/playful） |
| 侧车 | `agent/browser/playwright_client.py` | 浏览器自动化客户端（Playwright + Chromium） |
| 侧车 | `agent/gate/policy.py` | 权限预检（双闸门之提议侧；主进程终审已接入 executeAgentLocalTool） |
| 侧车 | `voice/stt.py` `tts.py` `vad.py` `wake.py` | faster-whisper / kokoro(+pyttsx3 兜底) / VAD / 唤醒词 |
| 主进程 | `services/xiyueAgentService.ts` | 侧车生命周期（spawn/kill） |
| 主进程 | `ipc/agent/xiyueAgentIpc.ts` | 四端点 IPC 转发 |
| 主进程 | `ipc/agent/xiyueIdentity.ts` | 身份 IPC 处理（getIdentity/invalidateIdentityCache） |
| 主进程 | `services/xiyueToolSchema.ts` | 工具白名单 + 风险等级 + 终审闸门 + 审计落盘 |
| 主进程 | `ipc/app/app.ts` | `executeAgentLocalTool` 工具分发 + 终审；`app:open-settings-window` 等 |
| 主进程 | `window/splashWindow.ts` | 启动动画窗口（仅首次启动显示，可交互） |
| 主进程 | `window/standaloneWindow.ts` | 独立设置窗口（openStandaloneSettingsWindow 强制切到设置页） |
| 主进程 | `window/mainWindow.ts` | 主窗口标题从 identity 层读取 |
| 主进程 | `tray.ts` | 托盘 tooltip 从 identity 层读取 |
| 渲染 | `api/ai/xiyueLocalAgent.ts` | SSE 事件流包装 + TTS 播放 |
| 渲染 | `states/agent/hooks/useAgentRunner.ts` | 岛内紧凑条（纯汐月） |
| 渲染 | `maxExpand/.../useChatSend.ts` | 完整对话页（汐月分支，原路由已停用） |
| 渲染 | `components/SplashScreen.tsx` + `SplashSettingsButton.tsx` | 启动动画 + 首次启动设置按钮 |
| 渲染 | `states/hover/components/HoverForm.tsx` | hover 态左侧导航点 + 时间页控制中心按钮栏（「管理页面」「设置」已并入控制中心按钮池） |
| 渲染 | `utils/xiyueIdentity.ts` | 渲染进程身份缓存工具 |
| 主进程 | `tray.ts` | 托盘菜单「设置」项（始终显示，`openStandaloneSettingsWindow` 直接弹出设置面板） |
| 渲染 | `states/agentVoiceInput/.../useAgentVoiceInputRuntime.ts` | 本地录音→转写 |

## 四、已完成 / 遗留

**已完成**：fork+改名；侧车接入；Agent 换芯（两处 UI 只跑汐月）；语音全本地化（腾讯 STT 已删）；
动画掉帧修复；开发模式引导修复；whisper 模型就位（`data/models/faster-whisper-base/`，gitignored）；
**真 SSE 流式**（/think/chunk/工具事件为真实侧车流，非模拟）；**权限闸门主进程终审已接入**
（`executeAgentLocalTool` 顶部 `xiyueFinalCheck`，拒绝未注册/空工作区高风险工具，拒绝事件审计落盘）；
**身份层全链路接入**（`xiyue.json` → `identity.py` → server.py/主进程/前端统一读取，改配置即可改名字/模型）；
**情绪系统接入大脑**（`emotion.py` 状态机 → `identity.py` 注入 system prompt → `/emotion` 端点可查，情绪只影响表达不影响权限）；
**浏览器自动化扩展**（Playwright + Chromium 已安装，`browser.open/screenshot/navigate/click/fill/scroll` 6 个工具已接入侧车+主进程，靠确认框做安全闸，无域名白名单限制）；
**前端身份显示接入**（`XiyueTab.tsx` 从 `xiyueIdentity.ts` 读取可见名，同步缓存+异步更新，改配置即可改 UI 显示的名字）；
**记忆系统 L0/L1 接入**（`history.json` 最近 10 轮对话历史 + `working_memory.json` 24h TTL 工作记忆，对话后自动提取偏好/实体/执行结果，实测通过）；
**记忆迁移脚本**（`scripts/migrate_memory.py` 一键复制 `data/` 目录，支持指定目标路径）；
**PowerShell 兼容修复**（`titleFallback.ts` worker 脚本 `HashSet[uint32]` 改为数组+显式转换，避免本机 PowerShell 版本报错）；
**启动动画改为仅首次启动**且带设置按钮（`splash:open-settings` → 打开独立设置窗口并跳过引导）；
**设置窗口热键放开**（非 standalone 模式也可打开）；**mihtnelis 云端 Agent 死代码清理**（删云端流式/工具回传/提示词拉取 4 函数
+ 5 类型文件 + 测试，仅保留活着的 `resolveMihtnelisWebAccess` 网页授权解析）；i18n `common.appName` → 汐月/Xiyue；
**设置页独立化**：设置不再作为灵动岛（MaxExpand）内嵌 Tab，只存在于独立窗口（灵动岛导航点与渲染分支已移除，
`MaxExpandTab` 类型保留 `settings` 以兼容已持久化状态）；12 处「跳设置」逻辑（登录/注册/设密/OAuth 绑定/问卷/
支付/通知/邮箱/工具箱/性能监控/Agent 头像等）统一改为先写 `store:settings-open-tab` 意图再
`window.api.openSettingsWindow()` 打开独立设置窗口（子页意图经 store 广播，原本地 `settings-open-tab-intent` 事件已废弃）；
**设置入口**：托盘「设置」菜单项（始终显示，直接弹出设置面板）、hover 态导航点底部齿轮按钮、启动动画设置按钮、快捷键；
**鼠标卡顿修复**：`externalAgentWatcher` 由每 4s 对 9 个 Agent 进程名各 spawn 一次 `tasklist`（即每 4s 9 次全进程枚举，
频繁打断主进程事件循环导致鼠标卡顿）改为一次枚举 + 内存匹配；剪贴板 URL 监听同步 `readText()` 轮询 1s → 2s 并加异常兜底。

**遗留**：
- 4 个 node-gyp 插件（fullscreen/processes/toast/perfmon）本机 `npm run plugins:build`（见第五节，需 VS2022 + Python）；
- AI 设置页残留（`AiSettingsSection` 等）视清理进度合并；
- 成功执行路径未审计（仅拒绝被审计）——需重构 `executeAgentLocalTool` 分发单体，建议单独测试通过后再做；
- 品牌残留中**基础设施部分不可改名**：`eisland-media`/`eisland-qishui` 自定义协议、`@eisland/*` npm 包、
  `com.eisland.app`（AppUserModelId）、`eIsland_store` 用户数据目录、更新 CDN/版本 API 的 `eisland` 参数均为服务端或运行时期望，
  改名会导致设置丢失 / 更新 404 / 协议处理器失效。

## 五、运行

```powershell
cd F:\Work\Create\Assa\Xiyue
npm run plugins:build   # 本机编译原生插件（VS2022 + Python 3.12；node-gyp 需 msvs 自动探测）
npm run dev             # 需本机 Ollama 运行；语音需麦克风
```

> 启动动画与首次引导同生命周期：首次启动播放动画并可点「设置」直接打开独立设置窗口；
> 非首次启动直接进入主界面。可在「设置 → 动画」页点「重置为首次启动」重新体验。
