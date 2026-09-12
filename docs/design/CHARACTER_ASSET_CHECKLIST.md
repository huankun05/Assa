# 汐月角色素材清单（替换恐龙 · 制作与验收）

> 配套：`DESIGN_SYSTEM.md` §5 / §9 / §10（M3）  
> 状态：计划已定稿 2026-09-12 · 美术/生成/外包均适用  
> 原则：**透明底 PNG**；禁止文字水印；32px 下表情可辨；暖色系与冷玻璃对冲。  
> 过渡：差分未齐前代码只认少女路径，缺图共用已有少女图；**恐龙已归档，不进正式应用**。  
> **动效**：交付以**静态差分 PNG**为准；岛内「活人感」由 **CSS 微动**实现，**不依赖 Live2D**（见 §2.1.2）。

---

## 1. 设计 Brief（不可违背）

| 维度 | 要求 |
|---|---|
| 人设 | 少女感、亲和；避免幼态过度或性感化 |
| 发色 | 琥珀棕 / 蜜桃粉 / 暖金等暖色 |
| 瞳色 | 与发协调的暖色，或清透蓝绿（点缀 iOS 蓝） |
| 服装 | 简洁现代 + 一点科技感；忌复杂制服 |
| 画风 | 清爽二次元 / 赛璐璐；忌厚涂写实、3D |
| 构图 | 头肩胸像；脸部特写版脸占约 80% |
| 背景 | **透明**；应用图标除外（深色圆角底） |
| 禁止 | 多角色、复杂场景、荧光赛博、白底烘焙进头像 |

---

## 2. 素材矩阵

### 2.1 P0 · 必须（岛内 + hover 最小集）

**构图总则（七张必须同一人、同一机位、同一服装）：**

- **画幅**：正方形 512×512 或 1024×1024 导出，**导出缩到 256×256 PNG（透明底）** 入库；也可 256 直出
- **构图（P0 / 小尺寸）**：**脸部特写**——脸占画面约 **70–80%**，仅露少量颈肩；hover 44px / Agent 74px 圆裁后眉眼嘴仍清楚。**不要**用「整个人很小、身体很多」的全身/大半身构图。
- **构图（大图 / `_full`）**：完整**头肩胸像**，给设置/关于/大面板 80px+。
- **脸部占比（P0）**：脸宽约占画幅 70–80%，**32px 缩略仍可辨**（眉/眼/嘴差分要夸张一点）。
- **视线**：正前或略偏观众，不要侧脸
- **背景**：**全透明**，不要白底/黑底/渐变/光晕烘焙进图
- **禁止**：文字、水印、logo、多角色、手持复杂道具遮脸、厚涂写实、3D 渲染感

| 文件名 | 表情/状态 | 用途 | 尺寸建议 | 现状 |
|---|---|---|---|---|
| `xiyue_calm.png` | 平静待机 | 连接中 / idle | 256 透明 | 缺 |
| `xiyue_happy.png` | 开心 | 完成 / 日常 | 256 透明 | **有**（`public/image/agent/`） |
| `xiyue_thinking.png` | 思考 | LLM 推理 | 256 透明 | 缺 |
| `xiyue_tool.png` | 专注操作 | 工具调用 | 256 透明 | 缺 |
| `xiyue_listening.png` | 聆听 | 语音输入 | 256 透明 | 缺 |
| `xiyue_confuse.png` | 困惑/出错 | error | 256 透明 | 缺 |
| `xiyue_speaking.png` | 说话中 | 回答流/TTS | 256 透明 | 缺（P1 可缓） |

#### 2.1.1 七张各自长什么样（生成提示词可直接用）

> 下列为「表情差分说明 + 可粘贴的 AI 绘图提示词要点」。七张务必锁同一角色参考图（以现有 `xiyue_happy.png` 为锚点改表情，或先出一张「模板脸」再 7 连）。

**1. `xiyue_calm.png` — 平静**

- 眉放松，嘴角**平直或极轻微上扬**（不是笑）
- 眼睛自然睁开，眼神柔和
- 头正，肩放松
- **不要**腮红、不要感叹号/气泡
- 提示词要点：`gentle neutral smile, calm eyes, relaxed shoulders, soft expression`

**2. `xiyue_happy.png` — 开心（已有则对齐它）**

- 明显开心：嘴角上扬、眼睛微弯（可笑眼）
- 轻度腮红可接受
- 不要夸张张口大笑盖住五官
- 提示词：`warm happy smile, slightly closed smiling eyes, light blush`

**3. `xiyue_thinking.png` — 思考**

- 视线**略向一侧/向上**，不是直视镜头
- 一侧眉微挑，嘴微抿或一端略抬
- 可加**小思考气泡/小灯泡线稿（可选，不遮脸）**；更干净的做法是**不加道具**，只靠眼神
- 提示词：`thinking pose, eyes looking up-side, one eyebrow raised, slight smirk, thoughtful`

**4. `xiyue_tool.png` — 专注操作（调用工具）**

- 视线略向下（像看键盘/屏幕），眼神专注
- 嘴闭合，眉略收
- **不要**变成 confuse；可加极轻的「认真」感（下眼睑略紧）
- 提示词：`focused concentration, looking slightly down, closed mouth, determined soft gaze`

**5. `xiyue_listening.png` — 聆听**

- 头**微微侧倾**（约 5–10°），眼神认真看向「说话的人」
- 嘴闭合或极小张开，眉舒展
- 可加**耳侧小音符/波纹（可选，小、不盖脸）**
- 提示词：`listening attentively, slight head tilt, soft focused eyes, ready to hear`

**6. `xiyue_confuse.png` — 困惑 / 出错**

- 眉一高一低，嘴微张成小 o 或波浪嘴
- 眼神困惑（瞳孔可略偏）
- 可加**头顶小问号/小乱线（可选，小）**；32px 时问号别糊成一团
- 提示词：`confused expression, one eyebrow raised, small open mouth, question mark mark, puzzled`

**7. `xiyue_speaking.png` — 说话中**

- 嘴**张开说话口型**（不是大笑），眼睁开有神
- 像在认真说一句话的中间
- 提示词：`speaking mid-sentence, open mouth talking pose, engaged eyes, lively`

**统一锁参（写进生成 negative/正向）：**

```
正向关键：same character, consistent hair color and style, warm amber-brown hair,
clean cel shading, anime portrait, head and shoulders, transparent background,
high contrast face features readable at 32px

负向：text, watermark, logo, multiple characters, photorealistic, 3d render,
white background, complex background, busy props covering face
```

#### 2.1.2 仅静态图还是动图？（结论先写）

| 方案 | 小尺寸（40–74px）效果 | 性能 | 成本 | 结论 |
|---|---|---|---|---|
| **静态 PNG + CSS 微动** | 好 | 极低 | 低 | **推荐（主路径）** |
| 多帧 PNG / sprite 切换 | 一般，易抖 | 低 | 中 | 可选补充 |
| Lottie JSON | 好 | 中 | 中高 | 大面板可后置 |
| **Live2D / 骨骼** | 40px **看不清**细节，收益低 | 高 | 很高 | **不做默认**；仅大面板可选 |
| 短视频/GIF 循环 | 差（糊、难切状态） | 中 | 中 | **不推荐**岛内 |

**产品策略（已定，与 DESIGN_SYSTEM §5.6 一致）：**

1. **交付物先仍是静态差分 PNG**（七张）——状态切换的核心信息靠「换脸 + 状态词 + 状态点」。
2. **「不生硬」主要靠 CSS 微动**，不是靠 Live2D：
   - 呼吸 `scale(1→1.02)` 约 4s
   - 表情切换 250–300ms 淡入淡出 + 轻微上移
   - thinking 左右微晃；listening 略放大 + 光晕
3. **不要求**你先做出 Live2D 模型；若以后要「更活」，优先：**眨眼单帧可选**（P1，拆眼层）→ 大面板 Lottie。
4. 若你生成工具支持，可**额外**导出 `*_blinking.png`（闭眼版）做眨眼；非必须。

**一句话：你先交 7 张对齐好的静态差分；动效由前端 CSS 负责；Live2D 不是本阶段交付物。**

### 2.2 P1 · 建议

| 文件名 | 用途 |
|---|---|
| `xiyue_excited.png` | 好消息/庆祝 |
| `xiyue_gentle.png` | 温柔回复 |
| `xiyue_happy_full.png` | 大尺寸展示（已有可沿用） |
| `xiyue_thinking_full.png` 等 `_full` | 设置/关于页 80–256px |

### 2.3 P2 · 可选

| 文件名 | 用途 |
|---|---|
| `xiyue_tired.png` | 深夜 |
| `xiyue_anxious.png` | 高风险确认 |
| `xiyue_angry.png` | 吐槽彩蛋 |

### 2.4 应用品牌图标（独立任务）

| 文件 | 规格 | 用途 |
|---|---|---|
| `resources/icon/xiyue.svg` | 源 | 设计源 |
| `resources/icon/xiyue_16x16.ico` | 16 | 托盘 |
| `resources/icon/xiyue_256x256.ico` | 256 | 安装包/窗口 |

替换引用：`electron-builder.json`、`src/main/tray.ts`。

---

## 3. 目录与命名

```text
src/renderer/public/image/agent/     # 运行时正式资源
  xiyue_{mood}.png
  xiyue_{mood}_full.png

src/renderer/public/image/legacy/eisland-dino/   # 可选：恐龙归档
  AGENT_*.png
```

工作区草稿（未验收勿引用）：`F:/Work/Create/Assa/xiyue_*.png`。

---

## 4. 验收标准（每张）

- [ ] PNG + alpha 透明底；非白底烘焙  
- [ ] ≥256px 长边；岛内缩到 40–74px 仍可辨情绪  
- [ ] 眉/眼/嘴差分与同套其它表情可区分（32px 目视）  
- [ ] 风格一致（线稿/上色/光源同一套）  
- [ ] 无文字、水印、logo、多余肢体  
- [ ] 文件名符合 `xiyue_{mood}.png`  
- [ ] 拷入 `public/image/agent/` 并更新 `AVATAR_IMAGE_MAP` / `PHASE_IMAGE`  
- [ ] 恐龙路径从默认配置移除  

---

## 5. 代码接线清单

| 步骤 | 文件 |
|---|---|
| 1 | `xiyueMoodConfig.ts` → 填满 `AVATAR_IMAGE_MAP` |
| 2 | `agentContentConfig.ts` → `PHASE_IMAGE` 改指 xiyue_* |
| 3 | `AgentContent.tsx` → phase↔mood 映射按 DESIGN_SYSTEM §5.5 |
| 4 | 删除/归档 `image/AGENT_*.png` 默认引用 |
| 5 | persona `agent/persona/xiyue.md` 更新形象描述 |
| 6 | i18n / 状态点颜色改语义 token |

---

## 6. 当前资产盘点（2026-09-12 更新）

| 路径 | 状态 |
|---|---|
| `public/image/agent/xiyue_{calm,happy,thinking,tool,listening,confuse,speaking}.png` | **P0 七态已入库并接线** |
| `public/image/agent/xiyue_happy_full.png` | 完整版可用 |
| `public/image/legacy/eisland-dino/AGENT_*.png` | 恐龙已归档，不进默认路径 |
| `public/assets/avatar/T.jpg` | 旧占位，可删 |
| `Assa/temp-archive/*.png` | 出图中间稿（约 30MB），确认后可删 |
| `Assa/xiyue_face_v2.png` | 草稿，未进包 |

### 6.1 已完成（无需再交）

- [x] 七态脸特写 PNG（透明底）  
- [x] Agent / Hover 路径接线 + 缺图回落 happy  
- [x] CSS 微动  

---

## 6B. 仍需你准备的素材（按优先级）

### P0 · 品牌图标（应用/托盘，当前仍是 eisland）

| 要什么 | 规格 | 放哪 | 说明 |
|---|---|---|---|
| **应用图标 ICO** | **256×256** 多尺寸 ICO（至少含 16/32/48/64/128/256） | `resources/icon/xiyue_256x256.ico` | 安装包、主窗口图标 |
| **托盘 ICO** | **16×16**（可含 32） | `resources/icon/xiyue_16x16.ico` | 系统托盘；深浅背景都要能认 |
| **可选 SVG 源** | 矢量 | `resources/icon/xiyue.svg` | 便于再导出；非强制 |
| **可选 PNG 源** | 512×512 透明或带底 | `resources/icon/xiyue_512.png` | 设计源，方便切 ICO |

**画面怎么设计（描述清楚）：**

| 项 | 建议 |
|---|---|
| 主体 | **汐月头像简化版**（与 7 态同一人）**或** 抽象「月牙 + 潮汐」二选一；更推荐「少女头 + 圆角深底」识别度高 |
| 构图 | 正方形居中；头肩或大头皆可，**16px 缩到仍能看出「有人脸/月」** |
| 底 | 应用图标：**深色圆角底**（深蓝黑/近黑 #0a0a12 一类），不要纯白底 |
| 色 | 发色暖棕/蜜桃；可用一点 iOS 蓝点缀；整体不要花 |
| 禁止 | 文字「汐月/Xiyue」不要压在 16px 上；复杂场景；水印 |
| 风格 | 与 hover 头像同一画风（赛璐璐），避免应用图标是写实、岛内是二次元 |

**代码接线（有文件后我改，你不用动代码）：**

- `electron-builder.json` → `"win.icon": "resources/icon/xiyue_256x256.ico"`  
- `src/main/tray.ts` → `TRAY_ICON_PATH` → `xiyue_16x16.ico`  
- 若有独立窗 `windowIcon` 一并替换  

### P1 · 可选（不阻塞）

| 要什么 | 用途 | 说明 |
|---|---|---|
| `xiyue_{mood}_full.png` × 若干 | 设置/关于页 80–256 | 头肩胸完整版；至少 happy_full 可扩 thinking/full |
| P1 表情 excited / gentle | 好消息 / 温和共情 | 非必须 |
| 品牌壁纸 1 张 | 可选桌面/启动背景 | 可后置 |

### 明确不做（本阶段）

- Live2D / 骨骼模型  
- 屏顶露头条（P2 遮挡终极方案）——**产品已验收现方案，取消**  
- 恐龙皮肤回归默认路径  

---

## 7. 里程碑建议（更新）

| 里程碑 | 内容 |
|---|---|
| M1 | P0 六态出图 + 接线替换恐龙（岛内+hover 一致） |
| M2 | 状态点/文案/语义色；`enterDelay` 与点击展开（可并行） |
| M3 | 应用/托盘图标替换 |
| M4 | P1/P2 差分 + CSS 微动完善 |
