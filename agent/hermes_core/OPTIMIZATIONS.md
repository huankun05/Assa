# hermes_core 汐月接入 · 优化说明

> 本文记录 vendor 自 desk-pet 后，在 Xiyue 侧所做的适配与已知边界。
> 上游模块保持相对独立，优先改适配层；确需改 hermes 文件时保留可回贴上游的 diff 面。

## 已落地（相对「原样拷贝」）

| 项 | 说明 |
|---|---|
| 路径收口 | `store.get_db_path()` → `resolve_data_dir()/agent/memory/core.db` |
| Ollama 向量 | `OllamaEmbedder`（默认 `bge-m3`，`XIYUE_EMBED=local_hash` 可关）；启动探活，失败回退 `LocalHashEmbedder` |
| 维度兼容 | `Librarian` 在 embedding 维度与当前 embedder 不一致时现场重算，避免 384/1024 混用余弦恒为 0 |
| L2/L3 自学习 | 对话后 `maybe_autogenerate(new_count)`，累计 L1 触发场景/画像聚合 |
| 抽取规则 | scribe 增补「项目名 / 工作目录 / 常用工具」等桌面场景正则 |
| 双写收敛 | hermes 写入成功则不再写旧 `working_memory.json`；失败才回退启发式 |
| 情绪快照 | 抽取时写入 `emotion_snapshot`（PAD），便于后续按情绪加权召回 |

## 推荐后续（未做，按收益排序）

1. **SQLite FTS5**：`search_like` 仍以 LIKE 为主，中文长句召回偏弱；建 FTS 表 + RRF 融合（向量+FTS+importance）。
2. **异步 embedding**：当前 HTTP 同步调用 Ollama；量大时可改线程池 + 批量 `/api/embed`，避免拖慢首包。
3. **旧库迁移脚本**：从 `working_memory.json` / `history.json` 一次性迁入 L0/L1，避免新装用户「失忆」。
4. **soul / time 接线**：HEXACO 人格与昼夜节律仅 vendor 未注入 system prompt。
5. **学习调度器**：`learning_scheduler` 未在侧车启动，可空闲时跑衰减/归档（archivist）。

## 环境变量

| 变量 | 默认 | 含义 |
|---|---|---|
| `XIYUE_EMBED` | `ollama` | `local_hash` 强制离线哈希向量 |
| `XIYUE_EMBED_MODEL` | `bge-m3` | Ollama embedding 模型 |
| `XIYUE_OLLAMA_URL` | `http://127.0.0.1:11434` | Ollama 地址 |
| `XIYUE_EMBED_TIMEOUT` | `8` | 单次 embed 超时（秒） |

## 回归

```powershell
.venv/Scripts/python agent/tests/test_hermes_core.py
```
