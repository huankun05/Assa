# Xiyue（汐月）项目全面调查报告

> **调查时间**：2026-09-10（v1.0）｜ **审校修订**：2026-09-10（v1.1，对照源码逐项复核）｜ **优化建议**：2026-09-10（v1.2，定向补查 + 业界参考，含 3 条覆盖原确认结论的方案级建议，见"v1.2 总览"）
> **调查范围**：Electron 应用层（src/main + src/preload + src/renderer + plugins）、Python Agent 侧车（agent/）、语音链路（voice/）、文档体系（docs/）、项目清理
> **所有结论均区分"已查证"（有源码/文档依据）与"推断/待确认"**
> **配套子报告**：`docs/Xiyue_Electron_Source_Audit.md`（Electron 层）、`docs/Xiyue_Agent_Voice_Source_Audit.md`（Agent/语音层）、`docs/README.md`（文档索引）、`docs/Xiyue_Cleanup_Report_2026-09-10.md`（清理清单）

## ⚠️ v1.1 审校勘误摘要（对照源码逐项复核，先读这里）

v1.0 主体结论（12 板块方向、双闸门架构、换脑方案、路线图）**经复核全部成立**，但部分"实测"数字与事实有出入。v1.1 已就地修正，主要勘误如下：

| # | v1.0 表述 | 复核结果（v1.1 修正） |
|---|---|---|
| 1 | IPC channel ~180+ | **实测 283 个**（src/main 中 `ipcMain.handle/on` 注册字符串去重） |
| 2 | 灵动岛 13 个运行时状态 | 状态机 `IslandState` 实为 **14 个值**——漏了 `musicProvidersLogin`（音乐平台登录态）；states/ 目录有 14 个组件目录，其中 `sliderCaptcha`（滑块验证码）是设置页弹层、**不是**状态机状态 |
| 3 | 大面板 13 页 | 实为 **15 个 MaxExpandTab**（aiChat/todo/urlFavorites/localFileSearch/clipboardHistory/album/mail/memo/countdown/alarm/toolbox/miniGame/stock/cli/settings）——v1.0 漏了 toolbox/miniGame/stock/settings，且"系统性能"实际在 expanded 态、"计算器"是拉起系统计算器 |
| 4 | 插件"9 个 C# Native AOT + koffi" | **不成立**。实际：**6 个** C# Native AOT DLL + koffi（icon/bluetooth/power/screenshot/smtc/wifi）；**3 个 C# EXE + child_process spawn**（brightness/volume 常驻 daemon、volume-analyzer）；**4 个** C/C++ node-gyp N-API；**1 个孤儿** hardware-info-helper（EXE 型，未集成） |
| 5 | server.py 内联 20 个工具 | 实为 **19 个**（7 file + cmd.exec + clipboard.read + sys.info + 2 monitor + net.ping + 6 browser） |
| 6 | tool_schema.json "17 个工具，有编码损坏" | 实为 **16 个工具**，文件是**合法 UTF-8 JSON**（中文工具名，如"列目录/读文件"），**无编码损坏**；"从未被加载"属实（`agent/tools/__init__.py` 加载器存在但无任何引用） |
| 7 | 侧车 HTTP "10 个端点" | 实为 **9 个**（v1.0 的端点表本身就列了 9 行，文字与表格自相矛盾） |
| 8 | 循环"无迭代预算" | **不成立**。`_MAX_TOOL_ROUNDS = 8`（xiyue.json `tools.max_rounds_per_turn: 8` 可配），超限后兜底再问一次。"无上下文压缩、无错误重试"仍属实 |
| 9 | L1 工作记忆"1 条过期 8 天未清理，无过期清理机制" | 前半属实（working_memory.json 现有 1 条 source=test 的过期条目），但 L1 **有活跃读写链路**：`_extract_and_store_facts` 启发式抽取→`add_fact`（TTL 24h）写入，prompt 注入 `get_active_facts`（读取时自动过滤过期）；`clear_expired` 被导入但从未调用，文件本身会积累 |
| 10 | L0 历史"内存中维护 ≤10 轮" | 实际**已持久化**到 history.json（上限 200 条消息），"≤10 轮"只是 prompt 注入上限；换脑方案中"L0 增加持久化"一项的前提不成立 |
| 11 | store.py "3 条测试数据，`_DEFAULT_DB_PATH` 硬编码相对路径" | 3 条测试数据属实；但代码中**不存在** `_DEFAULT_DB_PATH`——路径经 `resolve_data_dir()` 收口（`XIYUE_DATA_DIR` 环境变量 > 仓库 data/）；store.py docstring 已自述为 Phase 0 stub，将整体替换为 desk-pet 引擎 |
| 12 | silero-vad "已安装但未接入" | **未安装**（pip list 无 silero-vad）；`voice/vad.py` 一旦被 import 即 ImportError；faster-whisper 内置的 `vad_filter` 也未启用。P0 接入前需先 `pip install silero-vad` |
| 13 | 测试 129 个 .test.ts / 55 个 test 目录 | 129 是**仅 src/ 的口径**；全仓实测 157 个 .test.ts、71 个 test 目录 |
| 14 | CHANGE_LOG.md "GBK 编码乱码" | **不成立**，实测文件为正常 UTF-8 |
| 15 | announcement/ "40+ 份" | 属实（递归 41 个文件）✅；"清理清单 1.36GB"已执行（commit 562a028，实际释放约 1.35 GB） |

**审校新发现（v1.0 未覆盖）**：
- `xiyue.json` 中 `browser.allowed_domains` 域名白名单**未被任何代码强制执行**（playwright_client.py 无引用），浏览器工具实际不受域限制——建议纳入安全缺口清单
- 主进程长截图的 GDI BitBlt 引擎是 `src/main/ipc/window/capture.ts` **内联 koffi 直连 gdi32**，不是 screenshot-helper 插件；插件本身另有 desktopCapturer 回退用途
- `policy.py` docstring 仍写"Rust 侧终审"、server.py 头部仍写"由 Rust 外壳拉起"——Tauri 时代文档腐旧，建议顺手清理
- `_llm_reply` 会剥离 qwen3 `<think>` 段，`_run_agent_loop` 不剥离——两条回复路径行为不一致
- 独立窗口不止 v1.0 所列 6 个：还有 splash/guide/agentVoiceInput/cliGlow/capture/capturePin/网易登录等；聊天/邮件/翻译/工具箱实为同一独立窗口的 tab
- 项目根存在模块地图未收录的目录：`sdk/`、`web/`、`test/`、`scripts/`、`resources/`、`assets/`；i18n JSON 实际在**项目根 `i18n/`**（渲染层只有加载器）
- 清理报告提及的 `.workbuddy/`（473KB）现已不存在于项目根

---

## 🔧 v1.2 优化建议总览（定向补查 + 业界参考）

### v1.2 定向补查结论（为下面的建议提供依据）

| 待验证点（来自 v1.1 建议） | 复核结果 |
|---|---|
| `file.delete` 是否真走回收站 | ✅ 属实：`src/main/ipc/app/app.ts:1342` 调 `electronShell.trashItem()` |
| 渲染层/preload 是否绕过主进程直接调插件 | ✅ 未绕过：`src/renderer`、`src/preload` 对 `@eisland/*` 零 import（仅一处类型注释）。"插件调用必须经主进程中转"的拦截前提**已经成立**，无需改造 |
| `/voice` 是否还有调用方 | 渲染层/preload 零引用，可安全废弃 |
| ollama 0.6.2 客户端是否支持思考分离 | ✅ `chat(think=True/False/'low'/'medium'/'high')`，响应 `message.thinking` 独立字段——**不需要再自己剥离 `<think>`**，且 `think=False` 可直接关闭 qwen3 思考以降低语音场景延迟 |
| faster-whisper 内置 VAD 默认值 | `WhisperModel.transcribe` 默认 `vad_filter=False`（v1.1 说法成立）；`BatchedInferencePipeline.transcribe` 默认 `True` 且带批处理加速，可作为 STT 升级路径 |
| 渲染层录音管线能否做端点检测 | ✅ `useAgentVoiceInputRuntime.ts:135` 已用 `ScriptProcessorNode(1024)` 逐帧拿到 Float32 样本并有 1 分钟自动截断——RMS 静音判停只需在该回调加几行；注意 ScriptProcessorNode 已被浏览器标记废弃，中期应迁 AudioWorklet |
| silero-vad / openWakeWord 依赖成本 | .venv 已有 torch 2.13 + onnxruntime 1.29（kokoro 依赖），两者接入无新增重依赖；silero-vad 模型约 2MB |
| 死 IPC channel 估算 | 284 个注册中 **11 个**在 preload/renderer/resources/web 均无引用（约 4%）：`capture-ocr-layout-*`×3、`extension:install/list/uninstall`、`music:like:list`、`wallpaper:video:*`×3、`window:toggle-visibility`。其中 `extension:*` 三个无调用方说明 volume-analyzer 的扩展安装路径**连 UI 入口都没有** |

### 三条方案级建议（⚠️ 覆盖 v1.0 已确认结论，需用户重新拍板）

**A. P0 拆成 P0a / P0b 两段**（覆盖板块 12）
v1.0 的 P0 把 12 项"换脑主体"与"几十行的安全/清理小改动"混在一个批次，风险与收益不匹配。建议：
- **P0a（≤1 周，高确定性）**：`allowed_domains` 补洞、信任等级由硬编码改读设置、成功路径审计、ollama `think` 字段替代 `<think>` 手工剥离、TTS 不落盘、`/voice` 标记废弃、以执行器为准重建工具 schema。全部不碰换脑，先落地。
- **P0b（换脑主体）**：hermes_core 移植 + 记忆接线 + 真流式 + PAD 情绪 + VAD。每项定**完成判据**（真流式：本地首字 < 1.5s；记忆：能答对 10 轮前提过的个人事实；VAD：说完 1.5s 内自动发送）。
- 配套建立**回归对话集**（20-30 条固定脚本：记忆/情绪/工具/边界四类），每次侧车改动跑一遍——多模块 AI 系统单元测试绿了体验照样可能退化。

**B. 工具统一不是"19+16 合并"，而是以主进程执行器为单一事实源重建 schema，并对齐 MCP 工具格式**（覆盖板块 6 结论 5）
- 中文那套 16 个工具是设计期产物，与主进程实际可执行的 `CLIENT_LOCAL_TOOL_PREFIXES` 对不上；"合并"会把"设提醒/查日程/代发消息"这类没有执行器的条目复活成"LLM 会调、没人执行"的坑。正确做法：**从主进程执行器导出 schema**（英文命名 19 个为准），中文表里有价值的条目按模板补实现后再进 schema。
- schema 格式对齐 [MCP 工具定义](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)：`name / title / description / inputSchema / annotations{readOnlyHint, destructiveHint, idempotentHint, openWorldHint}`。`annotations` 与板块 10 的 allow/ask/deny 直接映射（readOnly→allow、destructive→deny 默认、其余→ask），一份定义同时喂 LLM、policy.py 预检和主进程终审；将来接第三方 MCP 工具零转换。
- 启动校验：policy.py 与 `xiyueToolSchema.ts` 都从同一份 schema 加载，元数据不一致拒绝启动并告警。policy.py 自己的 docstring 就要求"两份逻辑共享单一事实源、语义必须一致"，但现在两边各自硬编码。

**C. 端点检测走渲染层，silero-vad 降级到打断场景**（覆盖板块 9 结论 3）
- 渲染层 `ScriptProcessorNode` 回调里已有逐帧 Float32 样本，加 RMS + "连续 1.5s 低于阈值即 `stopAll()`"约 30 行，零新依赖、零 IPC、零推理。参考 Pipecat 的 VAD 参数默认值（`start_secs 0.2 / stop_secs 0.2 / confidence 0.7 / min_volume 0.6`）设初值，语音助手场景 stop 取 1.0-1.5s。
- silero-vad 的真正价值是**打断（barge-in，TTS 播放时检测用户插话）和背景人声过滤**，这是语义级判断，RMS 做不了——留给 P2 与唤醒词一起做。Pipecat 的做法是 VAD 在 TTS 播放期间持续运行，用户说话即取消在途工作。

### 参考项目对照（v1.2 抓取核实）

| 项目 | 与汐月的对应点 | 可借鉴 |
|---|---|---|
| [MCP 工具规范](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) | 工具 schema、双闸门 | `annotations` 映射权限等级；规范明文要求"人在环可拒绝"、"记录工具用量供审计"、"给工具调用设超时"——与板块 10 完全一致；`isError` 区分协议错误与执行错误，可直接用于循环增强的错误分类 |
| [Pipecat 语音输入](https://docs.pipecat.ai/pipecat/learn/speech-input) | 语音链路 | 内置 Silero VAD，本地 VAD 比远程快 150-200ms；Smart Turn（判断"停顿≠说完"）；barge-in 默认开启；建议噪声在 VAD 前做而不是调高阈值 |
| [Letta（MemGPT）](https://docs.letta.com/concepts/memgpt) | 记忆系统 | 记忆块（persona/human）常驻上下文 + 归档段落可检索 + 会话历史可压缩（compact）——与 hermes_core L0-L3 同构，验证了分层设计方向；其 v2 "MemFS 用 git 跟踪记忆"可作为记忆可追溯/可回滚的思路 |
| [Open-LLM-VTuber](http://docs.llmvtuber.com/en/docs/quick-start) | 本地 AI 伴侣整体形态 | 最接近的开源同类：Python 后端 + Electron 桌宠模式；长期记忆接 Letta 但明确承认"会增加对话延迟"；默认本地 ASR 是 **sherpa-onnx + SenseVoiceSmall（CPU、中文强、自带情绪/事件标签）**，值得作为 faster-whisper 的对照候选 |
| [silero-vad](https://pypi.org/project/silero-vad/) | VAD | MIT，2MB，16k，每 30ms 块 <1ms；依赖 torch（venv 已有） |
| [openWakeWord](https://pypi.org/project/openwakeword/) | 唤醒词 | 预训练模型**仅英文且 CC BY-NC-SA 非商业**，"嘿汐月"必须自训；训练全靠 TTS 合成正样本（数千条）——**项目自带的 kokoro 正好能批量生成**；Windows 走 onnxruntime（venv 已有）；80ms 帧输出 0-1 置信度 |
| [Mem0](https://docs.mem0.ai/open-source/overview) | 记忆抽取 | 默认组件依赖云端 LLM + Qdrant，与"本地为主"冲突，不建议引入；仅作 add/search API 形态参考 |

---

## 一、项目概述

**一句话定位**：汐月是 eIsland（GPL-3.0）的 Electron 衍生换芯版——一个 Windows 桌面灵动岛形态的本地常驻快捷工具与 AI 助手，核心特色是本地为主的 AI 推理（Ollama + faster-whisper + kokoro，预留云端模型接口应对复杂任务）、双闸门安全模型、以及可爱小姑娘形象"汐月"的冷暖对冲设计语言。

### 关键数据（全部实测，v1.1 复核）

| 维度 | 数据 | 来源 |
|---|---|---|
| 版本 | v26.7.4 | package.json |
| 技术栈 | Electron 43 + React 19 + TS 7 + Vite 7 + Tailwind 4 + zustand 5 | package.json / 配置文件 |
| Python 侧车 | Python 3.12 venv，http.server.ThreadingHTTPServer，127.0.0.1:8765 | agent/server.py（622 行 / 25.7KB，9 个端点） |
| LLM | Ollama qwen3-4b-32k（非流式调用） | agent/server.py + persona/xiyue.json |
| 原生插件 | 14 个目录（6 个 C# Native AOT + koffi FFI，3 个 C# EXE spawn（含 2 个常驻 daemon），4 个 C/C++ node-gyp N-API，1 个孤儿 EXE 型） | plugins/ |
| IPC Channel | 283 个（`ipcMain.handle/on` 注册字符串去重），按六域分类 | src/main/ipc/ |
| 灵动岛状态 | 14 个状态机值（`IslandState`）+ 14 个 states 组件目录（含 sliderCaptcha 弹层，非状态机状态） | store/types + components/states/ |
| zustand slice | 7 个 | src/renderer/store/slices/ |
| 测试文件 | 全仓 157 个 .test.ts（src/ 内 129 个）、71 个 test 目录 | 全仓扫描 |
| i18n | 2 种语言（zh-CN / en-US，JSON 在项目根 i18n/） | i18n/ |
| 文档 | docs/ 根 17 份 md + announcement/ 41 份 + design/ + LEGAL/ 3 份 | docs/ |

---

## 二、现状层

### 2.1 功能清单

#### 灵动岛核心交互（已实现）
- **三档尺寸 + 事件临时态**：胶囊 260×42 / hover 500×60 / 大面板 860×150·860×400 / 通知条 500×88
- **14 个状态机值（IslandState）**：idle / hover / expanded / maxExpand / notification / lyrics / lyricsTranslation / guide / announcement / agentVoiceInput / agent / stt / cli / musicProvidersLogin
  - `agentVoiceInput`：独立语音输入态（500×42），苹果风格语音球 + 声纹波形效果，含完整 PCM 音频处理/AudioContext/热键触发，与对话态视觉分离
  - `musicProvidersLogin`：音乐平台（网易等）登录态，v1.0 遗漏
  - 另有 `sliderCaptcha`（滑块验证码）states 组件目录：由设置-关于页以命令式弹层触发（`runSliderCaptcha` 直接挂 DOM），**不占状态机状态值**
- **hover 6 个 Tab**：time（控制中心）/ lyrics（歌词+喜欢）/ weather / xiyue（AI 双态）/ pomodoro（番茄钟）/ expand（入口，常驻）；支持 `custom:*` 用户自定义页
- **大面板 15 页（MaxExpandTab）**：AI聊天 / 待办 / URL收藏 / 本地文件查找 / 剪贴板历史 / 相册 / 邮箱 / 备忘录 / 倒数日 / 闹钟 / 工具箱 / 小游戏 / 股票 / CLI控制台 / 设置
  - v1.0 所列"系统性能"实际在 expanded 态（PerformanceMonitorTab），"计算器"是拉起操作系统自带计算器（`system:open-calculator`）
  - 工具箱内含 8 个工具组件：下载/编码/文件压缩/文件服务/格式工厂/网络服务/软件管理/翻译
- **独立窗口**：设置窗口（独立 BrowserWindow）；聊天/邮件/翻译/工具箱为同一"独立窗口"的 tab（standaloneWindow，13 个可切 tab）；另有 splash / guide / agentVoiceInput / cliGlow / capture / capturePin / 网易登录等辅助窗口

#### 系统控制（已实现）
- 亮度调节（DDC/CI + WMI，常驻 serve 模式提速 40 倍）
- 音量控制（CoreAudio，常驻 serve 模式）
- 蓝牙监控与设备管理
- WiFi 状态监控
- 电源状态监控（电池/充电/休眠）
- 全屏检测（决定灵动岛是否隐藏）
- 硬件信息读取
- 性能监控（CPU/内存/温度）
- 进程管理（attacker，可结束进程）

#### 媒体与音乐（已实现）
- SMTC（Windows Media Transport Controls）集成：播放/暂停/上一首/下一首/进度/封面
- 网易云音乐深度集成：登录 / 喜欢同步 / 歌词精确匹配（Rust netease-watcher WebSocket 补全进度）
- 歌词显示：居中歌词 + 翻译 + 卡拉OK逐字
- 音量可视化分析（FFT）
- 应用图标提取（按 PID/进程名/快捷方式）

#### AI 助手（已实现，Phase 0 精简版）
- 本地 LLM 对话（Ollama qwen3-4b-32k，默认模型来自 persona/xiyue.json `model_default`）
- SSE 流式输出（**模拟流式**：完整回复后按 8 字符 + 20ms 人工切片）
- 工具化 agent 循环：19 个内联工具定义，每轮对话最多 8 轮工具调用（`_MAX_TOOL_ROUNDS`，xiyue.json 可配），超限兜底再问一次
- 语音输入：渲染层 getUserMedia 录音 → faster-whisper STT
- 语音输出：kokoro TTS（zf_xiaobei 音色，24k wav）+ pyttsx3 兜底
- 浏览器自动化（Playwright，6 个工具；xiyue.json 配置了 `browser.allowed_domains` 白名单但**代码未强制执行**）
- 双闸门安全：Python policy.py 预检 + Electron 主进程 xiyueFinalCheck 终审
- 身份层：xiyue.json 程序化身份 → identity.py → 主进程/前端统一读取
- 记忆 L0（history.json 持久化，上限 200 条消息，prompt 注入 ≤10 轮）+ L1（working_memory.json，启发式抽取写入 + 24h TTL 读时过滤；当前 1 条 source=test 的过期测试条目）
- 长截图：双引擎（Electron desktopCapturer 600-900ms / capture.ts 内联 koffi 直连 gdi32 BitBlt 毫秒级）+ 自动滚动 + DP 最小能量缝拼接（渲染层 resources/capture.js，r60，2026-09-10）

#### 其他功能（已实现）
- 剪贴板历史
- 通知监听（Windows Toast）
- 全局热键
- 壁纸市场
- 问卷系统
- 多线程下载引擎（Range 分块 + 并发 + 断点续传）
- 天气（和风天气 UAPI + WMO 双标准，400+ 图标映射）
- 番茄钟 / 倒计时 / 闹钟
- URL 收藏夹 / 相册 / 备忘录
- 本地文件搜索
- 邮件客户端
- CLI 控制台

### 2.2 模块地图

```
Xiyue/
├── src/main/                    # Electron 主进程
│   ├── index.ts                 # 入口（1055 行），窗口管理 + IPC 注册（~25 个 register*IpcHandlers）
│   ├── ipc/                     # 283 个 IPC channel，六域分类
│   │   ├── agent/               # AI 对话/工具执行/语音（localToolIpc.ts 含 xiyueFinalCheck 终审）
│   │   ├── app/                 # 应用配置/更新/账户（app.ts 2599 行，含工具执行终审）
│   │   ├── media/               # 音乐/SMTC/歌词/音量（media:get/set-volume 为 stub）
│   │   ├── settings/            # 设置读写
│   │   ├── system/              # 系统控制/剪贴板/下载
│   │   └── window/              # 窗口管理/灵动岛状态（capture.ts 含长截图双引擎）
│   ├── services/                # 后台服务（SMTC/通知/更新/xiyueAgentService 侧车 spawn + 30s 健康巡检/xiyueToolSchema 终审+审计）
│   ├── core/                    # 核心模块（downloadEngine 多线程下载）
│   ├── config/                  # 配置管理
│   ├── system/                  # 系统交互
│   ├── clipboard/               # 剪贴板
│   ├── music/                   # 音乐服务（qishuiAudio provider / neteaseAuthService）
│   ├── window/                  # 窗口管理（mainWindow/settingsWindow/standaloneWindow/splash/guide/capture 等）
│   ├── log/                     # 日志
│   ├── installer/               # 安装器
│   └── extensions/              # 扩展（extensionRegistry：volume-analyzer 注册为可选下载扩展）
│
├── src/preload/                 # 预加载脚本，暴露安全 API 给渲染层
│
├── src/renderer/                # React 渲染层
│   ├── components/states/       # 14 个状态组件目录（13 个状态机态 + sliderCaptcha 弹层；musicProvidersLogin 态无独立目录）
│   ├── components/components/    # DynamicIsland* 共享组件
│   ├── store/                   # zustand 7 slice（island/weather/timer/notification/media/ai/pomodoro）
│   ├── api/                     # API 层（ai/announcement/lyrics/miniGame/site/tools/update/user/weather）
│   ├── utils/                   # 工具（audio/theme/security/totp/lrcParser/sliderCaptcha 等）
│   ├── styles/                  # 样式（按状态/模块组织）
│   └── i18n/                    # 仅加载器 index.ts；语言 JSON 在项目根 i18n/
│
├── i18n/                         # zh-CN.json / en-US.json（语言包实际位置）
├── resources/                    # 静态资源 + capture.js（长截图渲染端：滚动/抓帧/DP 缝拼接）
├── scripts/                      # 构建/发布/校验脚本（changelog、i18n 检查、扩展打包、COS 上传等）
├── sdk/ web/ test/ assets/       # v1.0 模块地图未收录的根目录（sdk/web 用途待补充说明）
│
├── agent/                        # Python Agent 侧车（自写 Phase 0 精简实现）
│   ├── server.py                # HTTP/SSE 服务器（622 行 / 25.7KB，9 个端点，19 个内联工具）
│   ├── main.py                  # 入口
│   ├── identity.py              # 身份/人格系统（274 行；情绪 calm/tired 按时段推断后缓存）
│   ├── emotion.py               # 情绪系统（71 行，6 状态 compute_emotion **未接入主链路**）
│   ├── memory/                  # 记忆系统
│   │   ├── store.py             # SQLite 长期记忆 Phase 0 stub（**add/search/forget/count 未接入**，3 条测试数据；仅 resolve_data_dir 被各模块引用）
│   │   ├── history.py           # 对话历史（history.json 持久化，上限 200 条）
│   │   └── working.py           # 工作记忆（working_memory.json，24h TTL，已接入 server.py 读写）
│   ├── gate/                    # 权限预检
│   │   └── policy.py            # 工具权限策略（ALLOW/CONFIRM/DENY 五步裁决；docstring 仍写"Rust 侧终审"，已腐旧）
│   ├── tools/                   # 工具注册表加载器（读 schemas/tool_schema.json，**无任何引用**）
│   ├── browser/                 # Playwright 浏览器自动化（playwright_client.py，未校验 allowed_domains）
│   └── persona/                 # 人格设定（xiyue.json + xiyue.md）
│
├── voice/                        # 语音链路
│   ├── stt.py                   # faster-whisper 语音识别（默认 CPU int8；未启用 vad_filter）
│   ├── tts.py                   # kokoro 语音合成 + pyttsx3 兜底（docstring 设计目标 CosyVoice V3）
│   ├── vad.py                   # silero-vad 端点检测（**未被主链路调用，且 silero-vad 包未安装**）
│   └── wake.py                  # 唤醒词（8 行空 stub，函数体为 `...`）
│
├── plugins/                      # 14 个原生 helper 插件（目录名保留 eisland-windows-* 前缀）
│   ├── 6 个 C# Native AOT DLL + koffi FFI（icon/bluetooth/power/screenshot/smtc/wifi）
│   ├── 3 个 C# EXE + child_process spawn（brightness/volume 常驻 daemon；volume-analyzer 可选扩展）
│   ├── 4 个 C/C++ node-gyp N-API（fullscreen/processes/toast/performance-monitor 混合 C# 温度 EXE）
│   └── 1 个孤儿（hardware-info-helper，C# EXE，未集成）
│
├── schemas/                      # JSON Schema（tool_schema.json：16 个中文命名工具，合法 UTF-8，无人加载）
├── docs/                         # 文档体系（见附录文档索引）
├── data/                         # 运行时数据（models/faster-whisper-base 142MB、history.json 空、memory.db 3 条、working_memory.json 1 条；tts/ tmp/ 运行时创建，当前不存在）
├── .venv/                        # Python 3.12 虚拟环境（faster-whisper 1.2.1 / kokoro 0.9.4 / ollama 0.6.2 / pyttsx3 / sounddevice；**无 silero-vad**）
└── out/                          # Electron 构建产物（清理后当前不存在，npm run build 重建）
```

### 2.3 核心数据流

#### 用户对话数据流
```
用户输入（文字/语音）
  → 渲染层状态机切换到 agent/stt 状态
  → preload API → 主进程 IPC（agent 域）
  → 主进程 HTTP POST 到 Python 侧车 127.0.0.1:8765
    → /chat 或 /chat/stream（SSE）
    → server.py: 构建 prompt（persona + [当前情绪] + 历史≤10轮 + working_memory 活跃事实≤10条）
    → Ollama qwen3-4b-32k 非流式调用（带 19 个 tools 定义）
    → 如需工具：policy.py 预检 → tool_call_request 事件 → 主进程 xiyueFinalCheck 终审 → 执行 → /tool-result 回传
      （最多 _MAX_TOOL_ROUNDS=8 轮，超限兜底再问一次）
    → 完整回复后按 8 字符 + 20ms 人工切片，通过 SSE chunk 事件推送
    → 回写 history.json；_extract_and_store_facts 启发式抽取事实 → working_memory.json
  → 主进程转发 SSE 到渲染层
  → 渲染层逐字显示 + 状态切换（thinking → toolCalling → answering）
  → 如需 TTS：kokoro 合成 wav → base64 随 final 事件返回 → 渲染层播放
```

#### 语音输入数据流
```
渲染层 getUserMedia 录音（主路径）
  → /transcribe 端点（audio_b64 → data/tmp/in_*.wav）
  → faster-whisper base（CPU int8，模型目录 142MB；未启用 vad_filter）
  → 返回文本 → 进入对话流程
```
备用路径：服务端 sounddevice 固定录 12 秒 → 能量裁剪首尾静音 → /voice（延迟不可接受，不推荐）

#### 长截图数据流
```
用户触发长截图
  → 主进程 IPC capture.ts：capture-longshot-gdi（内联 require('koffi') 直连 gdi32 BitBlt→GetDIBits，毫秒级）
     或 capture-longshot-frame（desktopCapturer 回退，600-900ms）
  → 自动匀速滚动（PostMessage WM_MOUSEWHEEL 直达 Chromium）
  → 渲染端 resources/capture.js：静止抓帧 → 帧-累积匹配 → DP 最小能量缝拼接（r31 引入）
  → 三重防护（错帧/滑谷/软帧，r58）+ 空背景假谷检测（r59）
  → 返回拼接后长图
```
> 注：长截图的 GDI 引擎**不经过** screenshot-helper 插件；该插件（C# Native AOT + koffi，`src/main/window/screenshotHelper.ts` 加载）用于普通截图路径并带 desktopCapturer 回退。

### 2.4 技术栈实测

| 层级 | 技术 | 版本 | 备注 |
|---|---|---|---|
| 桌面框架 | Electron | 43 | 从 Tauri2 迁移（2026-08-30） |
| 前端框架 | React | 19 | |
| 语言 | TypeScript | 7 | 版本激进 |
| 构建工具 | Vite + electron-vite | 7 | |
| 样式 | Tailwind CSS | 4 | |
| 状态管理 | zustand | 5 | 7 slice |
| 测试 | Vitest + v8 coverage | 4.x | 全仓 157 测试文件（src/ 内 129） |
| Node 要求 | >=25.0.0 | - | 版本激进 |
| Python | 3.12 | - | venv 在项目根 |
| HTTP 服务器 | http.server.ThreadingHTTPServer | 标准库 | 非 Flask/FastAPI |
| LLM | Ollama + qwen3-4b-32k | ollama 0.6.2 | 非流式调用（stream=False 三处） |
| STT | faster-whisper base | 1.2.1 | CPU int8（可 env 切 cuda），模型目录 142MB；未启用内置 vad_filter |
| TTS | kokoro + pyttsx3 | 0.9.4 / 2.99 | zf_xiaobei 音色，24kHz |
| VAD | silero-vad | - | **未安装**（pip list 无），vad.py 存在但不可 import；非 v1.0 所述"已装未接入" |
| 浏览器自动化 | Playwright | - | 6 个工具；allowed_domains 白名单未强制 |
| 原生插件 | C# Native AOT + koffi / C# EXE spawn / C++ node-gyp | - | 14 个目录（6 + 3 + 4 + 1 孤儿） |
| 打包 | electron-builder | 26.x | extraResources 仅打包 brightness/volume 两个 helper |

---

## 三、目标层

### 3.1 产品定位

**核心定位**：Windows 桌面灵动岛形态的本地常驻快捷工具与 AI 助手——以快捷工具和信息展示为核心，AI 助手辅助完成任务。

**设计基因**（来自 DESIGN_STYLE_GUIDE.md）：
- Apple-inspired 极简骨架 + 冷色玻璃面板
- 暖色可爱小姑娘角色（汐月，二次元风格，暂无设计稿，留有形象替代空间，已加入设计计划）
- 设计铁律："UI 冷、角色暖，冷暖对冲"

**核心原则**（来自 AI管家设计方案.md，虽架构已废弃但产品原则仍有效）：
- 本地为主 + AI 自主路由：日常任务用本地模型，由本地 AI 自主判断任务复杂度并决策是否调用云端模型（OpenAI 兼容接口，设置中显式开启，默认关闭）；语音 STT/TTS 同样允许云端备选
- 最小权限：四级信任模型 L0-L3，默认 L1
- 能力与情绪正交：工具能力与情绪状态独立
- 可逆可审计：所有操作可回滚、有日志
- 人类在环：高风险操作需用户确认
- 执行权单一：最终执行权归 Electron 主进程

#### v1.2 增量建议（产品定位）
1. **定一个北极星场景防发散**：换脑后容易从"工具岛带 AI"滑向"AI 管家带工具"，但 42px 胶囊形态天然不适合承载重 AI 交互，AI 的差异化在于**把现有工具串起来**。建议以一条标志性场景做验收基准（例："把 D 盘下载里的 PDF 归到文档库" → file.search → 移动 → 确认 UI → 结果回填面板），后续每个 P0/P1 项都问"是否推进了这个场景"。
2. **云端路由不要依赖小模型自评复杂度**：qwen3-4b 判断"自己能不能做"会系统性偏自信。更稳的是**规则优先 + 失败升级**：预计工具轮数 > N、上下文超阈值、本地连续失败 ≥2 次 → 升级云端并记录，路由策略用运行数据养出来；模型自评只作辅助信号。

### 3.2 已实现目标

| 目标 | 状态 | 说明 |
|---|---|---|
| 从 eIsland fork 并改名汐月 | ✅ | 品牌/身份层已统一 |
| Electron 架构迁移 | ✅ | 2026-08-30 从 Tauri2+Rust 转向 Electron |
| 灵动岛三档尺寸 + 独立窗 | ✅ | 5 阶段全部完成 |
| 本地为主 AI 推理 | ✅ | Ollama + faster-whisper + kokoro，删除腾讯云 STT；云端模型接口预留中 |
| Python Agent 侧车 Phase 0 | ✅ | 自写精简实现，HTTP/SSE 10 端点 |
| 双闸门安全模型 | ✅ | Python policy.py 预检 + 主进程 xiyueFinalCheck 终审 |
| 身份层全链路 | ✅ | xiyue.json → identity.py → 主进程/前端统一 |
| SSE 流式输出 | ⚠️ 模拟 | 完整回复后人工切片，非真流式 |
| 语音输入/输出 | ✅ | 渲染层录音 → STT → LLM → TTS |
| 浏览器自动化 | ✅ | Playwright 6 工具 |
| 记忆 L0/L1 | ⚠️ 部分 | L0 对话历史正常且已持久化（history.json）；L1 working_memory 已接入（启发式抽取写入 + 24h TTL 读时过滤，但 clear_expired 从未调用、文件会积累）；L2 SQLite 长期记忆**未接入**（Phase 0 stub） |
| 情绪系统 | ⚠️ 部分 | identity.py 2 状态（calm/tired，按时段 23-6 点推断后缓存，之后不更新）已注入 prompt；emotion.py 6 状态**未接入** |
| 长截图功能 | ✅ | r60 版本，双引擎（desktopCapturer + capture.ts 内联 koffi gdi32）+ DP 拼接 + 三重防护 |
| 亮度/音量常驻 serve 模式 | ✅ | 提速约 40 倍（汐月Electron版现状.md:113 实测 get 3.1/2.3ms、set 9.4/8.1ms） |
| 设置页独立化 | ✅ | 工具类全部迁独立工具箱窗口 |
| 网易云音乐集成 | ✅ | 登录/喜欢同步/歌词精确匹配 |
| 14 个原生系统插件 | ⚠️ 12/14 集成 | hardware-info-helper 为孤儿未集成；volume-analyzer 注册为可选下载扩展、主进程无静态集成 |
| 设计风格指南 | ✅ | DESIGN_STYLE_GUIDE.md |
| 文档体系 | ✅ | 13 份根目录文档 + 公告 + 设计原型 + 法律文档 |

### 3.3 未实现 / 计划中

| 目标 | 状态 | 说明 |
|---|---|---|
| Agent 侧车"换脑" | 📋 草案 | 移植 desk-pet hermes_core 的 memory/emotion/soul/time 四模块，见方案_存储与移植规划_v1.0.md，5 个决策点待拍板 |
| 数据目录统一收口 | 📋 草案 | 统一到 %APPDATA%\xiyue\，分 data/logs/cache，同上方案 |
| 真流式 LLM 调用 | ❌ 未实现 | 当前为非流式 + 人工切片，首字延迟 = 完整推理时间 |
| SQLite 长期记忆接入 | ❌ 未实现 | store.py（Phase 0 stub）add/search/forget/count 从未被调用，3 条测试数据；docstring 已自述将整体替换为 desk-pet 引擎 |
| 情绪状态机接入 | ❌ 未实现 | emotion.py 6 状态 compute_emotion 从未被调用 |
| silero-vad 接入 | ❌ 未实现 | **包未安装**（vad.py 不可 import），faster-whisper 内置 vad_filter 也未启用；接入前需先 `pip install silero-vad` |
| 唤醒词 | ❌ 空 stub | wake.py 8 行，函数体为 `...` |
| 工具定义统一 | ❌ 双轨制 | server.py 内联 19 工具（英文 `file.read` 式命名 + `_TOOL_POLICY` 权限元数据）vs schemas/tool_schema.json 16 工具（中文命名，含 policy/default_level），命名空间不同；后者合法 UTF-8、无编码损坏，但 agent/tools/ 加载器无任何引用 |
| 浏览器域名白名单执行 | ❌ 未实现 | xiyue.json `browser.allowed_domains` 已配置，playwright_client.py 未读取校验 |
| Phase 2 会话检索 FTS5 | 📋 计划 | 方案中 Phase 2，引入 SQLite FTS5 全文检索 |
| Phase 3 外围归位 | 📋 计划 | OCR/eIsland_store 废弃归位 |
| 4 个 node-gyp 插件预编译 | 📋 遗留 | 当前需本机编译，影响分发 |
| AI 设置页残留清理 | 📋 遗留 | 汐月Electron版现状.md 中记录 |
| 成功执行路径审计 | 📋 遗留 | 当前只有失败/拒绝审计 |
| 云端模型接口 + AI 自主路由 | 📋 计划 | OpenAI 兼容格式，设置中显式开启（默认关闭）；由本地 AI 自主判断任务复杂度并决策是否调用云端模型，需设计路由策略与判断机制 |
| 云端 STT/TTS 备选 | 📋 计划 | 语音识别与合成允许云端备选（与本地 faster-whisper/kokoro 并行，用户可选） |
| 汐月二次元形象设计 | 📋 计划 | 可爱小姑娘二次元风格，暂无设计稿，留有形象替代空间，需纳入设计计划 |
| AI 助手可调用快捷工具 | 📋 计划 | 灵动岛现有快捷工具（亮度/音量/剪贴板/待办等）应纳入 AI 可调用工具集，实现"工具助手辅助完成" |
| 面板工具可自定义（开关+排序） | 📋 计划 | hover Tab 与大面板每页对应一个工具，用户可在设置中启用/禁用工具并调整展示顺序；配置跨会话持久化 |
| 灵动岛尺寸自定义 | 📋 计划 | 保留三档默认预设（260/500/860），设置中增加每档自定义宽高；大面板调大后可增加内容密度 |
| AI 感知当前激活工具上下文 | 📋 计划 | 用户在某工具页内可直接自然语言调用 AI，AI 自动带入当前工具数据（如待办页调用 AI 时已知当前待办列表） |

### 3.4 已废弃路径

| 废弃项 | 原方案 | 替代方案 | 废弃时间 |
|---|---|---|---|
| Tauri2 + Rust 架构 | Tauri2（Rust 后端 + React 前端），Rust 沙箱终审，Rust 音频采集 | Electron 主进程 + Python 侧车，主进程终审，渲染层录音 | 2026-08-30 |
| 官方 Hermes Agent 内核 | 嵌入 Nous/elementh hermes-agent（32,789 行） | 自写 Phase 0 精简 Agent core | 设计文档 v1.1 修订 |
| 腾讯云 STT | 云端语音识别 | faster-whisper 本地 STT | 汐月Electron版现状 |
| 灵动岛改造方案（早期） | Tauri 时代基于 Apple HIG 的 Phase A-F 方案 | 灵动岛分档改造计划书（三档尺寸+独立窗） | 被分档计划书取代 |
| AI管家设计方案 v1.2 | Tauri 时代产品设计总纲 | 汐月Electron版现状（事实基线）+ 方案_存储与移植规划（新草案） | Electron 转向后整体失效 |
| Rust netease-watcher？ | （待确认） | SMTC C# DLL + Worker 线程 | - |

---

## 四、方法层

### 4.1 整体架构决策

**架构模式**：Electron 主进程 + Python 侧车（sidecar）+ 原生插件（C#/C++）三层架构。

```
┌─────────────────────────────────────────────────┐
│  Electron 渲染进程 (React 19)                    │
│  灵动岛状态机 / UI / zustand store               │
└──────────────┬──────────────────────────────────┘
               │ preload API (contextBridge)
┌──────────────▼──────────────────────────────────┐
│  Electron 主进程                                  │
│  窗口管理 / IPC 路由(283 channel) / 侧车 spawn  │
│  双闸门终审(xiyueFinalCheck) / 审计日志           │
│  原生插件加载(koffi FFI / node-gyp)              │
└──────┬───────────────────┬───────────────────────┘
       │ HTTP 127.0.0.1:8765   │ koffi FFI / N-API
┌──────▼──────────┐    ┌────────▼────────────────┐
│ Python 侧车      │    │ 14 个原生 helper 插件    │
│ agent/server.py  │    │ C# Native AOT / C++      │
│ Ollama + STT/TTS │    │ 系统控制/媒体/截图/性能   │
└──────────────────┘    └─────────────────────────┘
```

**关键决策**：
1. **从 Tauri 迁移到 Electron**（2026-08-30）：Tauri 的 Rust 学习曲线和原生插件开发成本过高，Electron 生态更成熟、node-gyp/koffi 加载原生代码更方便
2. **自写 Agent 侧车而非嵌入官方 Hermes**：官方 hermes-agent 32,789 行不可干净剥离，自写 Phase 0 精简实现约 600-1000 行核心逻辑
3. **本地为主 AI**：删除腾讯云 STT，改用 faster-whisper + Ollama + kokoro，日常任务数据不出本机；预留云端模型接口应对复杂任务
4. **双闸门安全**：Python policy.py 做工具权限预检，Electron 主进程做最终裁决（xiyueFinalCheck），执行权单一归主进程
5. **原生插件 file: 符号链接注入**：14 个插件通过 package.json 的 file: 依赖符号链接注入，无需发布到 npm

### 4.1.1 架构评估结论（2026-09-10 用户确认）

**架构骨架成立，三个边界不可动**：
1. 渲染层不直连侧车（破坏双闸门）；AI 逻辑放 Python 不放 Node（记忆/whisper/kokoro 生态在 Python）；系统能力放插件不侧车（边界清晰）

**优化优先级（用户确认）**：
- **P0**：Agent 侧车换脑（hermes_core 四模块，记忆落盘）+ Ollama 真流式（消除首字延迟）
- **P1**：插件技术栈收敛——新插件一律 C# Native AOT + koffi（免编译），4 个 node-gyp 中期预编译或迁移，3 个 spawn-EXE 型（brightness/volume/volume-analyzer）评估迁 koffi，孤儿 hardware-info-helper 与半接入 volume-analyzer 接入或删除
- **P2**：云端模型路由层加在侧车（本地 AI 自主决策 → OpenAI 兼容接口），主进程无感知
- **P3**：IPC 283 channel schema 化收敛、侧车 HTTP 换 asyncio（中期，不紧急）
- **明确不做**：渲染层直连侧车、侧车合并进主进程、Node 重写 AI 逻辑

#### v1.2 增量建议（三层架构）
1. **`/health` 增加能力握手**：返回 `schema_version`（工具 schema 版本）与 `capabilities`（stt/tts/vad/wake 是否就绪、模型是否加载中）。主进程据此检测"旧侧车 + 新前端"不匹配，渲染层可显示"语音模型加载中"而不是静默失败。
2. **"HTTP 换 asyncio（P3）"写成触发条件而不是"中期再说"**：ThreadingHTTPServer 是一连接一线程，SSE 长连接 + 8 轮工具循环各占一线程尚可承受；但当**唤醒词常驻监听 + 打断 VAD + 空闲自学习**三个长任务并存时线程模型必然换。没有触发条件的延期等于不做。
3. **侧车日志直接落文件**：Windows 上 Python 子进程崩溃时 stdout 缓冲常丢，建议侧车自带 `data/logs/agent.log` 轮转日志，主进程只管重启与健康握手。

### 4.1.2 Agent 侧车换脑最终方案（2026-09-10 用户确认）

#### 背景：为什么要"换脑"

Xiyue 侧车当前是自写的 Phase 0 精简实现（server.py 622 行），存在三个核心短板：
1. **记忆弱**：SQLite 长期记忆是 Phase 0 stub 且从未接入主链路（仅 3 条测试数据）；L1 工作记忆只有启发式关键词抽取（"我喜欢/记住/…"）+ 24h TTL，无检索排序；prompt 只注入 ≤10 轮历史，无长期记忆能力
2. **情绪/人格缺失**：emotion.py 6 状态情绪机从未被调用，identity.py 只有 calm/tired 两态按时段推断一次后缓存不更新
3. **循环简陋**：无上下文压缩、无错误分类/重试回退、无空响应/重复防护；LLM 非流式调用导致首字延迟 = 完整推理时间（已有 `_MAX_TOOL_ROUNDS=8` 迭代预算，v1.0 误记为"无迭代预算"）

曾考虑三个方案，最终选择方案 A：

| 方案 | 做法 | 结论 |
|---|---|---|
| **A（最终选择）** | 搬入 desk-pet hermes_core 四模块（记忆/情绪/人格/时间），Xiyue 自写循环做定向增强 | 贴合 Xiyue、维护成本低、效果足够 |
| B | 搬官方 Hermes 整套循环（conversation_loop 8400行 + context_compressor 8000行 + tool_executor 2800行）删减修补 | ❌ 紧耦合依赖 200+ 模块，工具执行层不兼容双闸门，通信层不兼容 HTTP/SSE |
| C | 官方 Hermes 作为独立服务运行，Xiyue 调 API | ❌ 失去双闸门安全控制，官方工具与 Xiyue 插件不兼容 |

#### 最终方案：「hermes_core 大脑 + Xiyue 增强循环」混合架构

**一句话**：大脑用 desk-pet hermes_core（你自己 desk-pet 项目里验证过的代码，零第三方依赖），循环和工具在 Xiyue 现有骨架上做定向增强，通信层和双闸门完全保留。

```
┌─────────────────────────────────────────────────────┐
│  Xiyue 渲染层（React 灵动岛）— 完全不变              │
├─────────────────────────────────────────────────────┤
│  Xiyue 主进程 — 完全不变                             │
│  （双闸门终审 / 原生插件 / 窗口管理 / IPC 路由）      │
├─────────────────────────────────────────────────────┤
│  Python 侧车（增强版）                                │
│                                                      │
│  ┌───────────────────────────────────────────────┐  │
│  │ 通信层：HTTP/SSE（保留）+ 真流式（改造）        │  │
│  ├───────────────────────────────────────────────┤  │
│  │ 循环层：Xiyue _run_agent_loop（定向增强）       │  │
│  │  · 错误分类 / 重试回退 / 迭代预算               │  │
│  │  · 空响应防护 / 重复防护                        │  │
│  │  （借鉴官方 Hermes 设计思路，增量约 300 行）     │  │
│  ├───────────────────────────────────────────────┤  │
│  │ 上下文层：记忆注入 + 对话压缩（精简版）          │  │
│  │  · hermes_core memory_service L0-L3 检索注入    │  │
│  │  · 本地 LLM 摘要旧对话（约 300 行）             │  │
│  ├───────────────────────────────────────────────┤  │
│  │ 大脑层：desk-pet hermes_core 四模块（搬入）     │  │
│  │  · memory/（13 文件，完整 L0-L3 记忆系统）      │  │
│  │  · emotion/（4 文件，PAD 情绪 + 激素 + 表情）   │  │
│  │  · soul/（4 文件，HEXACO 人格 + 漂移 + 持久化） │  │
│  │  · time/（4 文件，昼夜 + 纪念日 + 重逢）        │  │
│  ├───────────────────────────────────────────────┤  │
│  │ 工具层：双闸门（保留）+ 工具定义统一（改造）     │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

#### 具体做什么

| 层 | 动作 | 来源 | 预估开发量 |
|---|---|---|---|
| **大脑搬入** | 拷入 memory/emotion/soul/time 四模块 + 基础设施（hermes_constants 路径、sqlite_safe_read 安全读、stubs 消息清洗、WAL 安全补丁） | desk-pet hermes_core | 低（零依赖，拷入 + 改数据库路径） |
| **记忆接线** | server.py 接入 memory_service：对话前 recall 检索相关记忆注入 prompt、对话后 extract_and_store 沉淀事实/偏好、情绪/人格注入 system prompt | hermes_core API | 中（约 200 行接线代码） |
| **上下文压缩** | 自实现精简版：对话超 N 轮时用本地 LLM 摘要中间轮次，保护头尾上下文，按 token 预算截断 | 借鉴官方 Hermes context_compressor 设计思路 | 中（约 300 行，不需要官方 8000 行） |
| **循环增强** | 现有 _run_agent_loop 增量增加：错误分类、重试回退、空响应防护、重复防护（迭代预算 `_MAX_TOOL_ROUNDS=8` 已有，保留并接入统计） | 借鉴官方 Hermes conversation_loop 设计思路 | 中（增量约 300 行） |
| **真流式** | Ollama 调用改 stream=True，SSE 逐 token 推送，去掉当前的"8 字符/20ms 假切片" | Xiyue 改造 | 低（约 50 行） |
| **工具统一** | 19 个内联工具（英文命名 + `_TOOL_POLICY`）+ 16 个 schema 工具（中文命名）合并为单一 schema 定义，解决双轨制；schema 文件本身完好，无需修复编码 | Xiyue 改造 | 中（约 100 行） |
| **云端路由** | 侧车加模型路由层：本地 AI 自主判断任务复杂度 → 本地 Ollama 或云端 OpenAI 兼容接口；设置中显式开启（默认关闭） | 新增 | 中（约 200 行） |
| **通信/双闸门/语音/插件** | 完全保留不变 | Xiyue 现有 | 0 |

#### 为什么这个方案最高效

1. **大脑直接用最强的**：hermes_core 的 memory_service 是 800+ 行的完整 L0-L3 记忆系统（自动学习调度、用户画像生成、离线向量检索），比 Xiyue 自写的未接入版强一个量级，且零第三方依赖、是你自己 desk-pet 项目里的代码
2. **循环不重写只增强**：官方 Hermes 的 8400 行循环里 80% 是 Xiyue 不需要的（代码执行、终端、子代理、MoA、学习图谱），只借鉴需要的 20%（错误处理、重试、预算），增量 300 行
3. **上下文压缩自己实现精简版**：官方 8000 行里大部分是多平台/多模型适配，Xiyue 只需要"本地 LLM 摘要中间轮次"核心逻辑，300 行搞定
4. **双闸门和通信层完全保留**：这是 Xiyue 的核心安全设计和 Electron 集成，不碰就没有兼容性风险
5. **维护成本可控**：侧车代码总量从约 600 行增加到约 1500 行（含接线和增强），可维护；hermes_core 更新时选择性同步四模块改进即可

#### 明确不做（边界）

- ❌ 不搬官方 Hermes 的 conversation_loop / context_compressor / tool_executor（紧耦合 200+ 模块、不兼容双闸门、约 2 万行）
- ❌ 不用官方 Hermes 的 gateway 通信层（WebSocket 多平台，Xiyue 用 HTTP/SSE）
- ❌ 不用官方 Hermes 的工具执行（直接执行，Xiyue 要双闸门终审）
- ❌ 不搬 desk-pet 的 core/pipeline.py（语音流水线，紧耦合 modules/ 第三方依赖）
- ❌ 不引入 SessionDB/FTS5（Phase 2 再说，当前 memory_service 的 SQLite 已够用）
- ❌ 不搬 desk-pet 的 interaction_agg.py（摸头/拍打/踩脚物理互动，Xiyue 灵动岛无此场景）

#### 开发顺序

1. **P0**：搬入 hermes_core 四模块 + 记忆接线 + 真流式（一次解决记忆、情绪、首字延迟三大问题）
2. **P1**：上下文压缩精简版 + 循环增强 + 工具定义统一
3. **P2**：云端模型路由 + 侧车巡检事件驱动 + 审计补全（成功执行路径）

#### 术语解释（供其他阅读者参考）

- **双闸门**：Xiyue 的安全机制——Python 侧车先做工具权限预检（gate/policy.py），Electron 主进程做最终裁决（xiyueFinalCheck），执行权单一归主进程
- **真流式**：LLM 边生成边返回 token（Ollama stream=True），用户立即看到第一个字；当前是"等完整回复后按 8 字符切片"的假流式
- **L0-L3 记忆**：hermes_core 的记忆分层——L0 原始对话、L1 工作记忆、L2 长期事实、L3 用户画像，按相关性检索注入而非全量塞入
- **HERMES_HOME**：hermes_core 的数据目录环境变量，移植后需指向 Xiyue 的数据目录（%APPDATA%\xiyue\data\agent）

### 4.2 Electron 应用层实现

#### 主进程
- **入口** `src/main/index.ts`（1055 行）：负责窗口创建、约 25 个 `register*IpcHandlers` 注册、全局事件管理，并调用 `startXiyueAgent/stopXiyueAgent`；侧车 spawn 与健康巡检本体在 `src/main/services/xiyueAgentService.ts`（`HEALTH_INTERVAL_MS = 30_000`，健康巡检 + 自动重启）
- **IPC 六域**（283 个 channel）：agent（AI 对话/工具/语音）、app（配置/更新/账户，app.ts 2599 行）、media（音乐/SMTC/歌词；`media:get-volume` 硬编码返回 0.5、`media:set-volume` 空实现）、settings（设置读写）、system（系统控制/剪贴板/下载）、window（窗口/灵动岛状态/长截图 capture.ts）
- **双闸门终审**：`src/main/services/xiyueToolSchema.ts` 导出 `xiyueFinalCheck` + `xiyueAuditLog`，由 `ipc/agent/localToolIpc.ts` 和 `ipc/app/app.ts` 两处调用
- **服务层**：SMTC 服务（C# DLL → Worker 线程 → smtcService 三层架构）、通知监听、自动更新等
- **下载引擎**：MultiThreadDownloadEngine，Range 分块 + 并发 fetch + part 文件合并 + 断点续传

#### 预加载层
- `src/preload/`：通过 contextBridge 暴露安全 API 给渲染层，隔离渲染层与 Node.js
- 类型定义在 `src/preload/types/`

#### 渲染层
- **状态机**：`IslandState` 14 个值（含 v1.0 遗漏的 `musicProvidersLogin`）；`src/renderer/components/states/` 下 14 个组件目录（13 个状态态 + `sliderCaptcha` 命令式弹层，不占状态值）
  - 状态转换由鼠标交互（idle→hover→expanded→maxExpand）、音乐事件（→lyrics）、通知（→notification）、语音流程（→stt→agent）、CLI 检测（→cli）、音乐登录（→musicProvidersLogin）驱动
  - 尺寸从 260×42（胶囊）到 860×400（大面板）
  - **状态划分结论（2026-09-10 用户确认）**：`agentVoiceInput`（语音球+声纹，500×42）、`stt`（识别中）、`agent`（对话态）三态保留不合并，各有独立视觉表现；AI 采用"待机预览态（汐月形象+情绪）+ 对话展开态"双态设计
  - **可自定义方向（用户确认）**：hover Tab 与大面板每页对应一个工具，用户可在设置中启用/禁用工具并调整排序；三档尺寸保留默认预设，支持每档自定义宽高；配置跨会话持久化
- **zustand store**：7 个 slice
  - island（灵动岛状态/尺寸/位置）
  - weather（天气数据）
  - timer（倒计时/番茄钟）
  - notification（通知队列）
  - media（音乐播放状态/SMTC）
  - ai（AI 对话状态/流式数据）
  - pomodoro（番茄钟）
- **API 层**：`src/renderer/api/` 下 ai/weather/lyrics/miniGame/tools/update/user/announcement/site 等
- **设置页**：`maxExpand/components/setting/` 下 about/app/index/mail/music/network/pluginMarket/shortcut/update/user/weather 11 个子页面

#### 渲染层优化结论（2026-09-10 用户确认）

1. **zustand slice 合并**：`timer`（倒计时）和 `pomodoro`（番茄钟）合并为一个 `time` slice，pomodoro 作为子模式。其余 5 个 slice（island/weather/notification/media/ai）保留。
2. **全项目 DRY 原则**：跨模块公共代码提取到 `shared/` 或 `utils/`，减少重复。此原则应用于整个项目，不限于渲染层。
3. **分层按域组织**：API 层做一次覆盖率审计，归拢散落的 `window.api.xxx` 直接调用到 `api/` 层；各层（渲染/主进程/侧车/插件）代码按域组织，禁止跨层直接调用，有利于问题查找和安全管理。
4. **设置页新增 `island` 子页**：与现有 11 子页并列，包含：
   - **面板工具管理**：启用/禁用 + 拖拽排序。开发前需先做一次完整工具盘点（灵动岛大面板 15 页 + hover 6 Tab + 工具箱 8 个子工具 + AI 可调用工具），展示到设置页供用户编排。
   - **尺寸自定义**：三档默认预设 + 每档宽高滑块。
5. **ai slice 流式统计完善**：换真流式后，ai slice 增加 `streamingStatus`（connecting/streaming/done/error）、`tokenCount`（本次/累计 token 使用量）、`modelSource`（本地/云端）、`latency`（首字延迟/总耗时）、`toolCalls`（工具调用数组）。token 统计用于上下文压缩判断和用量展示。
6. **用户自定义上传的可替换空间 + 存储位置**：
   - 预留 `xiyue-avatar` 组件目录 + CSS 变量（`--xiyue-avatar-size`、`--xiyue-expression-transition` 等），汐月形象（头像/表情/动画）、主题、音效等用户可上传替换。
   - 存储位置：用户上传的自定义资源统一放在 `%APPDATA%\xiyue\data\custom\`（形象包/主题/音效/壁纸分子目录），与板块 2 存储规划一致。

#### v1.2 增量建议（主进程 + 渲染层）
1. **拆分对象搞错了——先拆 app.ts 不是 index.ts**：index.ts（1055 行）只是注册汇编层；app.ts 2599 行里混着工具执行且 `xiyueFinalCheck` 的两处调用点（`localToolIpc.ts:46`、`app.ts:384`）分散。建议先把工具执行收口成单一 `executeTool()`（预检结果 → 终审 → 执行 → 审计一条龙），板块 11 的"行为监测 + 越权拦截"才有唯一挂点。这是权限体系的地基，应排进 P0a。
2. **IPC 收敛前先清死 channel**：v1.2 实测 284 个注册中 11 个无任何调用方（清单见文首"定向补查"），先删再做 schema 化，且删除 `extension:*` 三个前要先对 volume-analyzer 定案。
3. **显式状态路由表**：`IslandState` 已 14 值，叠加"每页可开关"后转换组合会爆炸。建议把散在各 hook 里的转换规则收口成一张配置（state → 组件 → 尺寸 → 允许转换），它与"工具盘点"是同一份 schema 的两面，一次盘点产出设置页注册表 + 状态路由表两个 artifact。`sliderCaptcha` 那种 `createElement` 直挂 DOM 的命令式弹层保留为登记在册的特例（`useIslandHoverInteraction.ts:126` 还有 DOM 查询特判它），不扩散。
4. **尺寸自定义只开放宽度 + 内容密度档**，高度跟内容走——高度能拉到 800 的灵动岛就失去"低侵入"形态。
5. **SSE 解析做成纯函数 reducer**：事件类型（think/tool_call_request/chunk/final/error）换脑后不变，reducer 喂事件序列即可测试，是"渲染层完全不变"承诺的保障；真流式后新增 `thought` 事件（对应 ollama `message.thinking`）UI 显示为可折叠"思考过程"。
6. **自定义资源定义 manifest**：形象包/音色/主题统一 `zip + manifest.json`（名称/版本/类型/预览图/作者），后期分享导入零成本。
7. **`i18n:check` 加一条规则**：代码内 `t(key, { defaultValue })` 的中文与 zh-CN.json 同 key 不一致即告警——`SliderCaptchaContent.tsx` 已在制造两处中文漂移。

### 4.3 Agent 侧车实现

#### HTTP/SSE API（9 个端点）

| 方法 | 路径 | 用途 | 流式 |
|---|---|---|---|
| GET | /health | 健康检查（返回 ok + 当前模型名） | 否 |
| GET | /identity | 获取身份信息（XiyueIdentityReader.as_dict） | 否 |
| GET | /emotion | 获取情绪状态（state + enabled） | 否 |
| POST | /voice | 服务端录音→STT→LLM→TTS（备用，固定 12s + 能量裁剪） | 否 |
| POST | /chat | 文字对话（完整回复 + TTS audio_b64） | 否 |
| POST | /transcribe | 语音转文字（audio_b64 → faster-whisper） | 否 |
| POST | /chat/stream | 文字对话（SSE 模拟流式 + 工具循环） | 是 |
| POST | /tool-result | 工具执行结果回传（requestId 队列） | 否 |
| POST | /browser | 浏览器自动化（Playwright 6 工具路由） | 否 |

**SSE 事件类型**（5 种）：think / tool_call_request / chunk / final / error

#### Agent 主循环（`_run_agent_loop`）
1. 收到用户消息 → 构建 prompt（persona + `[当前情绪：calm/tired]` + 历史≤10轮 + working_memory 活跃事实≤10条）
2. Ollama qwen3-4b-32k 非流式调用（`stream=False`，带 19 个 tools）
3. 解析回复中的 tool_calls
4. 如需工具：policy.py 预检（`_decide_tool` → `Ctx(current_level=1)` 硬编码信任等级 1）→ 发 tool_call_request 事件（含 authorizationRequired）
5. Electron 主进程终审（xiyueFinalCheck）→ 执行工具 → /tool-result 回传（超时 60s 可 env 配）
6. 循环最多 `_MAX_TOOL_ROUNDS=8` 轮，超限兜底再调一次 LLM 取最终回答
7. 拿到完整回复 → 按 8 字符 + 20ms 人工切片 → chunk 事件推送
8. final 事件（含 TTS audio_b64）结束 → 写 history.json → `_extract_and_store_facts` 抽取写 working_memory.json

> 一致性问题：`_llm_reply`（/chat、/voice 路径）会剥离 qwen3 `</think>` 思考段，`_run_agent_loop`（/chat/stream 路径）不剥离，两条路径行为不一致。

#### 记忆系统
- **L0 对话历史**：history.py → `history.json` 持久化（读写上限 200 条消息），侧车重启不丢；prompt 注入 `max_history_turns=10`（xiyue.json 可配）。正常工作
- **L1 工作记忆**：working.py → `working_memory.json`，每条带 id/text/source/importance(1-5)/created_at/expires_at（默认 TTL 24h）
  - **已接入**：server.py 在 `/chat` 与 `/chat/stream` 两路均调用 `get_active_facts(min_importance=1, max_items=10)` 注入 prompt；对话后 `_extract_and_store_facts` 按关键词启发式（"我喜欢/记住/我习惯"、实体名、助手承诺、工具结果）`add_fact(importance=3)`
  - **缺口**：`clear_expired()` 被导入但从未调用——过期条目读取时被过滤，但文件持续积累；当前 1 条 source=test 的过期测试条目（2026-09-01 建，09-02 过期）
- **L2 长期记忆**：store.py → `memory.db`（SQLite），**Phase 0 stub，add/search/forget/count 从未被调用**，3 条手动测试数据（"用户喜欢简洁直接的沟通"等）
  - 实际 schema：`memory` 表（id/kind/content/embedding BLOB/created_at）+ `memory_meta` 表（key/value，0 行）
  - 数据路径：`DB_PATH = resolve_data_dir() / "memory.db"`，`resolve_data_dir()` 按 `XIYUE_DATA_DIR` 环境变量 > 仓库 `data/` 收口；**代码中不存在 v1.0 所述的 `_DEFAULT_DB_PATH`**（该名称属于 desk-pet hermes_core 的 store.py）
  - `resolve_data_dir()` 是 store.py 唯一被引用的函数（server.py / history.py / working.py / tts.py 均用它定位数据目录）；docstring 已自述"Phase 2 整体替换为 desk-pet L0-L3 引擎，不要在其上做复杂演进"

#### 情绪系统
- **identity.py**：2 状态（calm/tired），`_infer_emotion()` 按本地时间推断（23:00-6:00 → tired，否则 xiyue.json `default_state=calm`），首次调用后缓存到 `_current_emotion` 不再更新；`set_current_emotion` 存在但主链路无调用。已注入 prompt（`[当前情绪：X]`）
- **emotion.py**：71 行，6 状态 `compute_emotion(ctx, prev)`，**从未被调用**

#### 权限 gate
- `gate/policy.py`：纯函数 `decide(tool, params, ctx)` → ALLOW/CONFIRM/DENY，五步裁决（凭据强制确认 → 等级越权 → 外部内容注入防护 → 工具自身需确认 → 放行）
- server.py 侧 `_TOOL_POLICY` 为 19 个工具声明 (meta, risks, confirm)，`_decide_tool` 固定 `Ctx(current_level=1)`——**四级信任模型实际只用到 L1，L2/L3 未接线**
- 双闸门：Python 预检 → Electron 主进程 xiyueFinalCheck 终审 → xiyueAuditLog 审计（logs/xiyue-tools.log）
- 文档腐旧：policy.py docstring 仍写"Rust 侧在执行前用同一份 tool_schema.json 终审"，server.py 头部仍写"由 Rust 外壳拉起与守护"，均为 Tauri 时代残留

#### 工具系统
- **内联定义**：server.py `TOOL_DEFS` 19 个（file.read/list/stat/search/grep/write/delete、cmd.exec、clipboard.read、sys.info、monitor.cpu/memory、net.ping、browser.open/screenshot/navigate/click/fill/scroll），命名对齐渲染层 `CLIENT_LOCAL_TOOL_PREFIXES`
- **Schema 定义**：schemas/tool_schema.json，**合法 UTF-8 JSON**（2.5KB），顶层 version/default_level/policy/tools，16 个**中文命名**工具（列目录/读文件/搜索文件/整理重命名/移动文件/删除(回收站)/打开应用/关闭应用/系统状态/设提醒/查日程/运行命令/浏览器自动化/批量文件处理/代码辅助/代发消息）——与内联定义命名空间完全不同；`agent/tools/__init__.py` 提供 `load_registry/get_tool` 加载器但**无任何引用**。v1.0 所述"编码损坏"不成立
- 浏览器工具：Playwright 6 个（open/screenshot/navigate/click/fill/scroll），`_run_browser_tool` 路由；xiyue.json `browser.allowed_domains` 白名单**未被 playwright_client.py 读取校验**

#### Agent 侧车优化结论（2026-09-10 用户确认）

1. **API 端点清理**：废弃 `/voice`（服务端固定录 12 秒，延迟不可接受，主路径是渲染层录音→`/transcribe`）；`/emotion` 换脑后返回 hermes_core 完整 PAD 情绪状态；其余 8 个端点保留。
2. **主循环换脑**：prompt 组装从"persona+历史+working_memory"改为"persona+记忆检索(recall)+情绪状态+人格画像+历史摘要"；工具调用解析和双闸门流程保留；增加上下文压缩判断；真流式替换假切片。
3. **记忆系统迁移**：L0 历史保留（当前 history.json 已持久化、重启不丢，非新增能力）但迁入 SQLite 统一存储；L1 working_memory.json（含现有启发式抽取 `_extract_and_store_facts`）和 L2 memory.db 被 hermes_core memory_service 统一替代（L0-L3 分层，存 core.db）；旧 memory.db 和 working_memory.json 废弃。
4. **情绪系统迁移**：identity.py 2 状态和 emotion.py 6 状态全部废弃，换用 hermes_core emotion 模块（PAD 三维情绪 + 激素系统 + 表情引擎），情绪随对话自动更新。
5. **工具双轨制统一**：19 个内联工具 + 16 个 schema 工具合并为单一 schema 定义（schema 文件本身完好，重点是命名空间与权限元数据统一），server.py 启动时从 schema 加载，新工具按 schema 模板添加；同时把 xiyue.json `browser.allowed_domains` 真正接到 playwright_client 校验。
6. **权限 gate 与审计**：policy.py 预检保留，基于统一工具 schema 做判断；`Ctx(current_level=1)` 硬编码改为从设置读取信任等级；补全成功执行路径审计；审计日志增加 token 用量、模型来源、耗时字段；顺手清理 policy.py/server.py 中"Rust 终审/Rust 外壳"的腐旧 docstring。

#### v1.2 增量建议（Agent 侧车）
1. **用 ollama 原生 `think` 参数替代手工剥离**：ollama 0.6.2 已支持 `chat(think=...)` 且思考内容在 `message.thinking` 独立字段，两条回复路径的 `<think>` 剥离逻辑可以整个删掉。语音场景（/voice、语音球触发的对话）建议 `think=False` 直接关闭 qwen3 思考，首字延迟会显著下降；文字对话可 `think='low'` 并把 thinking 作为 `thought` SSE 事件流给 UI。
2. **`/tool-result` 授权等待不应占用工具超时**：现在 `_TOOL_RESULT_TIMEOUT_S=60` 统一超时，`authorizationRequired=true` 时用户几分钟不点确认就静默失败、LLM 拿到"超时或未获授权"继续跑，用户毫不知情。建议拆成"授权等待（无超时或很长，可取消）"与"执行超时（60s）"两段，且超时后发 SSE 事件让 AI 能得体回应"你还没确认，需要我等吗"。
3. **两条回复路径合并为单一入口**：`_llm_reply`（/chat、/voice）与 `_handle_chat_stream` 的 prompt 组装、记忆注入、历史回写各写了一遍且已经出现行为分叉（工具指令只在 stream 路径有）。换脑时统一为一个 `run_turn(text, stream: bool)`，避免维护两套 prompt。
4. **循环增强的错误分类直接沿用 MCP 的两分法**：协议错误（未知工具/参数不合法，LLM 应换工具或修参数）vs 执行错误（`isError: true`，可重试或换路径），错误信息回灌给模型让其自纠——这是 ReAct 型框架的通用做法，不需要引入框架。
5. **API 参考文档从代码生成**：端点表由 server.py 路由（或换 FastAPI 后的 OpenAPI）导出，别手写第三次。

#### API 统一管理与文档规范（2026-09-10 用户确认）

- **API 参考文档**：新建 `docs/Agent_API_Reference.md`，包含所有端点的：请求方法/路径、请求参数（类型+必填+说明）、响应格式（成功/失败）、错误码、SSE 事件类型、调用示例。换脑后端点变更时同步更新此文档。
- **API 变更管理**：API 改动必须更新参考文档，并在文档末尾维护"变更记录"（日期、端点、变更内容、原因）。
- **API 覆盖率**：确保渲染层/主进程调用的每个侧车 API 都有对应端点；定期做一次"调用方 vs 端点"对账，防止有调用无接口或有接口无调用。
- **工具定义文档**：统一后的工具 schema 同步在 API 文档中列出（工具名、参数、权限等级、说明），工具新增/修改时同步更新。

#### 记忆系统（hermes_core memory/，2026-09-10 用户确认）

换脑的核心模块。`memory/` 目录 13 个文件，是完整的 L0-L3 分层记忆系统，零第三方依赖。

**文件职责**：
| 文件 | 职责 |
|---|---|
| `memory_service.py`（800+行） | 统一入口，所有记忆读写收口于此 |
| `store.py` | SQLite + 向量列存储（`_DEFAULT_DB_PATH` 硬编码，移植需改造） |
| `librarian.py` | 检索：向量 + 关键词 + 重要性融合排序 |
| `scribe.py` | 离线规则抽取（无需网络/模型，从对话中提取事实/偏好/事件） |
| `embedding.py` | LocalHashEmbedder 纯 Python 离线向量（零依赖） |
| `hebbian.py` | 赫布共激活强化（同时检索到的记忆连接增强） |
| `decay.py` | Ebbinghaus 遗忘曲线（长期不用的记忆权重降低） |
| `learning_scheduler.py` | 空闲自学习调度（聊天结束入队，空闲批量抽取） |
| `archivist.py` | 归档（旧记忆压缩归档） |
| `knowledge.py` | 知识库管理 |
| `fragment.py` | 记忆碎片数据模型（分层+分类+重要性+永久标志） |

**分层（L0-L3）**：
- L0 原始对话片段（短期，回退用）
- L1 原子事实（工作记忆，单条 ≤500 字符）
- L2 场景聚合（话题簇，累计 8 条新记忆触发）
- L3 用户画像（自动生成四章画像 ≤1200 字，累计 25 条触发）

**分类（8 种 category）**：fact（事实）、preference（偏好）、rule（约定规则，可禁用）、feedback（反馈）、event（事件）、raw（L0 原始）、scene（L2 场景）、persona（L3 画像）。L1 还有子类型：persona（稳定属性）、episodic（客观经历）、instruction（全局指令）。UI 上按 category 分组展示，用户可手动增删改。

**自动整理机制**：
- **归档**（archivist.py）：旧记忆自动压缩归档
- **空闲自学习**（learning_scheduler.py）：每轮对话结束后入队，侧车空闲时后台批量抽取记忆入库，完全不阻塞对话响应；队列持久化到 `learning_queue.jsonl`，崩溃重启可续跑
- **自动分层聚合**：累计 8 条新记忆触发 L2 场景聚合，25 条触发 L3 用户画像更新
- **应激模式**：系统高负载时暂停后台抽取（队列仍缓冲不丢数据），负载恢复后继续

**自学习与记忆沉淀**：
- 记忆自学习：learning_scheduler + scribe 离线抽取（有 LLM 时用 LLM 抽取质量更高，无 LLM 时回退离线规则）
- 最低重要性阈值 0.3，低于此不存
- L0 原始对话保留 200 条/角色

**技能系统（官方 Hermes 机制 + Xiyue 轻量版）**：
- 官方 Hermes 技能本质："Skills are the agent's procedural memory"——捕获"怎么做某类任务"的程序性知识，与陈述性记忆（事实/偏好）互补
- 官方机制：每个技能是目录（SKILL.md + references/ + templates/ + scripts/ + assets/），按分类组织；`skill_manager_tool.py` 允许 Agent 自己创建/编辑/删除技能，把成功方法沉淀为可复用技能
- 官方配套庞大（skills_hub 179KB + skill_manager 71KB + skill_usage 51KB + skills_guard 46KB），紧耦合 gateway/cli，不搬
- **Xiyue 轻量版方案（P2）**：技能目录 `%APPDATA%\xiyue\data\skills\` + 技能管理设置页（展示/启用禁用/自创/导入）+ Agent 可通过工具自创技能。换脑和记忆跑通后再做

**记忆容量与注入预算**：
- 存储无硬性上限（SQLite，受磁盘限制；1 万条约 5MB）
- 注入预算 `INJECTION_BUDGET = 1800` 字符：每次对话只注入 1800 字符以内的相关记忆（按重要性排序截断），不是全量塞给 LLM
- 遗忘机制自动清理旧记忆，不会无限增长

**遗忘系统（Ebbinghaus 遗忘曲线）**：
- 公式：`新重要性 = 旧重要性 × (1 - 0.1 / (1 + 访问次数 × 0.1))`——被频繁访问的记忆遗忘更慢
- 四阶段：Active（0-14天，正常）→ Cooling（14-30天，降温）→ Frozen（30-90天，冻结，删除向量省空间）→ Tombstone（90+天，墓碑，内容清除可清理）
- 永久记忆（`is_permanent=True`）：跳过遗忘曲线，永远 active，不会被归档清理。典型永久记忆：用户手动标记的重要记忆、rule 类约定、L3 用户画像。UI 提供"标记为重要/永不遗忘"按钮
- 遗忘阈值先用默认值（14/30/90 天），跑一段时间后根据实际效果调整

**记忆重要性计算**：
- 抽取时：规则匹配预设重要性（如"我叫XX"=0.75、"我喜欢"=0.7、"记住/约定"=0.78）；LLM 抽取时可评估
- 访问时：被检索到 `access_count+1`，遗忘速度减慢
- 遗忘时：按 Ebbinghaus 公式衰减
- 永久记忆不衰减，最低保持 0.5

**共激活强化（Hebbian 网络）**：
- 基于"一起激活的神经元连接更强"，`hebbian_connections` 表记录记忆两两连接强度
- 流程：用户提问 → 检索到 N 条相关记忆 → 两两连接增强（strength += 0.1，上限 1.0）→ 每条 access_count+1 → 关联记忆也得到重要性提升（new_imp = min(1.0, old + 0.1 × connection_strength)）→ 后台定期连接衰减（×0.95），低于 0.01 删除
- 效果：经常一起被提到的记忆形成强连接，检索到一条时另一条也被激活——模拟人脑联想记忆

**迁移决策（6 项）**：
1. 记忆库用 `core.db`（hermes_core 原生命名），放 `%APPDATA%\xiyue\data\agent\memory\core.db`；旧 `memory.db`（3 条测试数据）废弃不迁移
2. P0 先启用 L0-L2，L3 用户画像自动生成放 P1
3. 自动学习阈值先用默认（SCENE_EVERY=8, PERSONA_EVERY=25），跑后再调
4. P0 用 LocalHashEmbedder（纯 Python 离线零依赖）；P2 评估接入真正 embedding 模型
5. 注入预算先用 1800 字符，qwen3-4b-32k 上下文足够
6. 旧数据（working_memory.json 1 条过期、memory.db 3 条测试、history.json 空）全部废弃，干净起步

#### v1.2 增量建议（记忆系统）
1. **移植第一天必须验证 LocalHashEmbedder 的中文召回**：哈希向量若按空格/标点切 token，中文没有空格分词，检索会**静默劣化**（不报错、只是查不准）。拿 10 条中文记忆做 recall 测试，失效则加字符 2-gram 或 jieba 切词后再哈希。这是整个换脑里最容易被忽略、又最影响效果的单点风险。
2. **注入预算 1800 字符偏保守**：qwen3-4b-32k 有 32k 上下文，1800 字符约 1000 token；建议 3000 起步，并把预算做成设置项而不是常量。
3. **记忆写入"不打断、可反悔"**：写入后用通知条提示"汐月记住了：XX"，点击可删——信任感是这类产品的核心资产。Letta 的记忆块（persona/human 常驻上下文）+ 归档段落可检索的分层与 hermes_core L0-L3 同构，验证了方向；Open-LLM-VTuber 接 Letta 后明确承认"增加对话延迟"，说明 recall 必须异步或限时（建议 recall 超过 200ms 即降级为仅注入 L1 常驻块）。
4. **先冻结现有 L1 抽取的行为基线**：`_extract_and_store_facts` 已在生产链路运行，换成 hermes_core scribe 前先留 20 条真实对话样本，对比两者抽取质量，避免"换脑后不如原来"。
5. **数据目录收口与换脑合并成同一条迁移路径**：避免 core.db 先落仓库 data/、再迁 %APPDATA% 的两次迁移。

#### 情绪与身份系统（hermes_core emotion/ + soul/ + time/，2026-09-10 用户确认）

**emotion/ 模块（4 文件）**：
| 文件 | 职责 |
|---|---|
| `emotion.py` | PAD 三维情绪模型：Pleasure（愉悦度 -1~+1）、Arousal（唤醒度 -1~+1）、Dominance（支配度 -1~+1）。不可变值对象，EmotionState 包含 PAD + 激素 + 基线 |
| `hormones.py` | 激素系统：多巴胺（愉悦/动力，半衰期5min）、皮质醇（压力/警觉，半衰期3min）、催产素（依恋/信任，半衰期10min）。各有触发事件、相互抑制、对 PAD 的影响映射 |
| `expression.py` | 情绪→语言风格映射：8 种情绪标签（开心/悲伤/焦虑/平静/兴奋/愤怒/疲惫/温和）→ 语气/用词/句长/主动度，注入 LLM Prompt 让回复风格随情绪变化 |

**soul/ 模块（4 文件）**：
| 文件 | 职责 |
|---|---|
| `personality.py` | HEXACO 六维人格：诚实-谦逊/情绪性/外向性/宜人性/尽责性/开放性（0~1）。人格→PAD 情绪基线映射（外向高→愉悦基线高，情绪性高→唤醒波动大） |
| `soul_file.py` | .soul 角色配置文件（YAML）：定义名字/人格/MBTI/身份/兴趣/说话风格/口头禅/核心价值观 |
| `drift.py` | 人格动态漂移：长期互动→人格微变化（正向互动→宜人性升，高压力→情绪性升），每次 ±0.005~0.02，基线约束 ±0.3，数百次互动才明显 |

**time/ 模块（4 文件）**：昼夜节律（不同时段情绪基线不同）、纪念日（特殊日期触发情绪变化）、重逢（久别后重新对话的情绪变化）。

**迁移决策（6 项）**：
1. P0 启用 PAD 三维情绪 + expression 语言风格映射；激素系统放 P1（增加真实感但复杂度高）
2. 用 HEXACO 六维，UI 简化为中文性格滑块（背后映射 HEXACO 维度）；.soul 文件放 `%APPDATA%\xiyue\data\soul\xiyue.soul`
3. 人格漂移 P2 启用，默认开启，设置里提供关闭开关和重置按钮
4. time/ 模块：P1 启用昼夜节律；纪念日和重逢放 P2
5. prompt 组装顺序：人格设定（.soul）→ 当前情绪状态（PAD+标签）→ 记忆检索结果 → 对话历史。记忆的 emotion_snapshot 字段用于情绪匹配检索
6. 汐月初始人格：诚实-谦逊 0.75、情绪性 0.65、外向性 0.60、宜人性 0.85、尽责性 0.65、开放性 0.80；MBTI ENFJ；说话风格温柔细腻偶尔俏皮。用户可在设置调整

**关键安全原则：情绪影响表达，不影响决策（2026-09-10 用户确认）**

情绪与身份系统不是孤立的，它和其他模块结合，但有严格边界：

- **情绪影响表达**：通过 expression.py 注入语气/用词/句长/主动度，让回复风格随情绪变化（开心时轻快、悲伤时温柔、焦虑时谨慎）。TTS 语音语气也可随情绪调整。
- **情绪影响主动性**：情绪可以影响"是否主动发起对话"（开心时更主动问候，疲惫时更安静），但不影响"执行什么操作"。
- **情绪不影响决策**：工具调用的决策基于用户意图和工具定义，**完全不受情绪影响**。双闸门安全机制（policy.py 预检 + 主进程终审）独立于情绪——汐月生气时也不能删用户文件，焦虑时也不能跳过权限确认。
- **实现方式**：情绪状态只注入到 prompt 的"风格部分"（system prompt 的表达指令），不注入到"决策部分"（工具定义、权限规则）。工具执行路径和情绪状态完全解耦。
- **情绪与记忆结合**：记忆创建时记录 emotion_snapshot（当时的 PAD），检索时情绪匹配的记忆优先级略高（开心时更容易检索到开心时聊的话题）。
- **情绪与人格结合**：人格决定情绪基线（外向的人默认更愉悦），情绪是基线之上的波动。

#### v1.2 增量建议（情绪与身份）
1. **EmotionState 做成不可变值、每轮由"基线 + 事件增量"重算**，事件驱动而非轮询。反面教材就是 identity.py 的 `_current_emotion` 全局缓存——首次推断后永不更新。hermes_core 激素半衰期设计天然适合"事件 → 脉冲 → 自然衰减"，即使 P0 不上激素也按这个模型搭骨架。
2. **"情绪影响表达"在形象包就绪前有一个 20 行的快速出口**：tts.py 第 48 行 kokoro 的 `speed=1.0` 参数就在那，做情绪 → speed/停顿映射（开心 1.1、疲惫 0.9、焦虑加短停顿），TTS 立刻可感知，比等二次元形象快得多。
3. **SenseVoice 的情绪标签可作为情绪输入信号**：Open-LLM-VTuber 默认的 sherpa-onnx + SenseVoiceSmall 能在转写时输出说话人情绪/事件标签，若后续 STT 评估切到它，用户语音情绪可直接喂给 PAD 事件——语音链路与情绪系统的天然接口。

### 4.4 语音链路实现

```
录音（渲染层 getUserMedia，主路径）
  → /transcribe → faster-whisper base（CPU int8，138MB 模型）
  → 文本 → /chat/stream → Ollama
  → 回复文本 → kokoro TTS（zf_xiaobei，24k wav）→ pyttsx3 兜底
  → 渲染层播放
```

- **STT**：faster-whisper 1.2.1 base 模型，默认 CPU int8 推理（`XIYUE_STT_DEVICE=cuda` 可切 GPU，int8_float16；GPU 推理失败自动降级 CPU 重试），模型目录 `data/models/faster-whisper-base/` 142MB；`transcribe()` 未传 `vad_filter`，即 faster-whisper 内置 Silero VAD 也未启用
- **TTS**：kokoro 0.9.4 合成 24kHz wav，音色 zf_xiaobei；pyttsx3 2.99 作为兜底（系统 SAPI）；docstring 记录设计目标为 CosyVoice V3
- **VAD**：`voice/vad.py` 引用 `silero_vad` 包，但 **.venv 未安装 silero-vad**（pip list 无），该文件当前 import 即失败；server.py 也未引用它
- **唤醒词**：wake.py 8 行，`listen_for_wakeword` 函数体为 `...`，docstring 规划"自训中文 KWS，Phase1 实现"
- **备用路径**：服务端 sounddevice 固定录 12 秒 → 能量阈值裁剪首尾静音 → /voice，延迟不可接受，不推荐

#### 语音链路优化结论（2026-09-10 用户确认）

1. **STT**：本地 faster-whisper base 保留（138MB，CPU int8，日常指令够用）；设置里提供更大模型选项（small 466MB / medium 1.5GB，用户按需下载）；云端 STT 作为备选（设置显式开启，OpenAI 兼容 whisper API）
2. **TTS**：本地 kokoro 保留（zf_xiaobei，24k）；增加 2-3 个内置音色（温柔/活泼/成熟）；用户可上传自定义音色（`%APPDATA%\xiyue\data\custom\voices\`）；云端 TTS 作为备选（设置显式开启）
3. **VAD 接入（P0）**：先 `pip install silero-vad`（当前未安装）并加入 requirements，再接入 silero-vad，实现"说完自动停止录音并发送"（连续 1.5 秒静音自动结束）。设置里提供手动模式/自动模式切换。低成本备选：先在 `stt.transcribe()` 打开 faster-whisper 内置 `vad_filter=True` 过滤静音段（零新依赖），端点检测再用独立 silero-vad
4. **唤醒词（P2）**：用 openWakeWord 或 porcupine 实现本地唤醒词，默认"嘿汐月"，用户可自定义。唤醒后进入语音球状态，VAD 自动发送。设置里提供开关
5. **tmp/tts 自动清理（P0）**：TTS 生成的 wav 播放后立即删除（或保留最近 10 个，超量删最旧）。临时文件统一放 `%APPDATA%\xiyue\tmp\tts\`，应用退出时清理全部 tmp
6. **语音球与声纹波形**：`agentVoiceInput` 独立状态（500×42，苹果风格语音球+声纹波形，板块 3 已确认）。声纹波形用录音实时音量数据驱动（Web Audio API），不需要额外模型

#### v1.2 增量建议（语音链路，⚠️ 第 1 条覆盖上面结论 3）
1. **端点检测走渲染层，silero-vad 降级到 P2 打断场景**（方案级建议 C）：`useAgentVoiceInputRuntime.ts` 的 `ScriptProcessorNode` 回调里已有逐帧 Float32 样本 + 1 分钟自动截断，加 RMS + 连续 1.0-1.5s 低于阈值即 `stopAll()`，约 30 行；设置里保留手动/自动切换。参考 Pipecat 默认参数 `stop_secs 0.2 / confidence 0.7 / min_volume 0.6`，助手场景 stop 放宽到 1.0-1.5s。ScriptProcessorNode 已废弃，中期迁 AudioWorklet 时把 RMS 一起迁过去。
2. **TTS 不落盘**：`audio_b64` 已随 `final` 事件回传，渲染层直接播 blob；侧车 `TTS_DIR` 落盘改为仅调试开关。这直接消灭债务 #5，而不是"定期清理"它。
3. **STT 模型管理复用自家基建**：faster-whisper small/medium 从 HuggingFace 拉在国内不稳；模型镜像到已有 COS/OSS（`release:upload` 脚本现成）+ 用自家 `MultiThreadDownloadEngine` 下载校验，别直连 HF。升级路径可选 `BatchedInferencePipeline`（默认 `vad_filter=True` + 批处理加速）。
4. **评估 sherpa-onnx + SenseVoiceSmall 作为 STT 对照候选**：Open-LLM-VTuber 的默认本地 ASR，CPU 可跑、中文识别强、自带情绪/事件标签（见情绪建议 3）。不是替换，是做一次同样本对比后再定。
5. **唤醒词"嘿汐月"的现实约束**：openWakeWord 预训练模型仅英文且 CC BY-NC-SA 非商业，中文必须自训；训练正样本全靠 TTS 合成数千条——**用项目自带 kokoro 批量合成"嘿汐月"即可**，Windows 推理走 onnxruntime（venv 已有）。Porcupine 支持中文自定义词但闭源需 AccessKey。建议 P2 选 openWakeWord + kokoro 自训。
6. **打断（barge-in）与唤醒词一起在 P2 做**：TTS 播放期间持续跑 silero-vad，检测到用户插话即停播并取消在途 LLM/工具——Pipecat 的做法；最难的是回声（自己的 TTS 被麦克风收回），需要在播放期间提高 VAD 阈值或做 AEC。

### 4.5 原生插件实现

**14 个插件目录**（命名仍保留 eisland 前缀，历史遗留；package.json `file:` 依赖 12 个，构建脚本覆盖 13 个）：

| 插件 | 功能 | 语言 / 产物 | 加载方式 |
|---|---|---|---|
| application-icon-helper | 应用图标提取（PID/进程名/快捷方式） | C# Native AOT DLL | koffi FFI |
| bluetooth-helper | 蓝牙监控与设备管理 | C# Native AOT DLL | koffi FFI（双实现：src + bt-ctypes） |
| brightness-helper | 亮度调节（DDC/CI + WMI） | **C# EXE**（net10.0，非 AOT） | **child_process spawn + daemon.js 常驻 serve** |
| fullscreen-detector | 全屏检测 | C | node-gyp N-API |
| hardware-info-helper | 硬件信息读取（WMI） | **C# EXE** | **孤儿，未集成**（不在 deps / 构建脚本 / src 引用中） |
| performance-monitor | 性能监控（CPU/内存/温度） | C + C# temperature-helper EXE | node-gyp N-API + spawnSync 温度 EXE |
| power-helper | 电源状态监控 | C# Native AOT DLL | koffi FFI（双实现：src + pw-ctypes） |
| processes-attacker | 进程管理（结束进程） | C | node-gyp N-API |
| screenshot-helper | 屏幕截图（GDI BitBlt P/Invoke） | C# Native AOT DLL | koffi FFI（`window/screenshotHelper.ts` 加载，desktopCapturer 回退） |
| smtc-helper | SMTC 媒体控制 | C# Native AOT DLL | koffi FFI（双实现：src + smtc-ctypes） |
| toast-listener | Windows Toast 通知监听 | C++ | node-gyp N-API |
| volume-analyzer | 音量可视化分析（WASAPI loopback） | **C# EXE** | **spawn EXE**（无 koffi）；注册为可选下载扩展（extensionRegistry），**主进程无静态集成**、不在 deps |
| volume-helper | 音量控制（CoreAudio COM） | **C# EXE**（非 AOT） | **child_process spawn + daemon.js 常驻 serve** |
| wifi-helper | WiFi 状态监控 | C# Native AOT DLL | koffi FFI（双实现：src + wf-ctypes） |

**加载方式说明**（v1.1 修正：v1.0 的"9 个 C# koffi"把 brightness/volume/volume-analyzer 三个 spawn-EXE 型误归入 koffi 组）：
- **C# Native AOT DLL + koffi FFI（6 个）**：icon / bluetooth / power / screenshot / smtc / wifi。C# 编译为 Native AOT DLL，通过 koffi 加载，无需 node-gyp；4 个 `*-ctypes` 子目录是给非 koffi 消费方的 C 导出变体
- **C# EXE + child_process spawn（4 个，含孤儿）**：brightness / volume（常驻 daemon）、volume-analyzer（stdio 管道逐行读数据）、hardware-info（未接）。csproj `OutputType=Exe`、无 PublishAot、package.json 不依赖 koffi
- **C/C++ node-gyp N-API（4 个）**：fullscreen / processes / toast / performance-monitor（后者混合 C# 温度 EXE），需本机编译
- **常驻 serve 模式**：brightness-helper 和 volume-helper 各有 `daemon.js`（`HelperDaemon` 类：stdin/stdout 行式 JSON、握手超时 15s、崩溃重启），避免每次 spawn 冷启动（126~380ms），实测 get 3.1/2.3ms、set 9.4/8.1ms，约提速 40 倍（汐月Electron版现状.md:113，commit d42c9c4）
- **打包分发**：electron-builder.json `extraResources` 只打包 brightness/volume 两个 helper；koffi 型随 node_modules；volume-analyzer 走 zip 扩展下载

#### 原生插件优化结论（2026-09-10 用户确认）

**1. 插件权限声明与首次授权（P0）**
- 每个插件在 schema 中声明所需权限（如：文件系统读/写/删除、进程管理、网络访问、系统设置修改、剪贴板、截图）
- 首次使用插件时弹出授权提示：说明插件名、需要什么权限、为什么需要，用户选择允许/拒绝
- 授权后生成通行证（单次/会话/时间/永久，与板块 10 通行证系统一致）
- 用户可在设置页随时查看和撤销已授权的插件权限

**2. 插件权限使用记录（P0）**
- 每次插件调用记录：时间、插件名、操作类型、使用的权限、参数（脱敏）、执行结果、耗时
- 记录到审计日志（`%APPDATA%\xiyue\logs\audit\`），与板块 10 审计体系统一
- 设置页提供"插件权限使用记录"查看器：按插件/时间/权限筛选

**3. 插件行为监测与越权拦截（P1）**
- 插件调用必须经过主进程中转，插件不直接调用系统 API
- 主进程校验插件调用是否在已授权的权限范围内——越权调用直接拦截并记录告警
- 异常行为检测：如截图插件突然尝试读取文件、音量插件突然尝试结束进程，立即拦截并通知用户
- 监测数据统计：每个插件的越权尝试次数、被拦截次数

**4. 危险操作的还原能力（P1）**
- **文件删除**：不直接永久删除，先移到 Windows 回收站，用户可还原
- **设置修改**：记录修改前的值，提供"撤销最近操作"功能（保留最近 20 条可撤销操作）
- **进程结束**：记录被结束的进程名和路径，提供"重启进程"选项
- 统一的"操作历史"页面：查看最近操作，可一键还原/撤销

**5. 插件管理统计页面（P2）**
- 设置页"插件"子页展示：已安装插件列表、版本、加载方式、启用/禁用开关、常驻状态、内存占用
- 统计数据：每个插件的调用次数、最近使用时间、累计耗时、权限使用次数、越权拦截次数
- 用户可禁用不需要的插件减少资源占用

**6. node-gyp 插件预编译（P1）**
- 为 4 个 node-gyp 插件提供预编译二进制（prebuild-install），CI 自动构建 Windows x64
- 用户安装时直接下载，不需要 VS Build Tools（解决高优先级技术债务 #6）

**7. 孤儿/半接入插件处理（P1）**
- hardware-info-helper：确认性能监控页面是否需要详细硬件信息，需要则集成（spawn EXE 方式），不需要则删除
- volume-analyzer：当前"可选扩展注册 + 构建脚本存在，但主进程零消费者"，同样需明确结论——要么在渲染层接上音量可视化消费方，要么从构建脚本与 extensionRegistry 移除
- 当前"写了但没接"的状态不可接受，必须有明确结论
- 技术栈收敛（与 4.1.1 P1 一致）：现状是三种加载方式并存（koffi DLL / spawn EXE / node-gyp）。新插件一律 C# Native AOT + koffi；brightness/volume 两个 spawn-EXE 型可评估迁 koffi（是否保留 serve 模式需对比实测）

**8. 常驻 serve 模式推广（P2）**
- 评估高频调用插件推广常驻模式：候选 screenshot-helper（长截图）、application-icon-helper（图标提取）
- 每个常驻 daemon ~10-20MB 内存，换取速度提升；低频插件不推广

**9. 命名去 eisland 化（P2）**
- 统一重命名为 `xiyue-` 前缀，同步更新所有引用（package.json、主进程、preload、渲染层）
- 品牌一致性，不紧急但应该做

**10. 插件安全审计（P1）**
- 14 个插件做一次安全审计：参数校验（防注入）、最小权限、错误处理（不崩溃主进程）
- 审计结果写入 `docs/Plugin_Security_Audit.md`，后续新插件按清单检查

#### v1.2 增量建议（原生插件）
1. **越权拦截的前提已经成立**：v1.2 实测渲染层/preload 对 `@eisland/*` 零 import，所有插件调用本来就经主进程——不需要"改造为中转"，只需在主进程加统一的 `callPlugin(name, op, args)` 收口做记录与校验。
2. **node-gyp 预编译提前到 P1 最前，并与"去 eisland 化"绑定为同一次破坏性变更**：预编译发布时顺便换包名，避免两次改 package.json 依赖与全部引用。
3. **volume-analyzer 必须定案**：它既非孤儿（有构建脚本、有扩展注册）也未接入（主进程零消费者，`extension:install/list/uninstall` 三个 IPC 无调用方）。要么在渲染层接上音量可视化消费方并做扩展安装入口，要么从构建脚本、extensionRegistry 和 IPC 一并移除。
4. **`file.delete` 走回收站已验证**（`app.ts:1342` `shell.trashItem`），板块 11 "危险操作还原能力"里删除这一项已满足，剩下的是"设置修改可撤销"和"进程重启"。
5. **插件安全审计做成 CI 脚本而不是一次性人工**：参照现有 `comment:check` / `i18n:check` 模式，检查项：csproj 是否 AOT、index.js 是否有参数校验、spawn 是否 shell:false、超时是否设置。

### 4.6 安全模型

**双闸门架构**：
1. **第一闸门（Python 侧车）**：`gate/policy.py` 对工具调用做权限预检，判断工具是否允许执行
2. **第二闸门（Electron 主进程）**：`xiyueFinalCheck` 做最终裁决，执行权单一归主进程
3. **审计日志**：`xiyueAuditLog` 记录所有工具调用到 `logs/xiyue-tools.log`

**四级信任模型**（L0-L3，来自已废弃的 AI管家设计方案；v1.1 已查证：policy.py 支持 `ToolMeta.level` 与 `Ctx.current_level` 比较，但 server.py `_decide_tool` 固定 `Ctx(current_level=1)`，且工具只标 level 1/2——**实际只有 L1 在用，L0/L2/L3 未接线**）：
- L0 观察员：只读信息
- L1 协助员：可执行低风险操作（默认，当前唯一生效等级）
- L2 操作员：可修改系统设置
- L3 自主员：可自主执行高风险操作

**已知安全缺口**：
- 成功执行路径未审计（只有失败/拒绝有日志）
- 工具定义双轨制可能导致策略覆盖不全（内联 19 工具的 `_TOOL_POLICY` 与 schema 16 工具的 policy 字段两套元数据）
- xiyue.json `browser.allowed_domains` 域名白名单未被 playwright_client.py 执行，浏览器工具可访问任意 URL（v1.1 新增）
- 信任等级硬编码为 1，无法由用户/设置动态调整（v1.1 新增）

#### 安全模型优化结论（2026-09-10 用户确认）

**设计参考**：Claude Desktop（allow/ask/deny 三级权限）、OpenAI Codex（approval_policy + 允许工具列表）、Home Assistant（RBAC 角色权限）。

**1. 双闸门架构保留（核心不变）**
- 第一闸门（Python 侧车 policy.py）：权限预检，判断工具是否允许执行
- 第二闸门（Electron 主进程 xiyueFinalCheck）：最终裁决，执行权单一归主进程
- hermes_core 只输出"想调用什么工具"，不直接执行——大脑不能直接控制手
- 安全机制独立于 AI 内部状态（情绪/人格不影响决策，与板块 8 原则一致）

**2. 三级权限模型（替代原四级信任）**
参考 Claude Desktop，每个工具可设置为：
- **allow（自动允许）**：AI 可自动执行，无需确认（如读取天气、截图、查询系统状态）
- **ask（每次询问）**：每次调用弹出确认框，用户点允许才执行（如打开应用、修改设置、发送消息）
- **deny（禁止）**：完全禁止调用（如删除文件、格式化、修改注册表——默认 deny，用户可手动放行）

默认规则：只读工具默认 allow，修改类工具默认 ask，破坏性工具默认 deny。用户可在设置页逐个调整。

**3. 通行证系统（Pass/Grant）**
用户确认"允许"时，可选择通行证有效期：
| 通行证类型 | 有效期 | 适用场景 |
|---|---|---|
| 单次通行证 | 仅本次操作 | 高风险操作（删文件、发邮件） |
| 会话通行证 | 本次应用会话，重启失效 | 中等风险（打开应用、改设置） |
| 时间通行证 | 用户指定时长（1小时/1天/1周） | 信任的重复性操作 |
| 永久通行证 | 永久有效，可随时撤销 | 完全信任的低风险工具 |

通行证粒度：工具级（允许截图）、参数级（允许读取 D:\文档）、域级（允许所有只读操作）。设置页提供"通行证管理"：查看所有已签发通行证、按类型筛选、一键撤销。

**4. 审计安全记录（完整字段）**
每条工具调用必须记录：
- 时间戳（精确到毫秒）
- 调用来源（AI 自动 / 用户手动 / 定时任务）
- 工具名 + 参数（敏感参数脱敏，如 API Key 只显示后 4 位）
- 通行证类型（单次/会话/时间/永久，或无通行证被拒绝）
- 第一闸门结果（通过/拒绝 + 原因）
- 第二闸门结果（通过/拒绝 + 原因）
- 执行结果（成功/失败 + 错误信息）
- 耗时（毫秒）
- token 用量（如涉及 LLM）

审计日志存 `%APPDATA%\xiyue\logs\audit\`，按日期分文件，保留 30 天自动清理。设置页提供"审计日志查看器"：按工具/时间/结果筛选，导出 CSV。

**5. 工作日志（运行日志）**
与审计日志分开，记录 AI 的完整工作过程：
- 对话日志（用户输入 + AI 回复 + 情绪状态 + 记忆注入摘要）
- 工具调用流水（调用顺序、参数、结果）
- 系统事件（侧车启动/崩溃/重启、模型切换、配置变更）
- 日志分级：info（正常操作）、warn（异常但可恢复）、error（失败需关注）
- 存 `%APPDATA%\xiyue\logs\runtime\`，保留 7 天自动清理
- 调试模式可提升日志详细程度（默认 info，调试时 debug）

**6. 数据安全**
- 记忆数据（core.db）和用户配置存 `%APPDATA%\xiyue\`，默认不加密（本地应用，系统登录已有保护）
- 提供"导出所有数据"和"清除所有数据"功能
- API Key（云端模型）加密存储在 Windows Credential Manager，不写明文配置文件
- 用户自定义上传（形象/音色/主题）存 `%APPDATA%\xiyue\data\custom\`，与系统数据隔离

**7. 原生插件安全（P1 审计）**
- 14 个插件做一次安全审计：参数校验（防注入）、最小权限、错误处理（不崩溃主进程）
- hardware-info-helper（孤儿未集成）决定集成或删除
- 审计结果写入 `docs/Plugin_Security_Audit.md`，后续新插件按审计清单检查

**8. 渲染层/IPC 安全**
- 保持 contextIsolation: true、nodeIntegration: false、sandbox: true
- preload 只暴露白名单 API，不暴露完整 ipcRenderer
- 定期审计 283 个 IPC channel，移除未使用的，确认每个有输入校验（v1.2 实测 11 个无调用方，清单见文首）

#### v1.2 增量建议（安全模型）
1. **落地顺序收敛为：审计补全 → deny/ask 最小集 → 通行证 → 参数级粒度**。P0a 只对 `file.delete`、`cmd.exec` 两个破坏性工具弹确认 + 全路径审计，用最小集拿 80% 收益；通行证四种有效期背后是存储/校验/撤销/UI 一整套，P1 再上。
2. **权限元数据用 MCP `annotations` 表达**：`readOnlyHint → allow`、`destructiveHint → deny（默认，用户可放行）`、其余 `→ ask`；`openWorldHint` 标记网络类工具，与 `allowed_domains` 校验联动。MCP 规范本身明文要求"人在环可拒绝、展示工具输入、设超时、记录用量供审计"，与本板块设计完全一致，可直接引用为设计依据。
3. **schema 单一事实源 + 启动一致性校验**：policy.py 与 `xiyueToolSchema.ts` 均从同一份 schema 加载，启动时对比工具名/等级/风险标记，不一致即拒绝启动并告警（方案级建议 B）。
4. **审计日志可选加哈希链**：每条记录含前一条 SHA256，成本极低、可检测篡改。标为可选，不强求。
5. **`think` 内容不进审计正文**：ollama `message.thinking` 可能含用户隐私推理，审计只记 token 数与是否启用思考，不落原文。

---

## 五、技术债务与问题汇总

### 5.1 高优先级（影响核心功能或安全）

| # | 问题 | 影响 | 来源 |
|---|---|---|---|
| 1 | **SQLite 长期记忆完全未接入主链路** | store.py（Phase 0 stub）的 add/search/forget/count 从未被调用，3 条测试数据，Agent 无长期记忆能力 | Agent 侧车调查 |
| 2 | **情绪状态机未接入** | emotion.py 6 状态 compute_emotion 从未被调用，实际只用 identity.py 2 状态（按时段推断一次后缓存不更新） | Agent 侧车调查 |
| 3 | **工具定义双轨制** | server.py 内联 19 工具（英文命名 + `_TOOL_POLICY`）vs schemas/tool_schema.json 16 工具（中文命名 + policy 字段），命名空间不同，后者从未被加载（文件本身完好），可能导致权限策略覆盖不全 | Agent 侧车调查（v1.1 修正数字，删除"编码损坏"） |
| 4 | **LLM 非流式 + 人工切片** | 首字延迟 = 完整推理时间，用户体验差，SSE 的 chunk 是假流式 | Agent 侧车调查 |
| 5 | **tmp/ 和 tts/ 只写不删** | server.py 向 `data/tmp/in_*.wav`、`data/tts/` 写文件，侧车侧无清理机制；当前两个目录不存在（清理后干净，运行时会重新创建并积累） | Agent 侧车调查 |
| 6 | **4 个 node-gyp 插件需本机编译** | 影响分发，用户需安装 Visual Studio Build Tools | Electron 层调查 |
| 6b | **浏览器域名白名单未执行**（v1.1 新增） | xiyue.json `browser.allowed_domains` 无代码读取，Playwright 工具可访问任意 URL，与"本地为主/数据不出本机"原则相悖 | v1.1 审校 |

### 5.2 中优先级（影响体验或可维护性）

| # | 问题 | 影响 | 来源 |
|---|---|---|---|
| 7 | silero-vad **未安装**且未接入 | vad.py import 即失败；语音输入无端点检测，需手动控制录音时长；faster-whisper 内置 vad_filter 也未启用 | Agent 侧车调查（v1.1 修正："已装"不成立） |
| 8 | 唤醒词是空 stub | 无语音唤醒能力 | Agent 侧车调查 |
| 9 | working_memory.json `clear_expired()` 从未调用 | 过期条目读取时被过滤（功能不受影响），但文件持续积累；当前 1 条 source=test 过期测试条目 | Agent 侧车调查（v1.1 细化） |
| 9b | `_run_agent_loop` 不剥离 qwen3 `<think>` 段（v1.1 新增） | `/chat/stream` 路径与 `/chat` 路径（`_llm_reply` 会剥离）行为不一致，流式回复可能夹带思考文本 | v1.1 审校 |
| 9c | volume-analyzer 半接入（v1.1 新增） | 有构建脚本 + 扩展注册，但主进程/渲染层零消费者，与孤儿插件同属"写了没接" | v1.1 审校 |
| 9d | Tauri 时代 docstring 腐旧（v1.1 新增） | server.py 头部"由 Rust 外壳拉起"、policy.py"Rust 侧终审"、store.py"Rust 经 IPC 注入路径"——误导阅读者 | v1.1 审校 |
| 10 | 插件命名仍为 eisland 前缀 | 品牌不一致，14 个插件目录和 package.json 依赖名 | Electron 层调查 |
| 11 | 4 个巨型文件（app.ts 2599 行等） | 可维护性差 | Electron 层调查 |
| 12 | media volume 为 stub | `media:get-volume` 硬编码返回 0.5，`media:set-volume` 空实现（注释：SMTC 不支持应用级音量） | Electron 层调查（v1.1 查证） |
| 13 | notificationSlice 冗余 | 状态管理有冗余 | Electron 层调查（v1.1 未复核） |
| 14 | Node>=25 / TS7 版本激进 | 兼容性风险，部分依赖可能不支持 | Electron 层调查 |
| 15 | AI 设置页残留清理 | `AiSettingsSection` 等旧配置未清理 | 汐月Electron版现状.md:125 |
| 16 | 成功执行路径未审计 | 安全审计不完整 | 汐月Electron版现状 |

### 5.3 低优先级（清理/优化类）

| # | 问题 | 影响 | 来源 |
|---|---|---|---|
| 17 | 品牌残留基础设施不可改名（eisland-media 协议、com.eisland.app 等） | 品牌不一致但改造成本高 | 汐月Electron版现状 |
| 18 | hardware-info-helper 是孤儿插件 | 未集成，占空间 | Electron 层调查 |
| 19 | ~~CHANGE_LOG.md 有 GBK 编码乱码~~ | **v1.1 勘误：实测文件为正常 UTF-8，问题不存在，撤销此项** | 文档整理 |
| 20 | LEGAL 文档联系邮箱为上游 eIsland | Xiyue fork 正式发布前需评估 | 文档整理 |
| 21 | ~~项目垃圾约 1.36 GB 未清理~~ | **已完成**：commit 562a028 释放约 1.35 GB（2 个被运行中 Electron 锁定的 DLL 约 7.3MB 跳过） | 清理清单 |
| 22 | 模块地图未收录根目录 `sdk/`、`web/`、`test/`、`scripts/`、`resources/`、`assets/`（v1.1 新增） | 新人无法从报告了解这些目录用途；`sdk/`、`web/` 需补说明 | v1.1 审校 |

### 5.4 实施路线图（2026-09-10 用户确认，整合全部 12 板块）

> **原则**：现有代码先保留不删，管理管线统一好；插件/模块以后用不到的由用户审查后删减。

#### P0a — 快赢与补洞（≤1 周，高确定性，不碰换脑；v1.2 拆分，⚠️ 待拍板）

| 工作项 | 来源 | 说明 | 完成判据 |
|---|---|---|---|
| 浏览器域名白名单执行 | v1.1 新增 | playwright_client 读取 xiyue.json `allowed_domains` 并校验（约 20 行） | 白名单外 URL 被拒并审计 |
| 信任等级可配 | v1.2 新增 | `_decide_tool` 的 `Ctx(current_level=1)` 改读设置 | 设置切 L0 后写类工具被拒 |
| 审计补全成功路径 | 板块 10 | 成功/失败全记录，含 token/耗时/模型来源 | 每次工具调用一条完整记录 |
| deny/ask 最小集 | 板块 10（v1.2 收敛） | 仅 `file.delete`、`cmd.exec` 弹确认，其余按只读/修改默认 | 破坏性工具无确认不执行 |
| 工具 schema 重建 | 板块 6（v1.2 方案 B） | 以主进程执行器为事实源导出 19 工具 schema，MCP `annotations` 格式，policy.py 与 xiyueToolSchema.ts 同源加载 + 启动一致性校验 | 两侧元数据 diff 为空 |
| `executeTool()` 收口 | v1.2 新增 | app.ts / localToolIpc.ts 两处终审调用点合并为单一执行入口 | 全仓只有一处调 xiyueFinalCheck |
| ollama `think` 字段替代手工剥离 | v1.1→v1.2 | 删除两处 `<think>` 剥离，语音路径 `think=False`，文字路径 thinking 走 `thought` 事件 | 语音首字延迟下降可量化 |
| TTS 不落盘 | 板块 9（v1.2 改法） | 渲染层直接播 `audio_b64` blob，侧车落盘改调试开关 | data/tts 不再增长 |
| 渲染层 RMS 端点检测 | 板块 9（v1.2 方案 C） | `ScriptProcessorNode` 回调加 RMS 静音判停，设置可切手动/自动 | 说完 1.5s 内自动发送 |
| `/voice` 标记废弃 | 板块 6 | 端点保留但返回 410 + 提示，下版本删除 | — |
| 死 IPC 清理 | v1.2 新增 | 删除 11 个无调用方 channel（volume-analyzer 定案后再删 `extension:*`） | — |

#### P0b — 换脑核心（让 AI 真正"有脑子"）

| 工作项 | 来源 | 说明 | 完成判据 |
|---|---|---|---|
| hermes_core 四模块移植 | 板块 2/6 | memory/emotion/soul/time 搬入侧车 | 四模块 import 成功、单测通过 |
| LocalHashEmbedder 中文召回验证 | v1.2 新增 | 移植第一天用 10 条中文记忆测 recall，失效则加 2-gram/jieba | 中文 recall@5 ≥ 0.8 |
| 记忆接线 L0-L2 | 板块 7 | core.db + recall + extract_and_store；recall 超 200ms 降级仅注入常驻块 | 能答对 10 轮前提过的个人事实 |
| L1 抽取基线对比 | v1.2 新增 | 20 条真实对话，对比现有 `_extract_and_store_facts` 与 scribe | 新抽取不劣于旧 |
| Ollama 真流式 | 板块 2/6 | `stream=True` 逐 token 推送 + `thought` 事件 | 本地首字 < 1.5s |
| 回复路径合并单入口 | v1.2 新增 | `_llm_reply` 与 `_handle_chat_stream` 合并为 `run_turn(text, stream)` | 只剩一处 prompt 组装 |
| 情绪 PAD + expression | 板块 8 | 不可变 EmotionState、事件驱动；情绪 → kokoro speed 映射先行 | 不同情绪 TTS 语速可感知 |
| 人格 .soul 接入 | 板块 8 | 汐月初始人格 + prompt 注入 | — |
| 插件权限声明+首次授权 | 板块 11 | 每个插件声明权限，首次使用提示（主进程 `callPlugin` 收口） | — |
| 插件权限使用记录 | 板块 11 | 每次调用记录到审计日志 | — |
| API 参考文档 | 板块 6 | 从路由代码生成 docs/Agent_API_Reference.md | — |
| 回归对话集 | v1.2 新增 | 20-30 条固定脚本（记忆/情绪/工具/边界），每次侧车改动跑一遍 | 脚本化可一键跑 |

#### P1 — 增强体验（让 AI 更"好用"）

| 工作项 | 来源 | 说明 |
|---|---|---|
| L3 用户画像自动生成 | 板块 7 | 累计 25 条记忆触发画像更新 |
| 激素系统 | 板块 8 | 多巴胺/皮质醇/催产素，情绪更自然 |
| 昼夜节律 | 板块 8 | 不同时段情绪基线不同 |
| 上下文压缩精简版 | 板块 2 | 自实现 ~300 行，超阈值触发摘要 |
| 循环增强 | 板块 2 | 借鉴官方 Hermes 设计，~300 行 |
| 云端路由 | 板块 1（v1.2 改策略） | 规则优先 + 本地失败自动升级云端并记录，模型自评仅作辅助信号；OpenAI 兼容 |
| 巡检事件驱动 | 板块 4 | 时间+事件双重保险，指数退避重启 |
| node-gyp 预编译 + 去 eisland 化 | 板块 11（v1.2 合并） | prebuild-install，免 VS Build Tools；与包名改 `xiyue-` 前缀绑定为同一次破坏性变更 |
| 孤儿/半接入插件处理 | 板块 11 | hardware-info-helper 集成或删除；volume-analyzer 接消费方或移除 |
| 插件安全审计 | 板块 10/11 | 14 个插件参数校验/最小权限审计 |
| 插件行为监测+越权拦截 | 板块 11 | 主进程中转，越权直接拦截 |
| 危险操作还原能力 | 板块 11 | 删除进回收站，设置修改可撤销 |
| API Key 加密存储 | 板块 10 | Windows Credential Manager |
| STT 更大模型选项 | 板块 9 | small/medium 按需下载 |
| TTS 多音色 | 板块 9 | 2-3 个内置音色 + 自定义上传 |

#### P2 — 完善打磨（让 AI 更"精致"）

| 工作项 | 来源 | 说明 |
|---|---|---|
| 人格漂移 | 板块 8 | 长期互动人格微变化，可关闭/重置 |
| 纪念日+重逢 | 板块 8 | time/ 模块剩余功能 |
| 真正 embedding 模型 | 板块 7 | nomic-embed-text，提升检索质量 |
| 技能系统轻量版 | 板块 7 | Agent 自创技能 + 管理页面 |
| 唤醒词 + 打断 | 板块 9（v1.2 补细节） | openWakeWord 自训"嘿汐月"（预训练仅英文且非商业许可；正样本用 kokoro 批量合成）+ silero-vad 做 TTS 播放期间的 barge-in |
| 插件管理统计页面 | 板块 11 | 调用次数/内存/权限统计 |
| ~~命名去 eisland 化~~ | 板块 11 | v1.2 已并入 P1 "node-gyp 预编译 + 去 eisland 化" |
| 常驻 serve 推广 | 板块 11 | screenshot/application-icon |
| IPC schema 收敛 | 板块 4 | 283 个 channel 分类+校验 |
| 入口文件拆分 | 板块 4 | src/main/index.ts 1055 行按域拆分 |
| 设置页 island 子页 | 板块 5 | 工具管理+尺寸自定义（需先做工具盘点） |
| ai slice 流式统计 | 板块 5 | token 用量/模型来源/延迟 |
| 用户自定义上传 | 板块 5 | 形象包/主题/音效/壁纸 |

#### P3 — 远期优化

| 工作项 | 来源 | 说明 |
|---|---|---|
| 插件 CI 预编译完善 | 板块 11 | 自动构建+发布流程 |
| 更多云端模型接入 | 板块 1 | 除 OpenAI 兼容外的其他提供商 |
| 多语言支持 | 全局 | 界面国际化 |
| 性能持续优化 | 全局 | 启动速度/内存占用 |

---

## 六、下一步建议

### 已完成（v1.1 更新状态）
1. ~~**执行项目清理**~~ ✅ 已于 commit 562a028 完成，释放约 1.35 GB（详见 `docs/Xiyue_Cleanup_Report_2026-09-10.md`）；跳过项：2 个被运行中 Electron 锁定的插件 DLL（约 7.3 MB），可在应用退出后补删

### 短期（v1.2 重排：先 P0a 快赢，再 P0b 换脑）
2. **P0a 快赢与补洞（≤1 周）**：域名白名单执行、信任等级可配、成功路径审计、deny/ask 最小集、以执行器为准重建工具 schema（MCP 格式 + 启动一致性校验）、`executeTool()` 收口、ollama `think` 字段替代手工剥离、TTS 不落盘、渲染层 RMS 端点检测、`/voice` 废弃、死 IPC 清理（解决 #3、#4 部分、#5、#6b、#7、#9b）
3. **P0b Agent 侧车"换脑"**：先拍板方案_存储与移植规划_v1.0.md 的 5 个决策点，移植 hermes_core 四模块；**移植第一天验证 LocalHashEmbedder 中文召回**；接线记忆 L0-L2（解决 #1）、PAD 情绪 + kokoro speed 映射（解决 #2）、真流式 + `thought` 事件、回复路径合并单入口；建立回归对话集
4. **换脑前动作**：留 20 条真实对话样本冻结现有 L1 抽取基线；数据目录收口与换脑走同一条迁移路径

### 中期（1-2 月，体验优化）
6. **数据目录统一收口**：按方案_存储与移植规划_v1.0.md 统一到 %APPDATA%\xiyue\，实现 cache/logs 自动清理（解决 #5、#9）
7. **node-gyp 插件预编译**：为 4 个 C/C++ 插件提供预编译二进制（解决 #6）
8. **设置页清理 + 审计补全**：清理 AI 设置页残留，补全成功执行路径审计（解决 #15、#16）
9. **插件品牌重命名 + 半接入插件定案**：评估 eisland 前缀改名成本（解决 #10）；hardware-info-helper / volume-analyzer 接入或删除（#18、#9c）
10. **文档腐旧清理**：清除 server.py / policy.py / store.py 中 Rust/Tauri 时代 docstring（#9d），补齐模块地图缺失目录说明（#22）

### 长期（规划中）
11. **Phase 2 会话检索 FTS5**：引入 SQLite FTS5 全文检索
12. **Phase 3 外围归位**：OCR/eIsland_store 废弃归位
13. **唤醒词实现**：基于 wake.py 实现语音唤醒（解决 #8）

---

## 七、附录

### 7.1 文档索引（详见 docs/README.md）

| 状态 | 文档 | 说明 |
|---|---|---|
| **已实现** | 汐月Electron版现状.md | 当前架构事实基线，理解现有代码的首要入口 |
| **已实现** | 灵动岛分档改造计划书.md | 三档尺寸+独立窗完整计划，5 阶段全部完成 |
| **草案/进行中** | 方案_存储与移植规划_v1.0.md | Agent 换脑 + 数据目录收口，5 决策点待拍板 |
| **参考/规范** | FRONTEND_STANDARDS.md | 全栈前端编码规范（eIsland 原作者制定） |
| **参考/规范** | COMMENT_STANDARDS.md | JSDoc 注释规范 + GPL-3.0 版权模板 |
| **参考/规范** | DESIGN_STYLE_GUIDE.md | UI 设计风格指南（冷暖对冲设计基因） |
| **参考/规范** | ICON_ENUM.md | 天气图标枚举（400+ UAPI/WMO 代码） |
| **参考/规范** | LEGAL/ 3 份 | 隐私政策/服务条款/计费退款 |
| **历史记录** | CHANGE_LOG.md | V26.4.x~V26.7.4 变更日志（自动生成） |
| **历史记录** | 长截图问题排查记录.md | r19~r60 完整调试档案（最权威技术档案） |
| **历史记录** | 设计文档审查报告.md | 第一轮设计审查（推动 v1.0→v1.1） |
| **历史记录** | 项目全面审查报告.md | 第二轮全项目审查（Tauri 时代，推动 v1.1→v1.2） |
| ⚠️ **已废弃** | AI管家设计方案.md | Tauri 时代产品设计总纲 v1.2，架构整体失效 |
| ⚠️ **已废弃** | 灵动岛改造方案.md | Tauri 时代早期方案，被分档计划书取代 |

### 7.2 清理清单摘要（详见 docs/Xiyue_Cleanup_Report_2026-09-10.md；**已于 commit 562a028 执行**）

**计划释放约 1.36 GB，实际释放约 1.35 GB**

| 区域 | 大小 | 动作 |
|---|---|---|
| 插件 bin/obj/build 编译产物 | 627.46 MB | ✅ 已删除（2 个被锁定 DLL 约 7.3MB 跳过） |
| APPDATA Cache + Code Cache | 427.20 MB | ✅ 已删除 |
| data_backup 重复模型 | 141.03 MB | ✅ MD5 确认一致后删除 |
| out/ Electron 构建产物 | 78.94 MB | ✅ 已删除（当前 out/ 不存在） |
| OCR screenshot/frames 调试帧 | 56.18 MB | ✅ 已删除 |
| OCR _ls_* + _r* 调试系列 | 43.35 MB | ✅ 已删除（128 个文件） |
| 根目录错位 traineddata | 7.67 MB | ✅ 已删除 |
| 其余（日志/缓存/空目录等） | ~8 MB | ✅ 已删除 |

**保留项**：src/、agent/、voice/、docs/、node_modules/、.venv/、data/models/；APPDATA wallpapers/ 与 blob_storage/ 非空已保留。
> v1.1 注：清理报告列为"不可清理"的 `.workbuddy/`（473 KB）现已不存在于项目根，来源与去向待确认。

### 7.3 本次调查报告清单

| 报告 | 路径 | 覆盖范围 |
|---|---|---|
| 本报告 | docs/Xiyue_全面调查报告_v1.0.md（内容已更新至 v1.1） | 全项目三层综合 |
| Electron 源码调查报告 | docs/Xiyue_Electron_Source_Audit.md | src/main + preload + renderer + plugins（注：第 492 行"9 个 C# koffi"分类有误，见本报告 4.5） |
| Agent/语音源码调查报告 | docs/Xiyue_Agent_Voice_Source_Audit.md | agent/ + voice/ + data/（注：工具数 20→19、schema 17→16、"编码损坏"与"silero-vad 已装"不成立，见本报告勘误摘要） |
| 文档索引 | docs/README.md | docs/ 全部分类索引 |
| 清理清单 | docs/Xiyue_Cleanup_Report_2026-09-10.md | 项目 + OCR + APPDATA 垃圾扫描（已执行） |

### 7.4 业界参考项目（v1.2，均已抓取核实，抓取日期 2026-09-10）

| 项目 | 链接 | 对应板块 | 一句话结论 |
|---|---|---|---|
| Model Context Protocol — Tools | https://modelcontextprotocol.io/specification/2025-06-18/server/tools | 6 / 10 | 工具 schema 格式与 `annotations` 权限提示；规范明文要求人在环、审计、超时 |
| Pipecat — Speech Input | https://docs.pipecat.ai/pipecat/learn/speech-input | 9 | Silero VAD 参数默认值、Smart Turn、barge-in 实现思路 |
| Letta（MemGPT）概念 | https://docs.letta.com/concepts/memgpt | 7 | 记忆块常驻 + 归档检索 + compact 压缩，与 hermes_core 分层同构 |
| Open-LLM-VTuber 快速开始 | http://docs.llmvtuber.com/en/docs/quick-start | 1 / 7 / 9 | 最接近的开源同类；Letta 记忆增加延迟的实证；SenseVoiceSmall 本地中文 ASR |
| silero-vad（PyPI） | https://pypi.org/project/silero-vad/ | 9 | MIT、2MB、<1ms/块；依赖 torch（venv 已有） |
| openWakeWord（PyPI） | https://pypi.org/project/openwakeword/ | 9 | 预训练仅英文 + 非商业许可；自训靠 TTS 合成正样本 |
| Mem0 开源版概览 | https://docs.mem0.ai/open-source/overview | 7 | 默认依赖云端 LLM + Qdrant，与本地为主冲突，仅作 API 形态参考 |

> 未能抓取（网络原因，不引用）：GitHub 直连全部 ECONNRESET；smolagents 文档站超时。涉及"ReAct 循环把错误回灌给模型"的说法按通用做法表述，不挂具体来源。

---

## 八、版本状态与板块完成记录

**文档版本**：v1.2（v1.0 12 板块全部梳理完成；v1.1 对照源码逐项复核并就地修正；v1.2 定向补查 + 业界参考，给出各板块优化建议）
**最后更新**：2026-09-10
**梳理方式**：逐板块陈述 → 用户讨论确认 → 写入文档，共 12 个板块；v1.1 由代码审校补正事实层；v1.2 建议以"v1.2 增量建议"小节散布在各板块下，方案级的三条集中在文首总览

### v1.2 覆盖了哪些 v1.0 已确认结论（需重新拍板）

| 板块 | v1.0 已确认 | v1.2 建议改为 | 依据 |
|---|---|---|---|
| 12 路线图 | P0 单批次 12 项 | 拆 P0a（快赢补洞，≤1 周）+ P0b（换脑主体），每项定完成判据，配回归对话集 | 换脑与安全小改动风险收益不匹配 |
| 6 侧车结论 5 | 19 内联 + 16 schema 合并 | 以主进程执行器为事实源重建 schema，MCP `annotations` 格式，两侧同源加载 + 启动校验 | 中文 16 工具无执行器，直接合并会复活死工具 |
| 9 语音结论 3 | 接入 silero-vad 做端点检测（P0） | 端点检测走渲染层 RMS（30 行，零依赖）；silero-vad 降到 P2 做打断 | 渲染层已有逐帧 PCM 回调；Pipecat 实证 barge-in 才需要语义 VAD |
| 1 产品定位 | 本地 AI 自主判断复杂度决定云端路由 | 规则优先 + 失败自动升级，模型自评仅辅助 | 小模型自评系统性偏自信 |
| 9 语音结论 5 | tmp/tts 播放后删除 | TTS 不落盘，`audio_b64` 直接播 blob | 消灭债务而非清理债务 |
| 11 插件结论 9 | 去 eisland 化 P2 独立做 | 与 node-gyp 预编译绑定为同一次破坏性变更（P1） | 避免两次改依赖名 |

其余 v1.2 建议均为增量补充，不改变原结论。

### 板块完成状态

| # | 板块 | 状态 | 核心结论 |
|---|---|---|---|
| 1 | 产品定位 | ✅ 已确认 | 本地常驻快捷工具+AI助手；汐月=可爱小姑娘二次元（留替代空间）；本地为主+AI自主决策云端路由（OpenAI兼容）；STT/TTS云端备选 |
| 2 | 三层架构 | ✅ 已确认 | 架构骨架不动；P0换脑+真流式；侧车巡检改事件+时间双重保险；不搬官方Hermes整套循环；hermes_core大脑+Xiyue增强循环 |
| 3 | 灵动岛UI | ✅ 已确认 | 14状态保留（v1.1 补 musicProvidersLogin）；agentVoiceInput独立语音球态；AI双态；三档尺寸默认+自定义；每页=一个工具可开关+拖拽排序；AI感知当前激活工具 |
| 4 | Electron主进程 | ✅ 已确认 | 入口中期拆分；IPC中期schema收敛；侧车巡检5-10s+事件驱动+指数退避+对话历史持久化；SMTC三层保留；审计补全成功路径 |
| 5 | 渲染层 | ✅ 已确认 | timer+pomodoro合并为time；全项目DRY；分层按域组织；设置页island子页（工具管理+尺寸自定义）；ai slice流式统计完善；用户自定义上传留可替换空间 |
| 6 | Agent侧车 | ✅ 已确认 | 废弃/voice；主循环换脑接线；记忆/情绪迁移hermes_core；工具双轨制统一；新建API参考文档+变更记录+覆盖率对账 |
| 7 | 记忆系统 | ✅ 已确认 | L0-L3分层+8种分类；空闲自学习+自动分层聚合；遗忘四阶段+永久记忆；共激活强化；技能系统轻量版P2；core.db；旧数据废弃 |
| 8 | 情绪与身份 | ✅ 已确认 | PAD+expression P0；激素P1；HEXACO人格+中文滑块；.soul配置；人格漂移P2；昼夜节律P1；**情绪影响表达不影响决策** |
| 9 | 语音链路 | ✅ 已确认 | faster-whisper base+更大模型选项；kokoro多音色+自定义；VAD接入P0；唤醒词P2；tmp/tts自动清理P0；语音球声纹波形 |
| 10 | 安全模型 | ✅ 已确认 | 双闸门保留；三级权限（allow/ask/deny）；通行证系统（单次/会话/时间/永久）；完整审计安全记录；工作日志；API Key加密；插件安全审计 |
| 11 | 原生插件 | ✅ 已确认 | 权限声明+首次授权；权限使用记录；行为监测+越权拦截；危险操作还原能力；插件管理统计P2；node-gyp预编译P1；孤儿插件处理；现有代码先保留 |
| 12 | 技术债务与路线图 | ✅ 已确认（v1.2 建议拆分待拍板） | 原 P0 换脑核心 12 项 → v1.2 建议拆为 P0a 快赢 11 项 + P0b 换脑 12 项（含完成判据）；P1 增强体验 15 项；P2 完善打磨 13 项；P3 远期 4 项；现有代码先保留，管理管线统一，用户后续审查删减 |

### 已执行事项

- ✅ 项目清理（三批释放约 1.35 GB，commit 562a028）
- ✅ 文档归位与 docs/README.md 索引更新
- ✅ 12 板块逐板块梳理确认并写入本文档
- ✅ v1.1 源码审校：对 v1.0 的 40+ 项"实测"声明逐项对照源码复核，修正 15 项事实偏差、新增 7 项发现（见文首勘误摘要）
- ✅ v1.2 定向补查 8 项（回收站/插件调用边界/ollama think/whisper VAD 默认值/录音管线/依赖成本/死 IPC/`/voice` 调用方）+ 抓取核实 7 个业界参考项目 + 12 板块增量建议 + 路线图 P0 拆分

### v1.1 审校方法与对本报告的意见

**审校方法**：直接读取 package.json / server.py / identity.py / memory/*.py / voice/*.py / gate/policy.py / schemas/tool_schema.json / persona/xiyue.json / data/ 实际内容 / .venv pip list / git log；渲染层与插件层由两路独立扫描覆盖（hover/maxExpand/settings/states/store 类型定义；14 个插件的 csproj/binding.gyp/index.js/package.json）。IPC 数量用 `ipcMain.handle/on` 注册字符串去重统计。

**总体评价**：报告的架构判断、12 板块决策、换脑方案与路线图**方向正确、可以直接作为开发依据**；问题集中在"事实层"——多处数字是从两份子报告转抄而非复测，子报告本身的口径偏差（如仅统计 src/ 的测试数、把 spawn-EXE 插件算进 koffi 组、把中文 JSON 误判为编码损坏）被原样继承。

**对报告本身的修改意见（已在 v1.1 落实）**：
1. 关键数字标注统计口径（"src/ 内"还是"全仓"、"注册字符串去重"等），避免下次复核时再次对不上
2. "未接入"类结论要区分**文件存在但未被 import**（emotion.py / vad.py / tools/）、**被 import 但函数未调用**（store.py 仅用 resolve_data_dir；working.clear_expired）、**依赖根本未安装**（silero-vad）三种情况——三者修复成本完全不同
3. 引用 hermes_core（desk-pet）的描述与 Xiyue 现状描述要严格分开，v1.0 把 desk-pet 的 `_DEFAULT_DB_PATH` 误写进了 Xiyue 记忆系统现状
4. "已执行"的事项（清理）不应继续留在"立即执行"建议里，避免读者重复操作

**对项目本身的额外建议（v1.0 未提及，供拍板）**：
1. **安全补洞优先于换脑**：`allowed_domains` 未执行、信任等级硬编码为 1、成功路径无审计——这三项都是几十行改动，建议排在 P0 换脑之前先做，否则换脑后的新循环会继承同样的洞
2. **换脑前先冻结现有 L1 抽取逻辑的行为基线**：`_extract_and_store_facts` 已在生产链路运行，迁移到 hermes_core scribe 后需对比抽取质量，建议先留 20 条真实对话样本做回归
3. **两条回复路径（/chat 与 /chat/stream）行为不一致**（think 剥离、prompt 附加规则不同），换脑时建议合并为单一入口，避免维护两套 prompt 组装
4. **volume-analyzer 状态需单独拍板**：它既不是孤儿（有构建脚本、有扩展注册）也未接入（零消费者），报告只提 hardware-info 一个孤儿会漏掉它
5. **Tauri 时代 docstring 集中清一次**：server.py / policy.py / store.py 三处仍写"Rust"，新人读代码会误判架构；建议随换脑一并清理并把"Electron 主进程终审"写进 docstring

### 待执行事项（按路线图 P0 开始）

详见 5.4 实施路线图（v1.2 已拆为 P0a / P0b）。建议顺序：先拍板"v1.2 覆盖清单"6 项 → P0a 快赢补洞（≤1 周）→ P0b 换脑（首日验证 LocalHashEmbedder 中文召回）→ 真流式。

---

> **报告结束**。本文档为 Xiyue 项目现状-目标-方法的完整基线，后续开发以此为决策依据。如需推进 P0 换脑实施，请指示。
