# Router 第二期任务拆解（冻结稿）

> **状态**：已冻结（2026-09-11）｜依据：`docs/产品定位讨论报告_v1.0.md` §3  
> **目标**：闭集指令不进 LLM，规则直达工具；未命中回落现有 Hermes 链路；全程可审计。

---

## 1. 目标（一句话）

> 「音量调到 50%」这类闭集指令：**不进 LLM → 工具直达 → 中性回执 → 写路由日志**；未命中则回落现有 Hermes 路径。

## 2. 范围

| 做 | 不做（后置） |
|---|---|
| `agent/router/` 模块 + 内置规则包 | 轻分类器（二期） |
| `/chat`、`/chat/stream` 入口短路 | 云端适配器实体（日志字段预留） |
| 中性 `reply_template` + 既有 TTS | 情感回应簇 / 即兴 LLM |
| `route_log.jsonl` + `request_id` | 主动关心 |
| 与现有工具执行器/双闸门对接，不旁路 | 完整规则管理器 UI（一期 json + enabled） |
| 回归句集与单测 | 权限说明卡完整 UI |

## 3. 模块与接口

```
agent/router/
  __init__.py      # route(text, ctx) -> RouteResult
  rules.py         # 加载/匹配 内置包 + data/rules.json
  policy_map.py    # 规则工具名 → 主进程白名单校验
  log.py           # route_log.jsonl
  types.py         # RouteResult
```

### RouteResult

```python
@dataclass
class RouteResult:
    tier: str          # "rule" | "local_llm" | "cloud_candidate" | "denied"
    rule_id: str | None
    tool: str | None
    args: dict
    reply: str | None  # rule 层渲染后的中性回执；其它层为 None
    reason: str        # pattern_match | no_rule | tool_not_allowed | ...
```

### 接入点

```
POST /chat/stream  (及 /chat)
  text → Router.route
    ├─ tier == "rule"
    │     → 走现有工具执行链（主进程 / 既有 tool dispatch，双闸门不旁路）
    │     → 渲染 reply_template → TTS/JSON 回执 → route_log → return
    └─ 其它
          → 原 Hermes 路径（_run_agent_loop 等）
          → route_log 记 tier=local_llm, reason=no_rule 等
```

## 4. 默认规则包（一期）

> **约束**：工具名必须与 `schemas` / 主进程执行器 / `assa_tools.json` **一致**；B1 核对前不得合并启用。

| rule_id | 触发例 | 候选 tool（待 B1 核名） |
|---|---|---|
| volume.set | 音量 50 / 声音调到 50 | system.volume.set |
| volume.mute | 静音 | system.volume.mute |
| volume.unmute | 取消静音 / 恢复声音 | system.volume.unmute |
| brightness.set | 亮度 60 | system.brightness.set |
| media.play_pause | 播放 / 暂停 | media.play-pause |
| media.next | 下一首 | media.next |
| media.prev | 上一首 | media.prev |
| app.launch | 打开微信 | （待核：open app / launch） |
| timer.set | 5 分钟倒计时 | （待核；无则一期不做） |
| weather.query | 今天天气 | （待核；无明确工具则一期 fallback LLM） |

规则 JSON 形态（与定位报告 §3.4 一致）：

```json
{
  "id": "volume.set",
  "patterns": ["音量\\s*(\\d+)", "声音调到\\s*(\\d+)", "把音量调到\\s*(\\d+)"],
  "tool": "system.volume.set",
  "arg_map": { "level": "$1" },
  "reply_template": "好的，音量已经调到 {level}% 了。",
  "enabled": true,
  "priority": 100
}
```

## 5. 验收回归句集（≥12）

| # | 输入 | 期望 |
|---|---|---|
| 1 | 音量 50 | tier=rule，level=50，回执含 50%，不进 LLM |
| 2 | 把声音调到百分之三十 | 一期允许 local_llm（分类器未上） |
| 3 | 静音 | volume.mute |
| 4 | 打开微信 | app.launch 或明确 fallback |
| 5 | 帮我把下载文件夹的 PDF 归档 | local_llm，reason=no_rule |
| 6 | 复杂任务 + 云端关 | 不崩溃；log 可区分 local/cloud 关 |
| 7 | 规则命中但工具名非法 | denied + log，不静默执行 |
| 8 | 角色=纯工具 | 不启动 Router/对话路径；入口引导开 AI |
| 9 | 任意一句 | route_log 含 request_id、tier、latency |
| 10 | 音量规则 | log 无 local_llm 记录 |
| 11 | 连续音量 40/50/60 | 回执合并或节流，不风暴播报 |
| 12 | 单测 | rules 匹配 ≥15 句正/负例 |

## 6. 工单

| ID | 任务 | 依赖 | 状态 |
|---|---|---|---|
| B1 | 核对规则工具名 ↔ 实际 IPC / tool schema | — | ✅ 2026-09-11 |
| B2 | types/rules/log 最小实现 + 单测 | B1 | ✅ 2026-09-11（`agent/router/`；schema 已补 volume/brightness；`/chat/stream` 已短路） |
| B3 | 接入 /chat/stream、/chat；规则短路 | B2 | ⚠️ 部分：stream 已接；`/chat` 旧路径仍 LLM（无 SSE 工具闭环） |
| B4 | 默认规则包 + reply_template | B1–B3 | ✅ volume/brightness/media 三类 |
| B5 | route_log + request_id 与审计串联 | B3 | ✅ 2026-09-11（审计含 requestId；渲染层 executor 透传） |
| B6 | 回归句集 + CHANGE_LOG | B4–B5 | ✅ 2026-09-11（见 `docs/Router测试清单.md`） |

### B1 结论（2026-09-11）

| 候选 rule_id | 真实能力 | 一期 |
|---|---|---|
| volume.set | ✅ | **启用** |
| volume.mute / unmute | ✅ PowerShell SetMute | **启用** |
| brightness.set | ✅ | **启用** |
| media.play_pause / next / prev | ✅ | **启用** |
| sys.launch | ✅ 中文名映射 | **启用** |

**B2 默认方案 A**：在 `schemas/assa_tools.json` **补登记**工具（confirm=false, level=1），Router 只绑 schema 内名字，避免双轨。

**后续增强（已做）**：`sys.launch` 中文名映射（记事本→notepad 等）；用户规则示例 `data/rules.json.example`（复制为 `rules.json` 启用）。

### L3 保活（已验证）

- `npm install` ✅  
- `npm test` 1783 passed ✅  
- `npm run plugins:build` 全部成功（仅预览版/编码告警）✅  

## 7. 与第一批顺序

```
插件改名（L3）保活绿 → B1–B6
README/品牌扫尾可并行，不阻塞 B
```

