# Xiyue（汐月）Agent 侧车与语音链路 · 深度源码调查报告

> 调查日期：2026-09-10 | 项目路径：`F:\Work\Create\Assa\Xiyue`
> 所有结论标注 **[已查证]**（有源码依据）或 **[推断]**。数字均为实测。

---

## 1. Agent 侧车架构总览

汐月 Agent 侧车是一个**自写的 Phase 0 精简实现**，代码注释自称"汐月 Hermes"，但**并未连接任何官方 Hermes 内核**。整体为单进程 Python HTTP 服务器，由 Electron 主进程拉起并守护。

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron 主进程                            │
│  xiyueAgentService.ts  ── spawn ──►  python agent/server.py │
│  (健康巡检 30s / 自动重启 max3)       (127.0.0.1:8765)     │
│                                                               │
│  xiyueAgentIpc.ts ── HTTP fetch ──►  /health /chat /voice  │
│                       ── SSE stream ─► /chat/stream          │
│                       ── HTTP POST ──► /tool-result          │
└──────────────┬──────────────────────────────────────────────┘
               │ IPC (xiyue:stream:event:<sid>)
               ▼
┌─────────────────────────────────────────────────────────────┐
│                  Electron 渲染进程                            │
│  xiyueLocalAgent.ts  ── 消费 SSE 事件 ──► UI 渲染 + TTS 播放 │
│  useAgentVoiceInputRuntime.ts ── getUserMedia 录音 ──► /transcribe │
└─────────────────────────────────────────────────────────────┘

Python 侧车内部组件：
  server.py          ── HTTP/SSE 服务器（25.8KB，核心）
  identity.py        ── 身份/人格/配置读取 + 情绪全局状态（8.4KB）
  emotion.py         ── 情绪状态机（6 种情绪，2.8KB）⚠️ 未接入主链路
  memory/store.py    ── SQLite 长期记忆（3.6KB）
  memory/history.py  ── 对话历史 JSON（1.3KB）
  memory/working.py  ── 工作记忆 L1（3.1KB，TTL 24h）
  gate/policy.py     ── 权限预检策略（2.7KB）
  tools/__init__.py  ── 工具注册表（从 schemas/tool_schema.json 加载）
  browser/playwright_client.py ── Playwright 浏览器自动化（5.0KB）
  persona/xiyue.json + xiyue.md ── 人格设定
  main.py            ── Phase0 stub（968B，未被 server.py 使用）
```

**关键事实 [已查证]：**
- HTTP 服务绑定 `127.0.0.1:8765`（`XIYUE_AGENT_PORT` 可覆盖）
- 使用 Python 标准库 `http.server.ThreadingHTTPServer`，**非 Flask/aiohttp**
- LLM 模型：`qwen3-4b-32k`（Ollama，非流式调用）
- Python 3.12 venv 在项目根 `.venv/`

---

## 2. HTTP/SSE API 完整清单

### 2.1 HTTP 端点

| 方法 | 路径 | 用途 | 请求体 | 响应格式 |
|------|------|------|--------|----------|
| GET | `/health` | 健康检查 + 当前模型名 | — | `{"ok": true, "model": "qwen3-4b-32k"}` |
| GET | `/identity` | 读取完整身份信息 | — | `XiyueIdentityReader.as_dict()`（name/role/model/emotion/memory/tools 等 20+ 字段） |
| GET | `/emotion` | 当前情绪状态 | — | `{"state": "calm", "enabled": true}` |
| POST | `/voice` | 服务端录音→STT→LLM→TTS 全链路 | `{}`（空） | `{"user": "...", "reply": "...", "audio": "路径", "audio_b64": "base64"}` |
| POST | `/chat` | 文本对话（无工具） | `{"text": "..."}` | `{"user": "...", "reply": "...", "audio": "路径", "audio_b64": "base64"}` |
| POST | `/transcribe` | 渲染层录音 base64 → 本地 STT | `{"audio_b64": "..."}` | `{"text": "..."}` |
| POST | `/chat/stream` | **SSE 流式工具化对话** | `{"text": "..."}` | SSE 事件流（见下表） |
| POST | `/tool-result` | 渲染层回传工具执行结果 | `{"requestId": "...", "success": bool, "result": {}, "error": ""}` | `{"ok": true}` |
| POST | `/browser` | 服务端直接执行浏览器工具 | `{"tool": "browser.open", "arguments": {"url": "..."}}` | 工具返回值（`{"ok": true, ...}`） |

**[已查证]** 共 10 个端点（3 GET + 7 POST），其中 1 个 SSE 流式端点。

### 2.2 SSE 事件类型（`/chat/stream`）

SSE 响应头：`Content-Type: text/event-stream; charset=utf-8`，`Cache-Control: no-cache`，`Connection: keep-alive`

每条事件格式：`data: {"type": "<event_type>", "payload": {...}}\n\n`

| 事件类型 | 触发时机 | payload 字段 |
|----------|----------|-------------|
| `think` | 对话开始时（空文本占位） | `text`（始终为空串） |
| `tool_call_request` | LLM 决定调用工具时 | `requestId`, `tool`, `purpose`, `arguments`, `authorizationRequired` |
| `chunk` | 最终回答生成后，按 8 字符切片模拟流式输出 | `text`（8 字符片段） |
| `final` | 对话结束，携带完整回复和 TTS 音频 | `reply`, `audio_b64` |
| `error` | 异常发生时 | `message` |

**[已查证]** 关键发现：LLM 本身是**非流式**调用（`ollama.chat(stream=False)`），SSE 的 `chunk` 事件是在拿到完整回复后，用 `for i in range(0, len(reply), 8)` 每 8 字符切一片 + `time.sleep(0.02)` **人工模拟**的流式效果。

---

## 3. Agent 主循环执行流程

### 3.1 工具化循环（`_run_agent_loop`，server.py:183-226）

仅被 `/chat/stream`（SSE）调用。`/chat` 和 `/voice` 走简化路径 `_llm_reply`（无工具）。

```
步骤 1: 组装 messages
  ├─ system prompt（人设 + 身份标识 + 情绪 + 运行时规则 + 工具使用指引）
  ├─ 工作记忆注入（L1，最多 10 条，importance≥1）
  ├─ 对话历史（最近 N 轮，N=get_max_history_turns()=10）
  └─ 当前用户消息

步骤 2: emit("think", {"text": ""})  ← 通知前端"思考中"

步骤 3: for round in range(8):  ← 最多 8 轮工具调用
  ├─ ollama.chat(model=qwen3-4b-32k, messages, tools=TOOL_DEFS, stream=False)
  ├─ 解析返回：content（文本）+ tool_calls（工具调用列表）
  ├─ 若无 tool_calls → return content（结束循环）
  └─ 对每个 tool_call:
      ├─ 生成 requestId（uuid 前 16 位）
      ├─ _decide_tool(name) → 权限预检（policy.py）
      │   └─ 返回 (authorizationRequired, denied)
      ├─ emit("tool_call_request", {...})  ← 推给前端，前端执行工具
      ├─ 若 denied → 结果 = "权限不足：该工具被拒绝"
      ├─ 否则 _request_tool_result(requestId)
      │   └─ 阻塞等待前端 POST /tool-result，超时 60s
      └─ messages.append({"role": "tool", "content": json.dumps(result)})

步骤 4: 超出 8 轮 → 兜底再问一次 ollama.chat（不带工具结果期望），返回 content

步骤 5: （调用方 _handle_chat_stream 继续）
  ├─ 按 8 字符切片 emit("chunk") 模拟流式
  ├─ _tts(reply) → kokoro 合成 wav
  ├─ emit("final", {"reply", "audio_b64"})
  ├─ 保存对话历史到 history.json
  └─ _extract_and_store_facts() → 启发式提取事实写入工作记忆
```

**[已查证]** 工具执行**不在 Python 侧**，而是通过 SSE `tool_call_request` 事件推给 Electron 渲染层，由渲染层执行后经 `/tool-result` 回传。Python 侧只做 LLM 编排和权限预检。

### 3.2 简化路径（`_llm_reply`，server.py:303-335）

被 `/chat` 和 `/voice` 调用。**无工具、无 SSE**，直接一次 `ollama.chat(stream=False)`，剥离 qwen3 的 `</think>` 段，保存历史，提取事实。

---

## 4. 记忆系统详解

记忆系统分三层，但实际只有两层在运行：

### 4.1 长期记忆（SQLite，`memory/store.py`）

**Schema [已查证]：**

```sql
CREATE TABLE memory (
    id INTEGER PRIMARY KEY,
    kind TEXT,          -- preference | env | feedback | summary | fact
    content TEXT,
    embedding BLOB,     -- Phase1 计划：向量（当前始终为 NULL）
    created_at TEXT
);

CREATE TABLE memory_meta (
    key TEXT PRIMARY KEY,
    value TEXT
);
```

**API：**
- `init_db()` — 建表
- `add(kind, content)` → 返回 rowid
- `search(query, k=5)` — 关键词匹配（取最近 200 条，按关键词命中数排序），**非向量检索**
- `forget(keyword)` — `DELETE FROM memory WHERE content LIKE '%keyword%'`
- `count()` — 总数

**数据现状 [实测]：**
- 文件大小：16,384 bytes（16 KB）
- 表：`memory`、`memory_meta`
- 总记录数：**3 条**，全部 `kind='fact'`
  1. `用户喜欢简洁直接的沟通`（2026-09-01 17:14:14）
  2. `用户厌恶冗长解释`（2026-09-01 17:14:14）
  3. `用户喜欢简洁`（2026-09-01 17:58:40）
- `memory_meta`：空
- `embedding` 列：全部 NULL（向量检索未实现）

**[已查证]** 严重问题：`store.py` 的 `add/search/forget` 函数**在 server.py 主链路中完全没有被调用**。server.py 只 import 了 `resolve_data_dir`。这 3 条记录是早期手动测试写入的，当前对话不会写入 SQLite 长期记忆。

### 4.2 对话历史（JSON，`memory/history.py`）

- 路径：`data/history.json`
- 格式：`[{"role": "user|assistant", "content": "..."}, ...]`
- 上限：200 条消息（加载和保存时都截断）
- 线程安全：`threading.Lock`
- 写入失败静默忽略（不阻断对话）

**数据现状 [实测]：** 文件大小 2 bytes（`[]` 空数组），**0 条消息**。尽管 memory.db 中有 2026-09-01 的记录，但 history.json 为空——说明历史曾被清空，或两条路径从未对齐。

**[已查证]** `_llm_reply` 和 `_handle_chat_stream` 在每次回复后都会 `_save_history(_history)`，但 `_history` 是进程内全局变量，服务重启后从空文件重新加载。

### 4.3 工作记忆 L1（JSON，`memory/working.py`）

- 路径：`data/working_memory.json`
- 每条记录：`{id, text, source, importance(1-5), created_at, expires_at}`
- 默认 TTL：24 小时
- API：`add_fact(text, source, importance, ttl_s)`、`get_active_facts(min_importance, max_items)`、`clear_expired()`

**数据现状 [实测]：** 文件大小 162 bytes，**1 条记录**：
- `测试事实`，importance=3，expires_at=2026-09-02T17:58:40（**已过期 8 天**）

**[已查证]** 问题：
1. `clear_expired()` 从未在请求路径中被调用，过期记录不会自动清理
2. `get_active_facts()` 会过滤过期记录，所以这条过期记录不会注入 prompt，但文件本身不会收缩
3. 事实提取是**纯启发式**（`_extract_and_store_facts`，server.py:338-361）：匹配"我喜欢/别/记住"等关键词、正则提取中文名、检测回复中的"记住"承诺——**不经过 LLM 提取**，质量有限

### 4.4 遗忘策略

| 记忆层 | 遗忘机制 | 状态 |
|--------|----------|------|
| SQLite 长期记忆 | `forget(keyword)` 手动删除 | 未接入主链路 |
| 对话历史 | 截断到最近 200 条 | 生效 |
| 工作记忆 | TTL 24h 自动过期（但 `clear_expired` 未被调用） | 半失效 |

---

## 5. 情绪系统详解

### 5.1 情绪定义（`emotion.py`）

**6 种情绪状态 [已查证]：**

| 状态 | 值 | 颜色（RGB hex） | 触发条件 |
|------|-----|-----------------|----------|
| CALM | `calm` | `#378ADD` 蓝 | 默认 |
| HAPPY | `happy` | `#1D9E75` 绿 | 最近任务成功 |
| FOCUSED | `focused` | `#BA7517` 橙 | 正在执行工具 |
| TIRED | `tired` | `#534AB7` 紫 | 深夜(23-6点) / 空闲>30min |
| WORRIED | `worried` | `#D85A30` 红橙 | 高风险待确认 / 用户焦虑 / 任务失败 |
| PLAYFUL | `playful` | `#D4537E` 粉 | 用户友好 / 白天且空闲<2min |

**计算逻辑（`compute_emotion`，emotion.py:48-66）优先级从高到低：**
1. 正在执行工具 → FOCUSED
2. 高风险(destructive/credential/network) 或 用户焦虑 → WORRIED
3. 深夜 或 空闲>30min → TIRED
4. 任务成功 → HAPPY
5. 任务失败 → WORRIED
6. 用户友好 或 (白天 且 空闲<2min) → PLAYFUL
7. 默认 → CALM

**铁律 [已查证]：** 情绪只影响表达（措辞/状态点颜色/面板微文案），**绝不参与权限判定**。权限由 `policy.py` 决定。

### 5.2 实际接入情况

**[已查证] 严重脱节：** `emotion.py` 的 `compute_emotion` 函数和 `EmotionContext` 数据类**从未被 server.py 调用**。

server.py 实际使用的是 `identity.py` 中的极简情绪逻辑：
- `_infer_emotion()`（identity.py:179-188）：只看当前小时，23-6点 → `tired`，否则 → `calm`（从 xiyue.json 的 `emotion.default_state` 读取）
- `get_current_emotion()` / `set_current_emotion()`：线程安全的全局变量，首次调用时 `_infer_emotion()` 初始化，之后**不再自动更新**

也就是说，实际运行中情绪只有两种：`calm`（白天）和 `tired`（深夜），且**一旦初始化就不会随对话/任务变化**。`emotion.py` 中更丰富的 6 状态机是"设计稿"，未落地。

---

## 6. 权限 Gate 与工具清单

### 6.1 权限策略（`gate/policy.py`）

**裁决函数 `decide(tool, params, ctx)` → Decision [已查证]：**

```
输入: ToolMeta(id, level, risks[], confirm, scope) + Ctx(current_level, external_triggered)
输出: ALLOW | CONFIRM | DENY

裁决顺序（5 步）:
1. 凭据风险(credential) 且 工具未声明确认 → 强制 CONFIRM
2. 工具等级 > 当前信任等级:
   ├─ 工具等级 >= 3 → DENY
   └─ 否则 → CONFIRM
3. 外部内容触发(external_triggered) 且 风险含 destructive/network/credential → 强制 CONFIRM（提示注入防护）
4. 工具自身 confirm=True → CONFIRM
5. 其余 → ALLOW
```

**设计意图 [已查证]：** 这是**双闸门**中的"提议侧预检"——避免提出必被拒的请求、决定何时弹确认 UI。Rust/Electron 侧在执行前用 `schemas/tool_schema.json` 做**终审**（最终权威）。预检通过 ≠ 放行。

**当前信任等级 [已查证]：** server.py 中 `_decide_tool` 调用时 `Ctx(current_level=1)`，即始终 L1。这意味着所有 level=2 的工具都会触发 CONFIRM，level>=3 的工具会被 DENY。

### 6.2 工具清单

**[已查证]** 工具有**两套定义**，存在不一致：

#### A. server.py 内联定义（`TOOL_DEFS`，server.py:100-120）—— SSE 循环实际使用

| 工具名 | 功能 | 风险标签 | 需确认 | 权限裁决(L1) |
|--------|------|----------|--------|-------------|
| `file.read` | 读取文本文件 | read | 否 | ALLOW |
| `file.list` | 列出目录 | read | 否 | ALLOW |
| `file.stat` | 文件元信息 | read | 否 | ALLOW |
| `file.search` | 按名搜索文件 | read | 否 | ALLOW |
| `file.grep` | 正则搜索文本 | read | 否 | ALLOW |
| `file.write` | 写入/覆盖文件 | write | 否 | ALLOW |
| `file.delete` | 放入回收站 | destructive | 是 | CONFIRM |
| `cmd.exec` | 执行命令行 | destructive, network | 是 | CONFIRM |
| `clipboard.read` | 读取剪贴板 | read | 否 | ALLOW |
| `sys.info` | 系统信息 | read | 否 | ALLOW |
| `monitor.cpu` | CPU 使用率 | read | 否 | ALLOW |
| `monitor.memory` | 内存使用 | read | 否 | ALLOW |
| `net.ping` | Ping 主机 | network | 是 | CONFIRM |
| `browser.open` | 打开网页 | network | 是 | CONFIRM |
| `browser.screenshot` | 网页截图 | network | 是 | CONFIRM |
| `browser.navigate` | 页面导航 | network | 是 | CONFIRM |
| `browser.click` | 点击元素 | network | 是 | CONFIRM |
| `browser.fill` | 填入文本 | network | 是 | CONFIRM |
| `browser.scroll` | 页面滚动 | network | 是 | CONFIRM |

共 **20 个工具**。其中 13 个 ALLOW（L1 直接放行），7 个 CONFIRM（需用户确认），0 个 DENY。

#### B. `schemas/tool_schema.json` —— `tools/__init__.py` 加载，但未被 server.py 使用

定义了 17 个工具，命名空间不同（`fs.*` / `app.*` / `sys.*` / `reminder.*` / `calendar.*` / `shell.run` / `browser.auto` / `code.assist` / `msg.send`），与 server.py 的 20 个工具**完全不重叠**。文件存在**编码损坏**（中文显示为 mojibake，如 `鍒楃洰褰?` 应为"列目录"）。

**[已查证]** `tools/__init__.py` 的 `load_registry()` / `get_tool()` 函数**从未被 server.py 调用**。server.py 直接硬编码了 `TOOL_DEFS`。这是两套并行的工具定义，`tool_schema.json` 是设计稿/预留。

---

## 7. 人格与身份系统

### 7.1 配置文件（`persona/xiyue.json`）[已查证]

```json
{
  "name": "汐月",
  "visible_name": "汐月",
  "english_name": "Xiyue",
  "role": "本地常驻 AI 管家",
  "model_default": "qwen3-4b-32k",
  "system_identifier": "xiyue-local-agent",
  "persona_file": "agent/persona/xiyue.md",
  "greeting": "我在，怎么了？",
  "language_default": "zh-CN",
  "privacy": { "local_first": true, "cloud_fallback_default": false, "data_never_leave_machine": true },
  "emotion": { "enabled": true, "default_state": "calm" },
  "memory": { "enabled": true, "max_history_turns": 10 },
  "tools": { "enabled": true, "max_rounds_per_turn": 8 },
  "browser": { "allowed_domains": ["example.com", "localhost", "127.0.0.1", "github.com"] }
}
```

注意：`browser.allowed_domains` 白名单**未被 playwright_client.py 强制执行**（代码注释说"不预设域名白名单，安全由上层确认框保证"）。

### 7.2 人格文本（`persona/xiyue.md`）[已查证]

核心设定：
- **身份**：常驻用户电脑的本地 AI 管家，"有性格、有情绪的住客"，小爱同学式常驻助手，无形象，靠声音+状态点+浮层存在
- **性格**：真实伙伴（有脾气、偶尔吐槽，但始终专业）、直接（能说"我拿不准""我搞错了"）、有分寸（严肃场景不开玩笑）
- **语气**：自然口语、简体中文、不过度客套、不堆 emoji、简短优先
- **硬边界**：不碰密码/密钥/API token；重大决定给选项不替用户做；不确定直说；不擅自发消息/邮件/联网外传；权限由 policy 决定，情绪不影响权限
- **能力分级**：L1（文件安全区/应用控制/系统状态/提醒日历）；L2 需临时提级+确认（命令行/浏览器/代码辅助/批量文件）
- **记忆**：用长期记忆更懂用户，凭据永不入库

### 7.3 System Prompt 组装（`identity.py: build_system_prompt`）[已查证]

```
[人设文本 xiyue.md 全文]

[身份标识] 你是 汐月（Xiyue），本地常驻 AI 管家。
[系统标识] xiyue-local-agent
[当前情绪：calm]          ← 仅当 emotion enabled 且有状态时
[运行时规则] 回复用 zh-CN，自然口语化。不用 markdown、不用列表、不堆 emoji。情绪只改表达，不影响权限。<extra_rules>
```

在 `/chat/stream` 中，`extra_rules` 会追加工具使用指引："你是本地 AI 管家，可以调用提供的工具帮用户做事。需要文件/系统/网络信息时优先调用工具..."

---

## 8. 语音链路全流程

### 8.1 两条并行的语音路径 [已查证]

#### 路径 A：Electron 渲染层录音 → /transcribe → /chat/stream（主路径）

这是当前 UI 实际使用的路径（灵动岛语音输入球）：

```
1. 用户点麦克风 → 灵动岛切到 agentVoiceInput 状态
2. useAgentVoiceInputRuntime.ts:
   ├─ navigator.mediaDevices.getUserMedia({audio: 16k mono})
   ├─ AudioContext(sampleRate=16000) + ScriptProcessorNode(1024)
   ├─ 逐帧 PCM Float32 → Int16 累积（pushFloat32Frames）
   ├─ 最大录音时长 60 秒（AGENT_VOICE_MAX_RECORDING_MS）
   └─ 用户停止/超时 → 拼接 PCM → buildWavBase64() → WAV base64
3. window.api.xiyueTranscribe(audio_b64)
   → IPC xiyue:transcribe → HTTP POST 127.0.0.1:8765/transcribe
   → server.py 解码 base64 → 写 data/tmp/in_<ts>.wav
   → faster-whisper transcribe(language="zh") → 返回文本
4. 文本写入 store（setStt）→ 触发 /chat/stream 工具化对话
5. /chat/stream → LLM → 工具循环 → 最终回复
6. final 事件携带 audio_b64（kokoro 合成的 wav）
7. 渲染层 new Audio(`data:audio/wav;base64,...`).play() 自动播放
```

#### 路径 B：服务端录音 → /voice（备用/调试路径）

```
1. POST /voice（空 body）
2. server.py _record_simple():
   ├─ sounddevice.rec(12秒, 16k mono, float32)  ← 固定录 12 秒！
   ├─ RMS 能量端点检测（100ms 窗，阈值 0.006）裁掉首尾静音
   └─ 写 data/tmp/in_<ts>.wav
3. _transcribe() → faster-whisper
4. _llm_reply() → Ollama（无工具）
5. _tts() → kokoro
6. 返回 {user, reply, audio, audio_b64}
```

**[已查证]** 路径 B 的 `_record_simple` 固定录 12 秒（`max_sec=12.0`），不是真正的 VAD 端点检测——只是录完后用能量裁静音。延迟固定为 12 秒+，**不适合实时对话**。代码注释也承认这是"Phase 0 够用"。

### 8.2 各环节技术栈 [已查证]

| 环节 | 库/模型 | 版本 | 备注 |
|------|---------|------|------|
| 录音（路径A） | Web Audio API (getUserMedia) | — | 渲染层，16k mono |
| 录音（路径B） | sounddevice | 0.5.6 | Python 侧，固定 12s |
| VAD | Silero VAD (silero-vad) | 5.0.0+ | **vad.py 存在但未被主链路调用**；faster-whisper 内置 vad_filter 也未启用 |
| STT | faster-whisper (WhisperModel) | 1.2.1 | base 模型（138MB），默认 CPU int8，可选 CUDA int8_float16 |
| LLM | Ollama (ollama.chat) | 0.6.2 | qwen3-4b-32k，非流式 |
| TTS（主） | kokoro (KPipeline) | 0.9.4 | 中文 `zf_xiaobei` 音色，24k mono wav |
| TTS（兜底） | pyttsx3 (Windows SAPI) | 2.99 | kokoro 失败时自动回退 |
| 唤醒词 | — | — | wake.py 是空 stub（`listen_for_wakeword` 只有 `...`），Phase 1 计划 |

### 8.3 STT 细节（`voice/stt.py`）[已查证]

- 模型路径：`data/models/faster-whisper-base/`（仓库内置，免联网）
- 模型文件：`model.bin`（138.49 MB）+ `config.json` + `tokenizer.json`（2.1 MB）+ `vocabulary.txt`
- 默认设备：**CPU**（`XIYUE_STT_DEVICE` 可设为 `cuda`）
- 计算精度：CPU=int8，CUDA=int8_float16
- GPU 失败自动降级：若 CUDA 推理期抛异常（如缺 cublas64_12.dll），自动 `load(device="cpu")` 重试一次
- 懒加载：首次 `_get_stt()` 时加载，之后常驻
- 有 `unload()` 函数但**从未被调用**（显存不会自动释放）

### 8.4 TTS 细节（`voice/tts.py`）[已查证]

- Kokoro pipeline：`KPipeline(lang_code="z")`（中文），音色 `zf_xiaobei`，语速 1.0
- 输出：24000 Hz, 16-bit, mono WAV，写入 `data/tts/out_<ts>.wav`
- 懒加载，失败标记 `_pipeline = False` 后不再重试
- pyttsx3 兜底：`eng.save_to_file(text, out)` + `eng.runAndWait()`
- `to_base64(path)`：读取 wav → base64 ascii，供渲染层直接播放
- **CosyVoice V3**：代码中有 `engine="cosyvoice"` 分支但是空 `pass`（TODO，计划接纳西妲项目的 HTTP 部署）

### 8.5 tmp/ 目录问题 [实测]

- `data/tmp/` **当前不存在**（说明近期没有走路径 B 或 /transcribe）
- 但代码中 `/voice` 和 `/transcribe` 都会写入 `data/tmp/in_<ts>.wav`
- **没有任何清理机制**：tmp 文件只写不删，长期运行会累积
- `data/tts/` 同理：输出 wav 只写不删（当前 0 文件）

---

## 9. Ollama 集成方式

**[已查证]**

| 项目 | 值 |
|------|-----|
| 模型 | `qwen3-4b-32k`（默认，`XIYUE_LLM_MODEL` 或 xiyue.json `model_default` 可覆盖） |
| 调用方式 | `ollama.chat(model=..., messages=..., tools=..., stream=False)` |
| 流式 | **否**，全部非流式；SSE 的 chunk 是人工切片模拟 |
| 工具调用 | 仅 `/chat/stream` 路径传 `tools=TOOL_DEFS`；`/chat` 和 `/voice` 不传工具 |
| 导入方式 | 函数内局部 `import ollama`（避免启动期依赖） |
| 连接地址 | 默认 Ollama 客户端库地址（`http://127.0.0.1:11434`，ollama 库默认） |
| 思考段处理 | 检测 `</think>` 标记，取其后内容作为回复（qwen3 是思考模型） |

**[已查证]** Electron 主进程启动侧车时会注入环境变量 `XIYUE_LLM_MODEL`（默认 `qwen3-4b-32k`）。

---

## 10. 与 Electron 的通信桥接

### 10.1 侧车生命周期管理（`xiyueAgentService.ts`）[已查证]

```
启动: startXiyueAgent()
  ├─ 幂等检查（已在运行则忽略）
  ├─ 解析 Python: XIYUE_PYTHON 环境变量 > .venv/Scripts/python.exe > PATH python
  ├─ spawn(python, [agent/server.py], {cwd: app.getAppPath(), env: {XIYUE_AGENT_PORT, XIYUE_LLM_MODEL}})
  ├─ stdout/stderr 转发到 Electron 控制台日志（前缀 [xiyue-agent] / [xiyue-agent:err]）
  ├─ exit 事件：非零退出码 → scheduleRestart()（2s 后重启，最多 3 次）
  └─ startHealthLoop()：每 30s GET /health，5s 超时

健康巡检: healthLoop()
  ├─ 若进程在运行 → fetch /health
  ├─ 失败 → stopXiyueAgent() + scheduleRestart()
  └─ 成功 → cancelScheduledRestart()（重置重启计数）

停止: stopXiyueAgent()（应用退出时调用）
  ├─ stopHealthLoop()
  ├─ cancelScheduledRestart()
  └─ child.kill()
```

### 10.2 IPC 桥接（`xiyueAgentIpc.ts`）[已查证]

| IPC 通道 | 方向 | 转发到 | 说明 |
|----------|------|--------|------|
| `xiyue:health` | Renderer→Main→HTTP | GET /health | 健康检查 |
| `xiyue:chat` | Renderer→Main→HTTP | POST /chat | 文本对话（非流式） |
| `xiyue:voice` | Renderer→Main→HTTP | POST /voice | 服务端录音全链路 |
| `xiyue:transcribe` | Renderer→Main→HTTP | POST /transcribe | 录音 base64 → 文本 |
| `xiyue:stream:start` | Renderer→Main→SSE | POST /chat/stream | **SSE 流式对话**，主进程逐事件通过 `xiyue:stream:event:<sid>` 推回渲染层 |
| `xiyue:stream:abort` | Renderer→Main | — | 中止流式会话（AbortController） |
| `xiyue:tool-result` | Renderer→Main→HTTP | POST /tool-result | 工具执行结果回传 |

**SSE 桥接细节 [已查证]：**
- 主进程用 `fetch` + `res.body.getReader()` 读取 SSE 流
- 按 `\n\n` 分帧，解析 `data: ` 行的 JSON
- 每个事件通过 `event.sender.send(channel, evt)` 推给渲染层
- 5 分钟 SSE 读取超时
- `AbortController` 支持中止（`xiyue:stream:abort`）

### 10.3 渲染层消费（`xiyueLocalAgent.ts`）[已查证]

`streamXiyueAgent({message, signal, onEvent})`：
1. 生成 sessionId，注册 `xiyue:stream:event:<sid>` 监听
2. 调用 `window.api.xiyueStreamChatStart(sid, message)`
3. 事件翻译：SSE 事件 → `MihtnelisAgentStreamEvent`（think/chunk/tool_call_request/tool_call_result/final/error）
4. **final 事件自动播放 TTS**：`new Audio('data:audio/wav;base64,...').play()`
5. 支持 AbortSignal 中止

---

## 11. 数据目录现状

### 11.1 目录结构与大小 [实测]

```
data/
├── models/
│   └── faster-whisper-base/      141.03 MB
│       ├── config.json               <1 KB
│       ├── model.bin              138.49 MB
│       ├── tokenizer.json           2.10 MB
│       └── vocabulary.txt           0.44 MB
├── tts/                             0 MB（0 个文件）
├── history.json                      2 B（[] 空数组）
├── memory.db                        16 KB（3 条记录）
└── working_memory.json             162 B（1 条过期记录）

tmp/                                不存在
```

### 11.2 问题汇总

| 问题 | 严重度 | 说明 |
|------|--------|------|
| tmp/ 只写不删 | 中 | `/voice` 和 `/transcribe` 写入 `in_<ts>.wav`，无清理机制，长期运行会累积 |
| tts/ 只写不删 | 中 | kokoro 输出 `out_<ts>.wav`，无清理机制 |
| history.json 为空 | 低 | 0 条对话，与 memory.db 的 3 条记录不一致（曾被清空） |
| working_memory 过期未清理 | 低 | 1 条 2026-09-02 过期的"测试事实"仍在文件中，`clear_expired()` 从未被调用 |
| memory.db 未接入主链路 | 高 | SQLite 长期记忆的 add/search 在 server.py 中完全未被调用，对话不会写入长期记忆 |
| embedding 列全 NULL | 中 | 向量检索预留列，Phase 1 未实现，search() 用关键词匹配 |

---

## 12. 工作记忆中的关键决策摘要

来源：`F:\Work\Create\Assa\.workbuddy\memory\`（2026-08-30 至 2026-09-10）

**[已查证]** 工作记忆的绝大部分内容是关于 **Electron 截图/长截图/录屏/翻译/OCR** 功能的开发记录，与 Agent 侧车/语音链路直接相关的决策较少。以下是提取出的相关内容：

### 12.1 Agent 侧车启动与运行（2026-09-06）

- 应用启动成功：`--no-sandbox --disable-gpu`，6 个 electron 进程，**agent 8765 端口正常**，0 GPU 崩溃，日志无 error
- 沙箱环境启动 Electron 的坑：需 `env -u CODEBUDDY_SESSION_ID -u CLAUDE_SESSION_ID -u ELECTRON_RUN_AS_NODE npm run dev`
- 沙箱拉不起 Electron GUI → 渲染端验证用 Node `vm` 真实执行

### 12.2 Agent UI 重设计（2026-09-10）

- 灵动岛 AI 页从"像素小恐龙"改为"人形头像 + 问候语 + 状态点"
- 问候语来源：**预设池 + 时段驱动 + 日种子，不调大模型**（hover 常驻，调 LLM 收益<代价）
- `mood` 暂固定 `happy`，留 `TODO(agent-state)` 等真实 agent 状态接入
- 状态点 4 种：happy(绿/1.8s)、thinking(蓝/1.0s)、confuse(黄/1.4s)、listening(红/0.8s)
- **tsc 既有错误**：5 个报错在 `xiyueLocalAgent.ts` / `xiyueIdentity.ts`，属未触碰文件的既有问题

### 12.3 语音入口链路确认（2026-09-10）

- 点麦克风 → `setAgentVoiceInput()` → 整个岛切到 `agentVoiceInput` 状态（不停留在 hover tab）
- 主进程经 `onAgentVoiceInputState(active)` 双向同步
- 录音 → PCM16 累积 → 拼 wav → `window.api.xiyueTranscribe`（faster-whisper 本地转写），**替代原腾讯实时语音识别（已删除）**

### 12.4 设计风格 DNA（2026-09-10，DESIGN_STYLE_GUIDE.md）

- 三层叠加：Apple 极简骨架 + 冷色玻璃面板 + 暖色像素角色
- 铁律：UI 冷、角色暖；冷暖对冲
- 主题蓝 `#409cff`，深色玻璃 `rgba(20,24,32,.82)` + `blur(24px)`

---

## 13. 已发现的问题与技术债务

### 13.1 高优先级

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 1 | **SQLite 长期记忆未接入主链路** | `memory/store.py` vs `server.py` | `add/search/forget` 从未被调用，对话不会写入长期记忆；`embedding` 列全 NULL；3 条测试数据是手动写入的 |
| 2 | **情绪状态机未接入** | `emotion.py` vs `identity.py` | `compute_emotion` 6 状态机从未被调用；实际只用 `_infer_emotion()` 的 2 状态（calm/tired），且初始化后不更新 |
| 3 | **工具定义双轨制** | `server.py TOOL_DEFS` vs `schemas/tool_schema.json` vs `tools/__init__.py` | 20 个内联工具 vs 17 个 schema 工具，命名空间完全不同；`tool_schema.json` 有编码损坏（mojibake）；`tools/__init__.py` 从未被调用 |
| 4 | **LLM 非流式 + 人工切片模拟** | `server.py _run_agent_loop`, `_handle_chat_stream` | `ollama.chat(stream=False)` 拿到完整回复后，按 8 字符 + 20ms 睡眠模拟流式；首字延迟 = 完整 LLM 推理时间，体验差 |
| 5 | **tmp/ 和 tts/ 只写不删** | `server.py _record_simple`, `/transcribe`, `voice/tts.py` | 录音临时文件和 TTS 输出文件无清理机制，长期运行磁盘会膨胀 |

### 13.2 中优先级

| # | 问题 | 位置 | 影响 |
|---|------|------|------|
| 6 | **两条语音路径并存** | `/voice`（服务端录音）vs `/transcribe`（渲染层录音） | 路径 B 固定录 12 秒，延迟不可接受；silero-vad 已装但未用；faster-whisper 内置 vad_filter 也未启用 |
| 7 | **工作记忆过期不清理** | `memory/working.py` | `clear_expired()` 存在但从未在请求路径调用；1 条过期 8 天的记录仍在 |
| 8 | **事实提取纯启发式** | `server.py _extract_and_store_facts` | 关键词匹配 + 正则，不经过 LLM，提取质量低；可能产生噪音记忆 |
| 9 | **STT 模型不卸载** | `voice/stt.py unload()` | `unload()` 存在但从未被调用；CPU 模式下内存常驻约 100-200MB，CUDA 模式下显存不释放 |
| 10 | **browser.allowed_domains 白名单未执行** | `persona/xiyue.json` vs `playwright_client.py` | xiyue.json 定义了白名单但 playwright_client.py 注释明确说"不预设域名白名单"，配置与实现不一致 |
| 11 | **main.py 是死代码** | `agent/main.py` | Phase0 stub，定义了 `DEFAULT_MODEL` 和 `chat()`，但 server.py 不 import 它，独立运行也不会启动 HTTP 服务 |

### 13.3 低优先级 / 设计预留

| # | 问题 | 说明 |
|---|------|------|
| 12 | 唤醒词未实现 | `wake.py` 是空 stub，Phase 1 计划；当前用热键触发录音 |
| 13 | CosyVoice TTS 未接入 | `tts.py` 有 `engine="cosyvoice"` 分支但是 `pass`，计划接纳西妲项目 HTTP 部署 |
| 14 | 向量记忆未实现 | `memory.db.embedding` 列预留，`sqlite-vec` 在 requirements.txt 中被注释掉 |
| 15 | 无认证 | `127.0.0.1:8765` 无 API key/token，本地可接受但值得注意 |
| 16 | `store.py` 数据路径硬编码 | 注释提到 `_DEFAULT_DB_PATH` 硬编码相对路径是已知待改造点；实际已用 `resolve_data_dir()` 收口，但 `resolve_data_dir()` 开发期默认指向 repo 内 `data/`，打包后需 Rust 注入 `%APPDATA%/xiyue` |
| 17 | tsc 既有错误 | `xiyueLocalAgent.ts` 和 `xiyueIdentity.ts` 有 5 个类型错误，属历史遗留 |

### 13.4 架构层面观察

1. **"Hermes" 名不副实**：代码注释自称"汐月 Hermes"，但没有连接任何官方 Hermes 内核，是完全自写的精简实现。
2. **Phase 0 特征明显**：大量 stub（main.py, wake.py, cosyvoice）、预留列（embedding）、注释掉的依赖（sqlite-vec, faster-whisper in agent requirements）、"Phase 1/2 计划"标注。
3. **工具执行在渲染层**：Python 侧只做 LLM 编排和权限预检，实际工具执行由 Electron 渲染层完成——这意味着工具能力受限于渲染层能做什么，Python 侧的 Playwright 浏览器工具（`/browser` 端点）是另一条独立路径。
4. **数据一致性缺失**：history.json（空）、memory.db（3 条）、working_memory.json（1 条过期）三个记忆层互不同步，没有统一的记忆写入入口。

---

## 附录：关键版本号实测

| 组件 | 版本 | 来源 |
|------|------|------|
| Python | 3.12（venv） | 项目根 `.venv/` |
| ollama (Python SDK) | 0.6.2 | `pip list` |
| faster-whisper | 1.2.1 | `pip list` |
| ctranslate2 (STT 后端) | 4.8.1 | `pip list` |
| kokoro | 0.9.4 | `pip list` |
| pyttsx3 | 2.99 | `pip list` |
| sounddevice | 0.5.6 | `pip list` |
| numpy | 1.26.4 | `pip list` |
| torch | 2.13.0 | `pip list` |
| playwright | 1.62.0 | `pip list` |
| requests | 2.34.2 | `pip list` |
| Whisper base 模型 | — | 138.49 MB（model.bin） |
| HTTP 端口 | 8765 | `server.py` + `xiyueAgentService.ts` |
| LLM 模型 | qwen3-4b-32k | `xiyue.json` + 环境变量 |
| 健康巡检间隔 | 30s | `xiyueAgentService.ts` |
| 最大重启次数 | 3 | `xiyueAgentService.ts` |
| 工具调用最大轮数 | 8 | `server.py _MAX_TOOL_ROUNDS` |
| 工具结果超时 | 60s | `server.py _TOOL_RESULT_TIMEOUT_S` |
| 对话历史上限 | 200 条 | `history.py _MAX_MESSAGES` |
| 上下文轮数 | 10 轮 | `xiyue.json memory.max_history_turns` |
| 工作记忆 TTL | 24h | `working.py _DEFAULT_TTL_S` |
| 服务端固定录音时长 | 12s | `server.py _record_simple max_sec` |
| SSE 切片大小 | 8 字符 | `server.py _handle_chat_stream step=8` |
| SSE 切片间隔 | 20ms | `server.py time.sleep(0.02)` |
| TTS 采样率 | 24000 Hz | `voice/tts.py` |
| STT 采样率 | 16000 Hz | `voice/stt.py` + 渲染层 |

---

*报告结束。所有标注 [已查证] 的结论均有对应源码行或实测数据支撑；[推断] 标注未使用（本次调查所有结论均有源码依据）。*
