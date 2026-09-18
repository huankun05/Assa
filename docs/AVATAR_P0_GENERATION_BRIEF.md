# 汐月 P0 差分图 · 出图说明（七张）

> 用途：给美术 / AI 生成用的**可执行清单**。  
> 配套：`CHARACTER_ASSET_CHECKLIST.md`（总验收）、`DESIGN_SYSTEM.md` §5。  
> 日期：2026-09-12  
> 放入目录：`src/renderer/public/image/agent/`

---

## 0. 总规则

| 项 | 要求 |
|---|---|
| 角色 | 同一少女：暖金色头发发尾渐变淡蓝色、蓝色大眼睛、银色月牙发夹（左侧）、二次元赛璐璐、亲和 |
| **服装（统一）** | **白色露单肩卫衣（off-shoulder white hoodie），领口滑落露出左肩（月牙发夹同侧），右肩被衣服覆盖，七张必须完全一致** |
| **头发衣服层次** | **头发必须在衣服前面，领口边缘清晰锐利，无头发穿模、无衣服边缘模糊、无头发和衣服粘连** |
| **构图（方案C）** | **脸占画幅 65–75%，构图偏上，下方露出肩膀和一只手做动作**（Hover 44px 圆裁要清楚，手部动作增强小尺寸识别度） |
| **构图一致性（强制）** | **七张必须保持完全相同的脸大小、脸位置、肩膀位置、画幅比例**。以用户确认的 listening v6 为构图锚点，所有差分图基于同一张参考图生成，只改表情+手部动作+微侧头，禁止 AI 自行调整构图比例 |
| 尺寸 | 正方形；导出 **256×256 PNG**，**透明底** |
| 七张关系 | 机位、发型、服装、月牙发夹位置完全一致；只改**表情 + 手部动作 + 微侧头 + 小装饰** |
| **面部区分度** | 每个表情的眉形/眼形/嘴形/腮红必须有明显差异，禁止 calm 和 listening 面部完全一样 |
| 禁止 | 白底/黑底烘焙、文字水印、logo、多角色、写实/3D、道具挡脸、服装不一致、面部无区分 |
| 文件名 | 必须完全一致（区分大小写） |
| 大图可选 | 另出 `assa_{mood}_full.png` 头肩胸（设置/关于页用），**不阻塞** P0 |

### 正向提示词要点（七张通用，必须包含）

```
same character, warm golden hair fading to light blue at tips, big blue eyes,
silver crescent moon hairpin on left side, white off-shoulder hoodie (LEFT shoulder exposed, right shoulder covered),
hair in front of clothes, clean neckline, no clipping, no blurred edges,
anime cel shading, clean lineart, face closeup portrait, face occupies 65-75% of frame,
composition shifted upward, shoulders and one hand visible at bottom,
transparent background, consistent face position and outfit across all images,
soft studio lighting, readable facial features and hand gesture at 32px
```

### 负向提示词要点

```
text, watermark, logo, photorealistic, 3d render, full body, busy background,
white background, multiple characters, prop covering face, exaggerated motion blur,
different outfit, covered shoulders, turtleneck, no hands visible
```

### 七张表情识别特征总表（快速对照）

| 表情 | 手部动作 | 面部特征 | 小装饰 | 一句话感觉 |
|---|---|---|---|---|
| calm | 双手自然交叠身前 | 眉放松对称，**眼睛半闭/眼皮略沉（略带倦意放空）**，**嘴平直闭合完全无笑意**，无腮红 | 无 | 安静待机放空 |
| happy | 挥手/比心 | 眉舒展略扬，**弯笑眼**，嘴明显上扬微笑，轻腮红 | 无/小星星 | 开心温暖 |
| thinking | 手托下巴 | 一侧眉微挑，**视线偏侧上方**，嘴抿住 | 头顶小省略号 | 在想问题 |
| tool | 手指向下方 | 眉略收拢，**视线略向下**（像看屏幕），嘴闭合 | 无/小齿轮 | 认真干活 |
| listening | 手放耳边（侧耳） | 眉舒展，**眼睛睁大/眼神聚焦有神**，嘴闭合，**头微侧 5-10°**，无腮红 | 无/小音符 | 认真在听 |
| confuse | 挠后脑勺 | **眉一高一低**，瞳孔偏侧，嘴小o型，轻腮红 | 头顶小问号 | 迷茫不好意思 |
| speaking | 手张开（解释状） | 眉自然有神，眼睁开有互动感，**嘴中等张开（说话口型）** | 无/小对话气泡 | 正在说话 |

---

## 1. `assa_calm.png` — 平静

| 项 | 内容 |
|---|---|
| 用途 | 连接中 / 待机 |
| 感觉 | 安静、好说话、不忙 |
| **手部动作** | **双手自然交叠放在身前**（不抬起，不做手势） |
| 头 | 正面，不侧倾 |
| 眉 | 放松，对称，完全平展 |
| 眼 | **半闭/眼皮略沉，眼神放空略带倦意**（与 listening 的睁大眼明确区分） |
| 嘴 | **平直闭合，完全无笑意**（不是微笑，不是微上扬） |
| 腮红 | **无腮红** |
| 其它 | 无问号、无汗滴、无装饰 |
| **与 listening 的区分** | calm 头正面+手交叠+**眼半闭放空**+无腮红；listening 头侧倾+手放耳边+**眼睁大聚焦** |

**提示词补充**：`calm neutral expression, hands folded naturally in front, half-closed eyes, slightly droopy eyelids, vacant relaxed gaze, no smile, straight closed mouth, no blush, relaxed symmetrical eyebrows, head facing forward`

---

## 2. `assa_happy.png` — 开心

| 项 | 内容 |
|---|---|
| 用途 | 任务完成、日常「汐月·开心」 |
| 感觉 | 明确开心、温暖 |
| 眉 | 舒展略扬 |
| 眼 | **微弯笑眼**（可半闭） |
| 嘴 | 明显上扬微笑 |
| 其它 | 可轻腮红；不要夸张大笑盖住五官 |

**说明**：仓库已有 `assa_happy.png`；请导出**风格一致的特写版**覆盖或对齐即可。

**提示词补充**：`happy smile, smiling eyes, light blush, cheerful`

---

## 3. `assa_thinking.png` — 思考

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

## 4. `assa_tool.png` — 专注操作

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

## 5. `assa_listening.png` — 聆听

| 项 | 内容 |
|---|---|
| 用途 | 语音输入中「我在听」 |
| 感觉 | 在认真听你说话，专注 |
| **手部动作** | **一只手抬起放在耳边（侧耳倾听姿势），手指微弯像在拢住声音** |
| 头 | **轻微侧倾约 5-10°**（向手的同侧倾斜） |
| 眉 | 舒展，略有神 |
| 眼 | **看向观众，专注有神**（与 calm 的平静无神区分开） |
| 嘴 | **闭合，平直或极轻微上扬但不是笑** |
| 腮红 | **无腮红**（与 happy 区分） |
| 其它 | 可选耳侧极小音符/波纹（很小，不遮脸）；不要大笑 |
| **与 calm 的区分** | listening 头侧倾+手放耳边+眼专注有神；calm 头正面+手交叠+眼平静无神采 |

**提示词补充**：`listening attentively, hand raised to ear in listening gesture, slight head tilt, focused attentive eyes, closed mouth, no blush, no smile, concentrated expression`

---

## 6. `assa_confuse.png` — 困惑 / 出错

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

## 7. `assa_speaking.png` — 说话中

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

1. `assa_thinking.png`  
2. `assa_listening.png`  
3. `assa_tool.png`  
4. `assa_confuse.png`  
5. `assa_calm.png`  
6. `assa_speaking.png`  
7. （可选）对齐重导 `assa_happy.png` 特写版  

---

## 3. 验收（简表）

- [ ] 文件名完全一致，透明底 PNG  
- [ ] 七张脸位/发色/服装一致  
- [ ] 缩到 32px 仍能区分 calm / happy / thinking / tool / listening / confuse  
- [x] 已放入 `src/renderer/public/image/agent/`（2026-09-18 核实：七态 + `assa_happy_full.png`）  
- [x] 缺任一张时应用会回落 `assa_happy.png`（`agentContentConfig.ts` 的 `PHASE_IMAGE_FALLBACK` 已接）  

---

## 4. 不在本次交付

- Live2D / 骨骼模型（岛内不用；微动由 CSS 做）  
- 应用/托盘 ico（另任务）  
- P1/P2 表情（excited / gentle / tired…）  
