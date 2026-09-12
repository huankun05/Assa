# 汐月 P0 差分图 · 出图说明（七张）

> 用途：给美术 / AI 生成用的**可执行清单**。  
> 配套：`CHARACTER_ASSET_CHECKLIST.md`（总验收）、`DESIGN_SYSTEM.md` §5。  
> 日期：2026-09-12  
> 放入目录：`src/renderer/public/image/agent/`

---

## 0. 总规则

| 项 | 要求 |
|---|---|
| 角色 | 同一少女：暖琥珀棕发、二次元赛璐璐、亲和（以现有 `xiyue_happy.png` 为风格锚点） |
| 构图 | **脸部特写**：脸占画幅约 **70–80%**，仅露少量颈肩（Hover 44px 圆裁要清楚） |
| 尺寸 | 正方形；导出 **256×256 PNG**，**透明底** |
| 七张关系 | 只改表情/微侧头；机位、发型、服装尽量一致，避免换图时脸位大跳 |
| 禁止 | 白底/黑底烘焙、文字水印、logo、多角色、写实/3D、道具挡脸 |
| 文件名 | 必须完全一致（区分大小写） |
| 大图可选 | 另出 `xiyue_{mood}_full.png` 头肩胸（设置/关于页用），**不阻塞** P0 |

### 正向提示词要点（七张通用）

```
same character, warm amber-brown hair, short modern casual hoodie or simple tech-casual outfit,
anime cel shading, clean lineart, face closeup portrait, head and shoulders only,
transparent background, consistent face position across poses,
soft studio lighting, readable facial features at 32px
```

### 负向提示词要点

```
text, watermark, logo, photorealistic, 3d render, full body, busy background,
white background, multiple characters, prop covering face, exaggerated motion blur
```

---

## 1. `xiyue_calm.png` — 平静

| 项 | 内容 |
|---|---|
| 用途 | 连接中 / 待机 |
| 感觉 | 安静、好说话、不忙 |
| 眉 | 放松，对称 |
| 眼 | 自然睁开，直视或略柔和看向观众 |
| 嘴 | **平直或极轻微上扬**（不是笑） |
| 其它 | 无腮红、无问号、无汗滴 |

**提示词补充**：`calm neutral expression, gentle eyes, relaxed soft smile, no blush`

---

## 2. `xiyue_happy.png` — 开心

| 项 | 内容 |
|---|---|
| 用途 | 任务完成、日常「汐月·开心」 |
| 感觉 | 明确开心、温暖 |
| 眉 | 舒展略扬 |
| 眼 | **微弯笑眼**（可半闭） |
| 嘴 | 明显上扬微笑 |
| 其它 | 可轻腮红；不要夸张大笑盖住五官 |

**说明**：仓库已有 `xiyue_happy.png`；请导出**风格一致的特写版**覆盖或对齐即可。

**提示词补充**：`happy smile, smiling eyes, light blush, cheerful`

---

## 3. `xiyue_thinking.png` — 思考

| 项 | 内容 |
|---|---|
| 用途 | LLM 推理中 |
| 感觉 | 在想问题，不慌 |
| 眉 | 一侧微挑，或轻微不对称 |
| 眼 | **视线偏侧上方**，不直视镜头 |
| 嘴 | 抿住或一端略抬（小抿嘴） |
| 其它 | 可选极小思考感；**不要**大灯泡挡脸 |

**提示词补充**：`thinking, looking up to the side, one eyebrow raised, thoughtful closed mouth`

---

## 4. `xiyue_tool.png` — 专注操作

| 项 | 内容 |
|---|---|
| 用途 | 正在调用工具 / 执行操作 |
| 感觉 | 认真干活，不是困惑 |
| 眉 | 略收拢，专注 |
| 眼 | **视线略向下**（像看屏幕） |
| 嘴 | **闭合** |
| 其它 | 不要问号；不要 sweat drop |

**提示词补充**：`focused concentration, looking slightly down, closed mouth, determined soft gaze`

---

## 5. `xiyue_listening.png` — 聆听

| 项 | 内容 |
|---|---|
| 用途 | 语音输入中「我在听」 |
| 感觉 | 在认真听你说话 |
| 头 | **轻微侧倾**约 5–10° |
| 眉 | 舒展 |
| 眼 | 看向观众，专注 |
| 嘴 | 闭合或极小张开 |
| 其它 | 可选耳侧小音符/波纹（小、不遮脸） |

**提示词补充**：`listening attentively, slight head tilt, focused eyes on viewer`

---

## 6. `xiyue_confuse.png` — 困惑 / 出错

| 项 | 内容 |
|---|---|
| 用途 | error / 没听懂 |
| 感觉 | 迷茫、不好意思 |
| 眉 | **一高一低** |
| 眼 | 瞳孔可略偏，显困惑 |
| 嘴 | **小张**（小 o 或微波浪） |
| 其它 | 可选头顶**小问号**（很小，32px 不糊） |

**提示词补充**：`confused, asymmetric eyebrows, small open mouth, tiny question mark`

---

## 7. `xiyue_speaking.png` — 说话中

| 项 | 内容 |
|---|---|
| 用途 | 回答流 / TTS 播报中 |
| 感觉 | 正在说一句话中间 |
| 眉 | 自然，有神 |
| 眼 | 睁开、有互动感 |
| 嘴 | **张口说话口型**（中等张开，不是大笑） |
| 其它 | 不要叉形眼/夸张变形 |

**提示词补充**：`speaking mid-sentence, open mouth talking, engaged eyes, lively`

---

## 2. 优先出图顺序

1. `xiyue_thinking.png`  
2. `xiyue_listening.png`  
3. `xiyue_tool.png`  
4. `xiyue_confuse.png`  
5. `xiyue_calm.png`  
6. `xiyue_speaking.png`  
7. （可选）对齐重导 `xiyue_happy.png` 特写版  

---

## 3. 验收（简表）

- [ ] 文件名完全一致，透明底 PNG  
- [ ] 七张脸位/发色/服装一致  
- [ ] 缩到 32px 仍能区分 calm / happy / thinking / tool / listening / confuse  
- [ ] 已放入 `src/renderer/public/image/agent/`  
- [ ] 缺任一张时应用会回落 `xiyue_happy.png`（代码已接）  

---

## 4. 不在本次交付

- Live2D / 骨骼模型（岛内不用；微动由 CSS 做）  
- 应用/托盘 ico（另任务）  
- P1/P2 表情（excited / gentle / tired…）  
