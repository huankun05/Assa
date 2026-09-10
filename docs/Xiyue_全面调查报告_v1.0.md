# Xiyue（汐月）项目全面调查报告

> **调查时间**：2026-09-10
> **调查范围**：Electron 应用层（src/main + src/preload + src/renderer + plugins）、Python Agent 侧车（agent/）、语音链路（voice/）、文档体系（docs/）、项目清理
> **所有结论均区分"已查证"（有源码/文档依据）与"推断/待确认"**
> **配套子报告**：`Xiyue-源码调查报告.md`（Electron 层）、`docs/Xiyue_Agent_Voice_Source_Audit.md`（Agent/语音层）、`docs/README.md`（文档索引）、`Xiyue_Cleanup_Report_2026-09-10.md`（清理清单）

---

## 一、项目概述

**一句话定位**：汐月是 eIsland（GPL-3.0）的 Electron 衍生换芯版——一个 Windows 桌面灵动岛形态的本地常驻 AI 管家，核心特色是全本地 AI 推理（Ollama + faster-whisper + kokoro）、双闸门安全模型、以及像素小恐龙吉祥物的冷暖对冲设计语言。

### 关键数据（全部实测）

| 维度 | 数据 | 来源 |
|---|---|---|
| 版本 | v26.7.4 | package.json |
| 技术栈 | Electron 43 + React 19 + TS 7 + Vite 7 + Tailwind 4 + zustand 5 | package.json / 配置文件 |
| Python 侧车 | Python 3.12 venv，http.server.ThreadingHTTPServer，127.0.0.1:8765 | agent/server.py |
| LLM | Ollama qwen3-4b-32k（非流式调用） | agent/server.py |
| 原生插件 | 14 个目录（9 个 C# Native AOT + koffi FFI，4 个 C/C++ node-gyp N-API，1 个孤儿） | plugins/ |
| IPC Channel | ~180+ 个，按六域分类 | src/main/ipc/ |
| 灵动岛状态 | 13 个运行时状态 | src/renderer/components/states/ |
| zustand slice | 7 个 | src/renderer/store/slices/ |
| 测试文件 | 129 个 .test.ts，55 个 test 目录 | 全仓扫描 |
| i18n | 2 种语言（zh-CN / en-US） | i18n/ |
| 文档 | 根目录 13 份 + announcement/ 40+ 份 + design/ + LEGAL/ 3 份 | docs/ |

---

## 二、现状层

### 2.1 功能清单

#### 灵动岛核心交互（已实现）
- **三档尺寸 + 事件临时态**：胶囊 260×42 / hover 500×60 / 大面板 860×150·860×400 / 通知条 500×88
- **13 个运行时状态**：idle / hover / expanded / maxExpand / notification / lyrics / lyricsTranslation / guide / announcement / agentVoiceInput / agent / stt / cli
- **hover 6 个 Tab**：time（控制中心）/ lyrics（歌词+喜欢）/ weather / xiyue（AI 双态）/ pomodoro（番茄钟）/ expand（入口）
- **大面板 13 页**：待办 / URL收藏 / 相册 / 邮箱 / 文件查找 / 剪贴板 / 备忘录 / 倒数日 / 闹钟 / 系统性能 / CLI控制台 / 计算器 / AI聊天
- **独立窗口**：设置 / 聊天 / 邮件 / 翻译 / 工具箱 / 计算器

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

#### AI 管家（已实现，Phase 0 精简版）
- 本地 LLM 对话（Ollama qwen3-4b-32k）
- SSE 流式输出（**模拟流式**：完整回复后按 8 字符 + 20ms 人工切片）
- 语音输入：渲染层 getUserMedia 录音 → faster-whisper STT
- 语音输出：kokoro TTS（zf_xiaobei 音色，24k wav）+ pyttsx3 兜底
- 浏览器自动化（Playwright，6 个工具）
- 双闸门安全：Python policy.py 预检 + Electron 主进程 xiyueFinalCheck 终审
- 身份层：xiyue.json 程序化身份 → identity.py → 主进程/前端统一读取
- 记忆 L0（对话历史 ≤10 轮）+ L1（working_memory.json，当前 1 条已过期 8 天）
- 长截图：双引擎（Electron desktopCapturer 600-900ms / GDI BitBlt koffi FFI 毫秒级）+ 自动滚动 + DP 最小能量缝拼接（r60，2026-09-10）

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
│   ├── index.ts                 # 入口（1056 行），窗口管理 + 侧车 spawn + IPC 注册
│   ├── ipc/                     # ~180+ IPC channel，六域分类
│   │   ├── agent/               # AI 对话/工具执行/语音
│   │   ├── app/                 # 应用配置/更新/账户
│   │   ├── media/               # 音乐/SMTC/歌词/音量
│   │   ├── settings/            # 设置读写
│   │   ├── system/              # 系统控制/剪贴板/下载
│   │   └── window/              # 窗口管理/灵动岛状态
│   ├── services/                # 后台服务（SMTC/通知/更新等）
│   ├── core/                    # 核心模块（downloadEngine 多线程下载）
│   ├── config/                  # 配置管理
│   ├── system/                  # 系统交互
│   ├── clipboard/               # 剪贴板
│   ├── music/                   # 音乐服务（qishuiAudio  provider）
│   ├── window/                  # 窗口管理
│   ├── log/                     # 日志
│   ├── installer/               # 安装器
│   └── extensions/              # 扩展
│
├── src/preload/                 # 预加载脚本，暴露安全 API 给渲染层
│
├── src/renderer/                # React 渲染层
│   ├── components/states/       # 13 状态灵动岛状态机（核心）
│   ├── components/components/    # DynamicIsland* 共享组件
│   ├── store/                   # zustand 7 slice（island/weather/timer/notification/media/ai/pomodoro）
│   ├── api/                     # API 层（ai/weather/lyrics/miniGame/tools/update 等）
│   ├── utils/                   # 工具（audio/theme/security/totp/lrcParser 等）
│   ├── styles/                  # 样式（按状态/模块组织）
│   └── i18n/                    # 国际化（zh-CN/en-US）
│
├── agent/                        # Python Agent 侧车（自写 Phase 0 精简实现）
│   ├── server.py                # HTTP/SSE 服务器（25KB，10 个端点）
│   ├── main.py                  # 入口
│   ├── identity.py              # 身份/人格系统（8.4KB）
│   ├── emotion.py               # 情绪系统（**未接入主链路**）
│   ├── memory/                  # 记忆系统
│   │   ├── store.py             # SQLite 长期记忆（**未接入主链路**，3 条测试数据）
│   │   ├── history.py           # 对话历史
│   │   └── working.py           # 工作记忆
│   ├── gate/                    # 权限预检
│   │   └── policy.py            # 工具权限策略
│   ├── tools/                   # 工具注册（20 个内联工具定义）
│   ├── browser/                 # Playwright 浏览器自动化
│   └── persona/                 # 人格设定（xiyue.json + xiyue.md）
│
├── voice/                        # 语音链路
│   ├── stt.py                   # faster-whisper 语音识别
│   ├── tts.py                   # kokoro 语音合成 + pyttsx3 兜底
│   ├── vad.py                   # silero-vad 语音活动检测（**未被主链路调用**）
│   └── wake.py                  # 唤醒词（空 stub）
│
├── plugins/                      # 14 个原生 helper 插件
│   ├── 9 个 C# Native AOT + koffi FFI
│   ├── 4 个 C/C++ node-gyp N-API
│   └── 1 个孤儿（hardware-info-helper，未集成）
│
├── docs/                         # 文档体系（见附录文档索引）
├── data/                         # 运行时数据（models/tts/history.json/memory.db/working_memory.json）
├── .venv/                        # Python 3.12 虚拟环境
├── out/                          # Electron 构建产物
└── schemas/                      # JSON Schema（tool_schema.json 等）
```

### 2.3 核心数据流

#### 用户对话数据流
```
用户输入（文字/语音）
  → 渲染层状态机切换到 agent/stt 状态
  → preload API → 主进程 IPC（agent 域）
  → 主进程 HTTP POST 到 Python 侧车 127.0.0.1:8765
    → /chat 或 /chat/stream（SSE）
    → server.py: 构建 prompt（persona + 历史≤10轮 + working_memory）
    → Ollama qwen3-4b-32k 非流式调用
    → 如需工具：policy.py 预检 → 主进程 xiyueFinalCheck 终审 → 执行 → 结果回传
    → 完整回复后按 8 字符 + 20ms 人工切片，通过 SSE chunk 事件推送
  → 主进程转发 SSE 到渲染层
  → 渲染层逐字显示 + 状态切换（thinking → toolCalling → answering）
  → 如需 TTS：kokoro 合成 wav → 渲染层播放
```

#### 语音输入数据流
```
渲染层 getUserMedia 录音（主路径）
  → /transcribe 端点
  → faster-whisper base（CPU int8，138MB 模型）
  → 返回文本 → 进入对话流程
```
备用路径：服务端 sounddevice 固定录 12 秒 → /voice（延迟不可接受，不推荐）

#### 长截图数据流
```
用户触发长截图
  → 主进程 IPC → screenshot-helper（C# koffi FFI，GDI BitBlt 毫秒级）
  → 自动匀速滚动（PostMessage WM_MOUSEWHEEL 直达 Chromium）
  → 静止抓帧 → 帧-累积匹配 → DP 最小能量缝拼接
  → 三重防护（错帧/滑谷/软帧）+ 空背景假谷检测
  → 返回拼接后长图
```

### 2.4 技术栈实测

| 层级 | 技术 | 版本 | 备注 |
|---|---|---|---|
| 桌面框架 | Electron | 43 | 从 Tauri2 迁移（2026-08-30） |
| 前端框架 | React | 19 | |
| 语言 | TypeScript | 7 | 版本激进 |
| 构建工具 | Vite + electron-vite | 7 | |
| 样式 | Tailwind CSS | 4 | |
| 状态管理 | zustand | 5 | 7 slice |
| 测试 | Vitest + v8 coverage | - | 129 测试文件 |
| Node 要求 | >=25.0.0 | - | 版本激进 |
| Python | 3.12 | - | venv 在项目根 |
| HTTP 服务器 | http.server.ThreadingHTTPServer | 标准库 | 非 Flask/FastAPI |
| LLM | Ollama + qwen3-4b-32k | - | 非流式调用 |
| STT | faster-whisper base | - | CPU int8，138MB |
| TTS | kokoro + pyttsx3 | - | zf_xiaobei 音色 |
| VAD | silero-vad | - | 已装但未接入 |
| 浏览器自动化 | Playwright | - | 6 个工具 |
| 原生插件 | C# Native AOT + koffi / C++ node-gyp | - | 14 个目录 |
| 打包 | electron-builder | - | |

---

## 三、目标层

### 3.1 产品定位

**核心定位**：Windows 桌面灵动岛形态的本地常驻 AI 管家。

**设计基因**（来自 DESIGN_STYLE_GUIDE.md）：
- Apple-inspired 极简骨架 + 冷色玻璃面板
- 暖色像素拟物角色（像素小恐龙吉祥物）
- 设计铁律："UI 冷、角色暖，冷暖对冲"

**核心原则**（来自 AI管家设计方案.md，虽架构已废弃但产品原则仍有效）：
- 本地优先：所有 AI 推理本地运行，不依赖云端
- 最小权限：四级信任模型 L0-L3，默认 L1
- 能力与情绪正交：工具能力与情绪状态独立
- 可逆可审计：所有操作可回滚、有日志
- 人类在环：高风险操作需用户确认
- 执行权单一：最终执行权归 Electron 主进程

### 3.2 已实现目标

| 目标 | 状态 | 说明 |
|---|---|---|
| 从 eIsland fork 并改名汐月 | ✅ | 品牌/身份层已统一 |
| Electron 架构迁移 | ✅ | 2026-08-30 从 Tauri2+Rust 转向 Electron |
| 灵动岛三档尺寸 + 独立窗 | ✅ | 5 阶段全部完成 |
| 全本地 AI 推理 | ✅ | Ollama + faster-whisper + kokoro，删除腾讯云 STT |
| Python Agent 侧车 Phase 0 | ✅ | 自写精简实现，HTTP/SSE 10 端点 |
| 双闸门安全模型 | ✅ | Python policy.py 预检 + 主进程 xiyueFinalCheck 终审 |
| 身份层全链路 | ✅ | xiyue.json → identity.py → 主进程/前端统一 |
| SSE 流式输出 | ⚠️ 模拟 | 完整回复后人工切片，非真流式 |
| 语音输入/输出 | ✅ | 渲染层录音 → STT → LLM → TTS |
| 浏览器自动化 | ✅ | Playwright 6 工具 |
| 记忆 L0/L1 | ⚠️ 部分 | L0 对话历史正常，L1 working_memory 已过期不清理，L2 SQLite 长期记忆**未接入** |
| 情绪系统 | ⚠️ 部分 | identity.py 2 状态（calm/tired）初始化后不更新，emotion.py 6 状态**未接入** |
| 长截图功能 | ✅ | r60 版本，双引擎 + DP 拼接 + 三重防护 |
| 亮度/音量常驻 serve 模式 | ✅ | 提速 40 倍 |
| 设置页独立化 | ✅ | 工具类全部迁独立工具箱窗口 |
| 网易云音乐集成 | ✅ | 登录/喜欢同步/歌词精确匹配 |
| 14 个原生系统插件 | ⚠️ 13/14 | hardware-info-helper 为孤儿未集成 |
| 设计风格指南 | ✅ | DESIGN_STYLE_GUIDE.md |
| 文档体系 | ✅ | 13 份根目录文档 + 公告 + 设计原型 + 法律文档 |

### 3.3 未实现 / 计划中

| 目标 | 状态 | 说明 |
|---|---|---|
| Agent 侧车"换脑" | 📋 草案 | 移植 desk-pet hermes_core 的 memory/emotion/soul/time 四模块，见方案_存储与移植规划_v1.0.md，5 个决策点待拍板 |
| 数据目录统一收口 | 📋 草案 | 统一到 %APPDATA%\xiyue\，分 data/logs/cache，同上方案 |
| 真流式 LLM 调用 | ❌ 未实现 | 当前为非流式 + 人工切片，首字延迟 = 完整推理时间 |
| SQLite 长期记忆接入 | ❌ 未实现 | store.py 已写好但从未被 server.py 调用，3 条测试数据 |
| 情绪状态机接入 | ❌ 未实现 | emotion.py 6 状态 compute_emotion 从未被调用 |
| silero-vad 接入 | ❌ 未实现 | 已安装但主链路未调用 |
| 唤醒词 | ❌ 空 stub | wake.py 无实际实现 |
| 工具定义统一 | ❌ 双轨制 | server.py 内联 20 工具 vs schemas/tool_schema.json 17 工具，命名空间不同，后者有编码损坏且从未加载 |
| Phase 2 会话检索 FTS5 | 📋 计划 | 方案中 Phase 2，引入 SQLite FTS5 全文检索 |
| Phase 3 外围归位 | 📋 计划 | OCR/eIsland_store 废弃归位 |
| 4 个 node-gyp 插件预编译 | 📋 遗留 | 当前需本机编译，影响分发 |
| AI 设置页残留清理 | 📋 遗留 | 汐月Electron版现状.md 中记录 |
| 成功执行路径审计 | 📋 遗留 | 当前只有失败/拒绝审计 |

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
│  窗口管理 / IPC 路由(~180 channel) / 侧车 spawn  │
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
3. **全本地 AI**：删除腾讯云 STT，改用 faster-whisper + Ollama + kokoro，数据不出本机
4. **双闸门安全**：Python policy.py 做工具权限预检，Electron 主进程做最终裁决（xiyueFinalCheck），执行权单一归主进程
5. **原生插件 file: 符号链接注入**：14 个插件通过 package.json 的 file: 依赖符号链接注入，无需发布到 npm

### 4.2 Electron 应用层实现

#### 主进程
- **入口** `src/main/index.ts`（1056 行）：负责窗口创建、Python 侧车 spawn（每 30s 健康巡检）、IPC 注册、全局事件管理
- **IPC 六域**：agent（AI 对话/工具/语音）、app（配置/更新/账户）、media（音乐/SMTC/歌词）、settings（设置读写）、system（系统控制/剪贴板/下载）、window（窗口/灵动岛状态）
- **服务层**：SMTC 服务（C# DLL → Worker 线程 → smtcService 三层架构）、通知监听、自动更新等
- **下载引擎**：MultiThreadDownloadEngine，Range 分块 + 并发 fetch + part 文件合并 + 断点续传

#### 预加载层
- `src/preload/`：通过 contextBridge 暴露安全 API 给渲染层，隔离渲染层与 Node.js
- 类型定义在 `src/preload/types/`

#### 渲染层
- **状态机**：`src/renderer/components/states/` 下 13 个子目录，每个是一个灵动岛状态
  - 状态转换由鼠标交互（idle→hover→expanded→maxExpand）、音乐事件（→lyrics）、通知（→notification）、语音流程（→stt→agent）、CLI 检测（→cli）驱动
  - 尺寸从 260×42（胶囊）到 860×400（大面板）
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

### 4.3 Agent 侧车实现

#### HTTP/SSE API（10 个端点）

| 方法 | 路径 | 用途 | 流式 |
|---|---|---|---|
| GET | /health | 健康检查 | 否 |
| GET | /identity | 获取身份信息 | 否 |
| GET | /emotion | 获取情绪状态 | 否 |
| POST | /voice | 服务端录音→STT→LLM→TTS（备用，固定 12s） | 否 |
| POST | /chat | 文字对话（完整回复） | 否 |
| POST | /transcribe | 语音转文字（faster-whisper） | 否 |
| POST | /chat/stream | 文字对话（SSE 模拟流式） | 是 |
| POST | /tool-result | 工具执行结果回传 | 否 |
| POST | /browser | 浏览器自动化（Playwright） | 否 |

**SSE 事件类型**（5 种）：think / tool_call_request / chunk / final / error

#### Agent 主循环
1. 收到用户消息 → 构建 prompt（persona + 历史≤10轮 + working_memory）
2. Ollama qwen3-4b-32k 非流式调用
3. 解析回复中的工具调用请求
4. 如需工具：policy.py 预检 → 返回 tool_call_request 事件
5. Electron 主进程终审（xiyueFinalCheck）→ 执行工具 → /tool-result 回传
6. 拿到完整回复 → 按 8 字符 + 20ms 人工切片 → chunk 事件推送
7. final 事件结束

#### 记忆系统
- **L0 对话历史**：history.py，内存中维护 ≤10 轮，正常工作
- **L1 工作记忆**：working.py → working_memory.json，当前 1 条已过期 8 天未清理
- **L2 长期记忆**：store.py → memory.db（SQLite），**已写好但从未被 server.py 调用**，3 条手动测试数据
  - SQLite schema（推断，需读源码确认）：包含 memories 表，支持 add/search 方法
  - `_DEFAULT_DB_PATH` 硬编码相对路径，是已知待改造点

#### 情绪系统
- **identity.py**：2 状态（calm/tired），初始化后不更新，实际生效
- **emotion.py**：6 状态 compute_emotion，**从未被调用**，完整实现但未接入

#### 权限 gate
- `gate/policy.py`：工具权限预检策略
- 双闸门：Python 预检 → Electron 主进程 xiyueFinalCheck 终审 → xiyueAuditLog 审计（logs/xiyue-tools.log）

#### 工具系统
- **内联定义**：server.py 内联 20 个工具定义
- **Schema 定义**：schemas/tool_schema.json 17 个工具，**命名空间完全不同，有编码损坏，从未被加载**
- 浏览器工具：Playwright 6 个（导航/截图/点击/输入/获取文本/执行 JS）

### 4.4 语音链路实现

```
录音（渲染层 getUserMedia，主路径）
  → /transcribe → faster-whisper base（CPU int8，138MB 模型）
  → 文本 → /chat/stream → Ollama
  → 回复文本 → kokoro TTS（zf_xiaobei，24k wav）→ pyttsx3 兜底
  → 渲染层播放
```

- **STT**：faster-whisper base 模型，默认 CPU int8 推理，模型文件 138MB 在 data/models/faster-whisper-base/
- **TTS**：kokoro 合成 24kHz wav，音色 zf_xiaobei；pyttsx3 作为兜底（系统 SAPI）
- **VAD**：silero-vad 已安装在 .venv，**但主链路未调用**（vad.py 存在但未被 server.py 引用）
- **唤醒词**：wake.py 是空 stub，无实际实现
- **备用路径**：服务端 sounddevice 固定录 12 秒 → /voice，延迟不可接受，不推荐

### 4.5 原生插件实现

**14 个插件目录**（命名仍保留 eisland 前缀，历史遗留）：

| 插件 | 功能 | 语言 | 加载方式 |
|---|---|---|---|
| application-icon-helper | 应用图标提取（PID/进程名/快捷方式） | C# | koffi FFI |
| bluetooth-helper | 蓝牙监控与设备管理 | C# | koffi FFI（双实现：src + bt-ctypes） |
| brightness-helper | 亮度调节（DDC/CI + WMI） | C# | 常驻 daemon |
| fullscreen-detector | 全屏检测 | C | node-gyp N-API |
| hardware-info-helper | 硬件信息读取 | C# | **孤儿，未集成** |
| performance-monitor | 性能监控（CPU/内存/温度） | C + C# | node-gyp N-API + temperature-helper |
| power-helper | 电源状态监控 | C# | koffi FFI（双实现：src + pw-ctypes） |
| processes-attacker | 进程管理（结束进程） | C | node-gyp N-API |
| screenshot-helper | 屏幕截图（GDI BitBlt） | C# | koffi FFI |
| smtc-helper | SMTC 媒体控制 | C# | koffi FFI（双实现：src + smtc-ctypes） |
| toast-listener | Windows Toast 通知监听 | C++ | node-gyp N-API |
| volume-analyzer | 音量可视化分析（FFT） | C# | koffi FFI |
| volume-helper | 音量控制（CoreAudio） | C# | 常驻 daemon |
| wifi-helper | WiFi 状态监控 | C# | koffi FFI（双实现：src + wf-ctypes） |

**加载方式说明**：
- **C# Native AOT + koffi FFI**：C# 编译为 Native AOT DLL，通过 koffi（Node.js FFI 库）加载，无需 node-gyp 编译
- **C/C++ node-gyp N-API**：C/C++ 源码通过 node-gyp 编译为 .node 原生模块，4 个插件需本机编译
- **常驻 serve 模式**：brightness-helper 和 volume-helper 采用 daemon 常驻进程模式，避免每次调用冷启动，提速 40 倍

### 4.6 安全模型

**双闸门架构**：
1. **第一闸门（Python 侧车）**：`gate/policy.py` 对工具调用做权限预检，判断工具是否允许执行
2. **第二闸门（Electron 主进程）**：`xiyueFinalCheck` 做最终裁决，执行权单一归主进程
3. **审计日志**：`xiyueAuditLog` 记录所有工具调用到 `logs/xiyue-tools.log`

**四级信任模型**（L0-L3，来自已废弃的 AI管家设计方案，当前实现程度待确认）：
- L0 观察员：只读信息
- L1 协助员：可执行低风险操作（默认）
- L2 操作员：可修改系统设置
- L3 自主员：可自主执行高风险操作

**已知安全缺口**：
- 成功执行路径未审计（只有失败/拒绝有日志）
- 工具定义双轨制可能导致策略覆盖不全

---

## 五、技术债务与问题汇总

### 5.1 高优先级（影响核心功能或安全）

| # | 问题 | 影响 | 来源 |
|---|---|---|---|
| 1 | **SQLite 长期记忆完全未接入主链路** | store.py 的 add/search 从未被调用，3 条测试数据，Agent 无长期记忆能力 | Agent 侧车调查 |
| 2 | **情绪状态机未接入** | emotion.py 6 状态 compute_emotion 从未被调用，实际只用 identity.py 2 状态且初始化后不更新 | Agent 侧车调查 |
| 3 | **工具定义双轨制** | server.py 内联 20 工具 vs schemas/tool_schema.json 17 工具，命名空间不同，后者有编码损坏且从未加载，可能导致权限策略覆盖不全 | Agent 侧车调查 |
| 4 | **LLM 非流式 + 人工切片** | 首字延迟 = 完整推理时间，用户体验差，SSE 的 chunk 是假流式 | Agent 侧车调查 |
| 5 | **tmp/ 和 tts/ 只写不删** | 无清理机制，磁盘空间持续增长（当前 tmp/ 不存在但 tts/ 需检查） | Agent 侧车调查 |
| 6 | **4 个 node-gyp 插件需本机编译** | 影响分发，用户需安装 Visual Studio Build Tools | Electron 层调查 |

### 5.2 中优先级（影响体验或可维护性）

| # | 问题 | 影响 | 来源 |
|---|---|---|---|
| 7 | silero-vad 已装但未被主链路调用 | 语音输入无端点检测，需手动控制录音时长 | Agent 侧车调查 |
| 8 | 唤醒词是空 stub | 无语音唤醒能力 | Agent 侧车调查 |
| 9 | working_memory.json 1 条已过期 8 天未清理 | 工作记忆无过期清理机制 | Agent 侧车调查 |
| 10 | 插件命名仍为 eisland 前缀 | 品牌不一致，14 个插件目录和 package.json 依赖名 | Electron 层调查 |
| 11 | 4 个巨型文件（app.ts 2500+ 行等） | 可维护性差 | Electron 层调查 |
| 12 | media volume 为 stub | 音量控制功能不完整 | Electron 层调查 |
| 13 | notificationSlice 冗余 | 状态管理有冗余 | Electron 层调查 |
| 14 | Node>=25 / TS7 版本激进 | 兼容性风险，部分依赖可能不支持 | Electron 层调查 |
| 15 | AI 设置页残留清理 | 设置页有未清理的旧配置 | 汐月Electron版现状 |
| 16 | 成功执行路径未审计 | 安全审计不完整 | 汐月Electron版现状 |

### 5.3 低优先级（清理/优化类）

| # | 问题 | 影响 | 来源 |
|---|---|---|---|
| 17 | 品牌残留基础设施不可改名（eisland-media 协议、com.eisland.app 等） | 品牌不一致但改造成本高 | 汐月Electron版现状 |
| 18 | hardware-info-helper 是孤儿插件 | 未集成，占空间 | Electron 层调查 |
| 19 | CHANGE_LOG.md 有 GBK 编码乱码 | 阅读体验差 | 文档整理 |
| 20 | LEGAL 文档联系邮箱为上游 eIsland | Xiyue fork 正式发布前需评估 | 文档整理 |
| 21 | 项目垃圾约 1.36 GB 未清理 | 磁盘空间浪费 | 清理清单 |

---

## 六、下一步建议

### 立即执行（清理类，低风险）
1. **执行项目清理**：根据 `Xiyue_Cleanup_Report_2026-09-10.md` 的清理清单，释放约 1.36 GB 空间
   - 第一批（安全无风险）：__pycache__、tsbuildinfo、OCR 调试垃圾（_ls_*/_r*）、根目录错位 traineddata
   - 第二批（可重建）：插件 bin/obj/build 编译产物（627MB）、out/ 构建产物（79MB）、APPDATA Cache（427MB）
   - 第三批（需确认）：data_backup 重复模型（141MB，确认与 data/models/ 完全相同后删除）

### 短期（1-2 周，核心功能补全）
2. **Agent 侧车"换脑"**：推进方案_存储与移植规划_v1.0.md，先拍板 5 个决策点，然后移植 desk-pet hermes_core 的 memory/emotion/soul/time 四模块
   - 优先接入 SQLite 长期记忆（解决高优先级问题 #1）
   - 接入情绪状态机（解决 #2）
   - 统一工具定义（解决 #3）
3. **真流式 LLM 调用**：将 Ollama 调用改为流式，消除人工切片（解决 #4）
4. **接入 silero-vad**：语音输入增加端点检测（解决 #7）

### 中期（1-2 月，体验优化）
5. **数据目录统一收口**：按方案_存储与移植规划_v1.0.md 统一到 %APPDATA%\xiyue\，实现 cache/logs 自动清理（解决 #5、#9）
6. **node-gyp 插件预编译**：为 4 个 C/C++ 插件提供预编译二进制（解决 #6）
7. **设置页清理 + 审计补全**：清理 AI 设置页残留，补全成功执行路径审计（解决 #15、#16）
8. **插件品牌重命名**：评估 eisland 前缀改名成本（解决 #10）

### 长期（规划中）
9. **Phase 2 会话检索 FTS5**：引入 SQLite FTS5 全文检索
10. **Phase 3 外围归位**：OCR/eIsland_store 废弃归位
11. **唤醒词实现**：基于 wake.py 实现语音唤醒（解决 #8）

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

### 7.2 清理清单摘要（详见 Xiyue_Cleanup_Report_2026-09-10.md）

**可释放空间总计：约 1.36 GB**

| 区域 | 大小 | 建议动作 |
|---|---|---|
| 插件 bin/obj/build 编译产物 | 627.46 MB | 删除（有源码可重建） |
| APPDATA Cache + Code Cache | 427.20 MB | 删除（自动重建） |
| data_backup 重复模型 | 141.03 MB | 确认后删除 |
| out/ Electron 构建产物 | 78.94 MB | 删除（npm run build 可重建） |
| OCR screenshot/frames 调试帧 | 56.18 MB | 删除 |
| OCR _ls_* + _r* 调试系列 | 43.35 MB | 删除（128 个文件） |
| 根目录错位 traineddata | 7.67 MB | 移至 OCR 目录或删除 |
| 其余（日志/缓存/空目录等） | ~8 MB | 删除 |

**不可清理**：.workbuddy/（473 KB，工作记忆体系）、src/、agent/、voice/、docs/、node_modules/、.venv/、data/models/

### 7.3 本次调查报告清单

| 报告 | 路径 | 覆盖范围 |
|---|---|---|
| 本报告 | docs/Xiyue_全面调查报告_v1.0.md | 全项目三层综合 |
| Electron 源码调查报告 | docs/Xiyue_Electron_Source_Audit.md | src/main + preload + renderer + plugins |
| Agent/语音源码调查报告 | docs/Xiyue_Agent_Voice_Source_Audit.md | agent/ + voice/ + data/ |
| 文档索引 | docs/README.md | docs/ 全部分类索引 |
| 清理清单 | Xiyue_Cleanup_Report_2026-09-10.md | 项目 + OCR + APPDATA 垃圾扫描 |

---

> **报告结束**。如需对某个模块做更深入的逐行分析，或推进清理/换脑等下一步行动，请指示。
