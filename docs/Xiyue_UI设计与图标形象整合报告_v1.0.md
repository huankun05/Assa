# Xiyue UI 设计与图标形象整合报告 v1.0

> 整合日期：2026-09-11
> 整合来源：`Xiyue_设计与改进建议_v1.0.md` + `Xiyue_图标与形象设计调查报告.md`
> 目标：统一梳理 UI 设计方向、图标体系、角色形象的所有问题，逐个讨论确认
> 确认进度：讨论点 1 ✅ 已确认（图标方案 A：Lucide为主+自定义补充+品牌图标独立）
> 新增内容：2.7 角色动态效果与"活人感"设计（P0呼吸/情绪过渡/状态联动 → P1眨眼口型 → P2交互环境感知，双尺寸头像体系）

---

## 一、设计基因与原则（已确认，应坚持）

来源 `DESIGN_STYLE_GUIDE.md`：

1. **Apple Dynamic Island 极简骨架**（三段式形变）
2. **冷色玻璃面板**（深色 + iOS 蓝 + backdrop-filter）
3. **暖色角色注入温度**

> **铁律：UI 冷、角色暖。冷暖对冲，永远不要让 UI 和角色都冷、都暖。**

**Code Review 条目**：任何新增 AI 相关界面，必须有至少一处暖色角色反馈（表情/光晕/状态色），禁止纯冷玻璃空面板。

---

## 二、角色形象设计（汐月）

### 2.1 定位（已确认）

汐月 = **可爱小姑娘，二次元风格**，留形象替代空间。像素恐龙是 eIsland 遗产吉祥物，**不是**汐月本人。

### 2.2 设计 Brief（生成/外包时必须遵守）

| 维度 | 要求 |
|---|---|
| 年龄感 | 少女感、亲和，避免幼态过度或性感化 |
| 发型/发色 | 暖色系为主（琥珀棕 / 蜜桃粉 / 暖金），与冷色玻璃对冲 |
| 瞳色 | 与发色协调的暖色或清透蓝绿（点缀冷色，呼应 iOS 蓝） |
| 服装 | 简洁、现代、带一点点科技感细节，避免复杂制服 |
| 画风 | 清爽二次元立绘 / 赛璐璐，线条干净，**不要**厚涂写实、不要 3D 渲染 |
| 构图 | 头像以 **头肩胸像** 为主（hover 60px / agent 74px 可读）；应用图标用头肩 + 圆角底 |
| 背景 | 头像 **透明底**；应用图标深色圆角底 + 角色 |
| 禁止 | 文字、水印、logo、多角色、复杂场景、荧光赛博色、白底烘焙进头像 |

### 2.3 表情差分清单

#### P0 已完成（7 种工作状态，2026-09-12）

| 表情 | 对应状态 | 使用场景 | 头像特征 | 状态点颜色 |
|---|---|---|---|---|
| calm 待机 | 默认/连接中 | 日常待机 | 双手交叠，中性平静，无笑意 | 灰 #8e8e93 |
| happy 开心 | 任务完成/日常 | 完成任务、问候 | 挥手，开心微笑，腮红 | 绿 #34c759 |
| thinking 思考中 | LLM 推理 | 正在理解问题 | 手托下巴，视线偏上 | 蓝 #409cff |
| tool 操作中 | 工具调用 | 正在执行操作 | 食指指下方，视线向下 | 紫 #af52de |
| listening 聆听中 | 语音输入 | 正在收音 | 手放耳边，头侧倾，睁大眼 | 红 #ff3b30 |
| confuse 困惑 | 出错/没听懂 | 需要澄清 | 挠头，眉一高一低，小o嘴 | 黄 #ff9500 |
| speaking 说话中 | TTS 播报 | 正在回答 | 手张开解释，嘴张开 | 青 #5ac8fa |

#### P1/P2 待做（情绪类，换脑后接入情绪系统）

| 表情 | 对应情绪 | 优先级 |
|---|---|---|
| sad 悲伤 | PAD 愉悦低 | P2 |
| anxious 焦虑 | PAD 唤醒高+愉悦低 | P2 |
| excited 兴奋 | PAD 愉悦+唤醒双高 | P2 |
| tired 疲惫 | PAD 唤醒低 | P1（深夜自动切换） |
| gentle 温和 | PAD 愉悦中+支配低 | P2 |
| blush 害羞 | 情绪触发 | P2 |
| surprised 惊讶 | 情绪触发 | P2 |
| sigh 吐槽 | 情绪触发 | P2 |

> 设计决策：P0 优先做**工作状态**表情（用户能直接感知"她在干什么"），情绪类表情等换脑后接入 hermes_core 情绪系统再做。小尺寸对策：岛内默认用简化头肩特写；完整聊天窗/设置页可用更精细立绘。`AVATAR_IMAGE_MAP` 支持按 mood 换图，无需改组件结构。

### 2.4 尺寸规格

| 源文件尺寸 | 用途 | 显示尺寸 | 位置 |
|---|---|---|---|
| 512×512 PNG | 所有头像源文件（统一） | 44px | 灵动岛 hover 态头像（XiyueTab） |
| 512×512 PNG | 同上 | 48px | 聊天界面消息头像 |
| 512×512 PNG | 同上 | 80px+ | 大面板/设置页头像 |
| 512×512 PNG | 同上 | 256px | 关于页/形象展示 |

> 源文件统一 512×512，比 brief 的 256×256 更清晰，适配大面板和关于页的大尺寸显示。44px 圆裁下脸占约 65-75%，表情和手部动作清晰可辨。

### 2.5 格式与存储（已完成）

- **格式**：PNG（透明背景，已抠图）
- **存储位置**：`src/renderer/public/image/agent/`
- **文件命名**：`xiyue_{mood}.png`（如 `xiyue_happy.png`、`xiyue_thinking.png`）
- **配置**：`xiyueMoodConfig.ts` 的 `AVATAR_IMAGE_MAP` 已配置全部 7 种状态路径
- **生成 brief**：`docs/AVATAR_P0_GENERATION_BRIEF.md`（含提示词、参数、验收标准）
- **用户自定义**：`%APPDATA%\xiyue\data\custom\avatar\`
- **切换机制**：沿用现有 AVATAR_IMAGE_MAP 双轨设计，用户上传后自动切到图片模式

### 2.6 当前状态（2026-09-12 更新）

✅ **已完成**：
1. 7 张二次元差分头像已生成并接入（calm/happy/thinking/tool/listening/confuse/speaking）
2. 统一 512×512 PNG，透明底，存放 `src/renderer/public/image/agent/`
3. `xiyueMoodConfig.ts` 扩展为 7 种状态，全部配置图片路径
4. CSS 微动系统 P0 已实现（呼吸感 + 7 种状态独特微动 + 状态点 7 色）
5. `XiyueAvatar.tsx` 组件支持 mood class，SVG 兜底扩展为 7 种表情

📋 **待后续**：
1. `assets/avatar/T.jpg`（139.6KB）用途不明，需确认是否为临时占位
2. `agent/persona/xiyue.md` 中"无形象，靠声音+状态点"的表述已落后，需更新
3. P1 眨眼/说话口型（需 PNG 分层）
4. P2 交互/环境感知

### 2.7 角色动态效果与"活人感"设计（2026-09-11 新增）

> 调研结论：小尺寸头像（44px）的"活人感"不来自大动作，而来自持续的"微动"。参考 QQ 桌面宠物、Vue 桌面萌宠、BongoCat、Copilot Mico 等产品的实现。

#### 核心原则

- **44px 灵动岛小头像用"微动"，不用"大动作"**——Live2D 的细腻表情在这个尺寸下根本看不清
- **CSS 动画优先**——GPU 加速的 transform/opacity，几乎零性能开销，适合桌面常驻应用
- **状态联动是关键**——用户能感知到"她现在在干什么"（thinking/listening/speaking），比单纯的待机动画更重要
- **分阶段渐进**——P0 先做基础生命体征，P1 做眨眼口型，P2 做交互环境感知

#### P0（已实现，2026-09-12）：基础生命体征 + 7 状态联动

实现位置：`src/renderer/styles/hover/xiyue-tab.css` + `XiyueAvatar.tsx`（mood class）

| 动态效果 | 实现方式 | 参数 | 效果 |
|---|---|---|---|
| **呼吸感** | `@keyframes xiyue-breathe`，`scale(1→1.015→1)` | 4秒周期，ease-in-out，无限循环 | 最基础的"活着"信号 |
| **情绪切换过渡** | `.switching` 类：`opacity 0→1` + `translateY(2px)` + `scale(0.98)` | 300ms 过渡 | 避免硬切的割裂感（JS 控制加类） |
| **calm 待机** | `xiyue-calm`：`scale + translateY(1px)` 浮动 | 6秒周期，更慵懒 | 安静待机 |
| **happy 开心** | `xiyue-happy`：`scale(1.02) + translateY(-2px)` 弹性跳 | 2秒周期 | 活泼开心 |
| **thinking 思考** | `xiyue-thinking`：`rotate(-1.2°→+1.2°)` 左右轻晃 | 3秒周期 | 正在琢磨 |
| **tool 操作** | `xiyue-tool`：`rotate(-0.8°)` 极轻微点头 | 2.5秒周期 | 专注操作 |
| **listening 聆听** | `xiyue-listening`：`rotate(3°→2°)` 侧倾保持+微点头 | 2秒周期 | 认真在听 |
| **confuse 困惑** | `xiyue-confuse`：`rotate(-1.5°→+1.5°)` 快速小幅度抖动 | 1.5秒周期 | 迷茫"啊？" |
| **speaking 说话** | `xiyue-speaking`：`scale(1.015) + translateY(-1px)` 快节奏跳 | 0.45秒周期 | 模拟说话节奏 |
| **状态点联动** | 7 色状态点（calm灰/happy绿/thinking蓝/tool紫/listening红/confuse黄/speaking青），各有不同呼吸频率 | 0.6s-2.5s 周期 | 用户知道"她在干什么" |

**性能优化**：全部只用 `transform` + `opacity`，GPU 加速，`will-change: transform`，`prefers-reduced-motion` 时全部禁用。所有动画控制在 2px / 2° 以内，避免 44px 圆裁溢出。

#### P1（中期，需 PNG 分层）：眨眼 + 说话口型

| 动态效果 | 实现方式 | 前提条件 |
|---|---|---|
| **眨眼** | 眼睛单独拆成一层，随机间隔 3-8 秒 `scaleY(1→0→1)` 动画 | 需把角色 PNG 拆成 脸/眼睛/嘴巴 3-4 层 |
| **说话口型** | TTS 播放时，嘴巴层根据音频振幅开合 | 语音链路已有音频数据，可接振幅 |
| **聆听中** | 眼睛睁大、头部微倾 | 分层后可实现 |

#### P2（远期）：交互 + 环境感知

| 动态效果 | 实现方式 |
|---|---|
| **鼠标跟随** | hover 头像时眼睛/头部跟随鼠标方向微转 |
| **时间感知** | 深夜（23:00-6:00）自动切疲惫表情+打哈欠动画 |
| **点击互动** | 点击头像时眨眼+头部微动+偶尔害羞表情 |

#### 为什么不直接上 Live2D

1. **44px 下细腻表情看不清**——Live2D 的优势在大尺寸（150px+），小尺寸下和 CSS 微动效果差不多
2. **性能开销**——WebGL 渲染对桌面常驻应用不划算，CSS 动画几乎零开销
3. **成本高**——Live2D Cubism Editor $20/月订阅，建模需专业技能，个人开发者不现实
4. **大面板场景可后续升级**——如果大面板（80px+）需要更细腻表情，再考虑 Lottie 或 Live2D，灵动岛小头像永远用 CSS 微动

#### 双尺寸头像体系（已确认）

| 使用场景 | 尺寸 | 头像版本 | 说明 |
|---|---|---|---|
| 灵动岛 hover 态 | 44px | **脸部特写版**（脸+头发，去掉脖子/身体） | 脸占 80%，小尺寸下表情清晰 |
| 聊天界面消息头像 | 48px | 脸部特写版或近景版 | 脸+脖子，去掉身体 |
| 大面板/设置页 | 80px+ | **完整版头肩胸像** | 保留完整形象，含卫衣 |
| 关于页/形象展示 | 256px | 完整版 | 完整立绘 |

> 文件命名：`xiyue_{mood}.png` = 脸部特写版（灵动岛用）；`xiyue_{mood}_full.png` = 完整版（大尺寸用）。

---

## 三、应用图标（品牌层）

### 3.1 当前状态（全部还是 eisland 品牌）

| 文件 | 大小 | 用途 |
|---|---|---|
| `resources/icon/eisland.svg` | 195 KB | 应用图标源文件 |
| `resources/icon/eisland_16x16.ico` | 0.5 KB | 系统托盘图标 |
| `resources/icon/eisland_256x256.ico` | 361 KB | 应用图标/安装包 |
| `resources/icon/gabatb.png` | 18.8 KB | 用途不明 |

### 3.2 引用位置

- **electron-builder.json**：`"win.icon": "resources/icon/eisland_256x256.ico"`
- **src/main/tray.ts**：`TRAY_ICON_PATH = .../eisland_16x16.ico`
- appId 已改为 `com.xiyue.app`，productName 已改为 `汐月`（品牌名已改，图标未改）

### 3.3 需要做的

1. 设计 Xiyue 自己的应用图标（基于汐月角色形象 或 抽象"月"元素）
2. 输出三种规格：SVG 源文件 + 16x16 ICO（托盘）+ 256x256 ICO（应用/安装包）
3. 替换 electron-builder.json 和 tray.ts 中的引用
4. 确认 gabatb.png 用途，无用则删除

---

## 四、UI 图标体系（SvgIcon）

### 4.1 架构

- **位置**：`src/renderer/utils/SvgIcon/`
- **主图标集**：`eisland-icon.ts`，**108 个图标枚举**，每个值是 SVG 文件路径（如 `'./svg/CONTINUE.svg'`）
- **分类文件**：eisland-icon.ts（108个主UI）、dev-icon.ts（开发语言）、agent-icon.ts、player-icon.ts、service-icon.ts、country-icon.ts
- **SVG 文件位置**：`resources/svg/`，**实际只有 33 个 SVG 文件**
- **使用方式**：`<img src={SvgIcon.XXX} />`，通过 `filter: brightness(0) invert(var(--icon-invert))` 做主题适配

### 4.2 问题

1. **文件缺失**：eisland-icon.ts 引用 108 个，但 resources/svg/ 只有 33 个，大量图标可能 404（需实际运行验证）
2. **品牌残留**：文件名还是 `eisland-icon.ts`
3. **风格混杂**：线性/面性/品牌 logo 混合
4. **第三方品牌图标 15 个**：DEEPSEEK/OLLAMA/MINIMAX/ALIPAY/WECHATPAY/GITHUB/BILIBILI/QQ/WECHAT/KOOK/GITEE/MICROSOFT 等（需保留，确保授权）
5. **截图工具栏 33 个 SVG** 与 SvgIcon 体系分离，两套体系

### 4.3 108 个主图标分类清单

| 类别 | 图标 |
|---|---|
| 播放控制 | CONTINUE, PAUSE, PREVIOUS_SONG, NEXT_SONG, MUTE, UNMUTE |
| 窗口/岛操作 | HIDE, POWER_OFF, EXPAND, COLLAPSE, PIN_ON_TOP, DRAG |
| 工具 | SCREENSHOT, TASK_MANAGER, CALCULATOR, PLUGIN, DIY, CODING |
| 时间 | TIMER, POMODORO, BREAK, PROLONGED_SITTING, DRINKING_WATER |
| 媒体 | MUSIC, LRC, LYRIC, SMTC, BRIGHTNESS, VOLUME, SOUND |
| 网络/服务 | NETWORK, WEATHER, MAIL, UPDATE, UPDATE_TIME |
| 设置/布局 | LAYOUT, SETTING, THEME, THEME_DARK/LIGHT/FOLLOW, INTERACTION, ANIMATION, SHORTCUT_KEY, MANAGE_PAGES |
| 导航 | MOVE, MOVE_UP/DOWN, NEXT, PREVIOUS, RETURN, CANCEL, LINK |
| 内容 | PHOTO_ALBUM, MEMO, VIDEO, OCR, SEARCH, FILTER, BOOKMARK/ON, ATTACHMENT |
| 用户/身份 | USER, BOY, GIRL, LOVER, VERIFIED, AI |
| 支付/商业 | PRO, VIP, ALIPAY, WECHATPAY, RECHARGE, STOCK_CHOOSE |
| 品牌/平台 | DEEPSEEK, OLLAMA, MINIMAX, GITHUB, GITEE, BILIBILI, QQ, WECHAT, KOOK, MICROSOFT |
| 状态/操作 | STAR, DOWNLOAD, COPY, DELETE, PLUS, SWITCHING, VISIBLE/INVISIBLE, CHECKED, FIRE, INFORMATION, GUIDE, WEBSITE, DOCS, DEVELOPER, QUESTIONNAIRE, UNKNOWN, REVERT, MOKUGYO, MIMO |

### 4.4 各 UI 区域图标使用量

| 区域 | 图标数量 | 说明 |
|---|---|---|
| 灵动岛 hover time 页 | 11 | 隐藏/退出/亮度/音量/截图/任务管理器/工具箱/计算器/翻译/管理页面/设置 |
| 灵动岛 hover lyric 页 | 5 | 上一曲/暂停/播放/下一曲/爱心 |
| 灵动岛 hover xiyue 页 | 2+头像 | 麦克风/对话气泡 + XiyueAvatar |
| 设置页 | 30+ | 各设置项图标 |
| 工具箱卡片 | 12 | 下载/软件/翻译/哈希/JSON/Base64/网络/图片压缩等 |
| 截图标注工具栏 | 33 | 独立 SVG，与 SvgIcon 分离 |

---

## 五、UI 反馈范式设计

### 5.1 Agent 三态反馈要"可见地活着"（高优先级）

**现状问题**：mood 写死 happy；状态点有 4 色设计但无真实数据源；用户不知道在干什么。

**改法**：
- 状态点绑定真实阶段：`idle`（绿呼吸）/ `thinking`（蓝慢闪）/ `listening`（红快闪）/ `tool`（黄）
- 副行文案按阶段变化：「在听…」「在想…」「要打开浏览器，确认吗？」
- 岛内 compact 条、hover 页、完整聊天窗**共用同一套状态词典**

### 5.2 工具确认统一"许可卡片"语言（高优先级）

双闸门 + 通行证落地前，先定组件范式：

```
┌─────────────────────────────────────┐
│  ⚠ 要我删除这个文件吗？              │
│  D:\Downloads\old.pdf               │
│  将移入回收站，可还原                │
│                                     │
│  [ 允许一次 ]  [ 本会话允许 ]  [ 拒绝 ] │
└─────────────────────────────────────┘
```

- 岛内紧凑版：一行 + 允许/拒绝
- 大面板/独立窗完整版：参数详情 + 通行证时长
- 颜色沿用 `--cap-success` / `--cap-danger` / 警告黄

### 5.3 语音球是招牌交互（中高优先级）

`agentVoiceInput` 已是独立态（板块 3 已确认）：
- 接 VAD 后：说完自动收；波形「跳动 → 定格 → 转圈转写」
- 区分空态：转写中 / 识别失败 / 模型加载中
- 中期迁 AudioWorklet（ScriptProcessorNode 已废弃）

### 5.4 大面板空状态统一（中优先级）

- 统一空状态：插画位（可复用角色表情）+ 一句引导 + 一个主按钮
- hover Tab = 预览 + 快捷动作；expand 进同一页完整版，避免两套布局

### 5.5 设置独立窗秩序（中优先级）

- 左侧固定导航 + 右侧内容，宽度稳定
- **安全相关单独一组**（权限、通行证、审计、数据导出），与「外观/动画」拉开
- 补信任等级 UI

### 5.6 浅色主题抽查（低但易翻车）

截图/翻译/贴图浮窗的 `--cap-*` 偏 dark-only。建议 light 下走一遍，补 `[data-theme='light']` 覆盖。

---

## 六、壁纸/背景资源

### 当前内置壁纸

| 文件 | 大小 |
|---|---|
| art002e004441~orig.jpg | 1.3 MB |
| art002e008486~orig.jpg | 500 KB |
| art002e008487~orig.jpg | 471 KB |

- 配置文件：`src/renderer/assets/wallpaper/builtinWallpapers.ts`
- 用户可自定义壁纸（存储在 `%APPDATA%\xiyue\data\custom\wallpaper\`）
- **建议**：可保留现有壁纸，也可设计 1-2 张 Xiyue 品牌壁纸（汐月形象+月亮/潮汐元素）

---

## 七、问题汇总与优先级

### 高优先级（影响品牌识别和日常体验）

| # | 问题 | 影响 | 来源 |
|---|---|---|---|
| H1 | 应用图标还是 eisland 品牌 | 用户安装后看到别人的 logo | 图标调查 |
| H2 | 托盘图标还是 eisland | 系统托盘显示别人的 logo | 图标调查 |
| H3 | 汐月头像是极简线条，非二次元小姑娘 | 与产品定位不符 | 设计建议+图标调查 |
| H4 | 表情只有 4 种，换脑后不够用 | 情绪系统接入后表情不足 | 设计建议+图标调查 |
| H5 | SvgIcon 108 个引用可能大量 404 | 部分 UI 图标显示不出来 | 图标调查 |
| H6 | mood 写死 happy，状态不可见 | 用户不知道 AI 在干什么 | 设计建议 |

### 中优先级（影响视觉一致性和体验）

| # | 问题 | 影响 | 来源 |
|---|---|---|---|
| M1 | UI 图标风格混杂（线性/面性/品牌混合） | 视觉不统一 | 图标调查 |
| M2 | 截图工具栏 33 个 SVG 与 SvgIcon 分离 | 两套图标体系 | 图标调查 |
| M3 | eisland-icon.ts 文件名品牌残留 | 代码维护 | 图标调查 |
| M4 | 工具确认无统一"许可卡片"范式 | 交互不统一 | 设计建议 |
| M5 | 大面板空状态不统一 | 体验不一致 | 设计建议 |
| M6 | 设置页安全相关未单独分组 | 信息架构混乱 | 设计建议 |
| M7 | persona 文案"无形象"已落后 | 与产品定位矛盾 | 设计建议 |

### 低优先级（优化/清理类）

| # | 问题 | 影响 | 来源 |
|---|---|---|---|
| L1 | gabatb.png 用途不明 | 清理 | 图标调查 |
| L2 | T.jpg 临时头像需清理 | 清理 | 图标调查 |
| L3 | 壁纸无 Xiyue 品牌 | 品牌一致性 | 图标调查 |
| L4 | 浅色主题未全面验证 | 易翻车 | 设计建议 |
| L5 | 死 UI 需清理（volume-analyzer 等） | 清理 | 设计建议 |

---

## 八、开源图标库对比（供方案选择）

| 图标库 | 许可 | 图标数量 | 风格 | 推荐度 |
|---|---|---|---|---|
| **Lucide** | ISC（可商用，需保留版权声明） | 1000+ | 线性，24x24，2px 描边 | ⭐⭐⭐⭐⭐ 首选 |
| Tabler Icons | MIT | 4000+ | 线性，24x24，2px 描边 | ⭐⭐⭐⭐ 备选 |
| Phosphor Icons | MIT | 6000+ | 6 种粗细 | ⭐⭐⭐⭐ 备选 |
| Remix Icon | Apache 2.0 | 2500+ | 线性+面性 | ⭐⭐⭐ 备选 |

**Lucide 推荐理由**：ISC 许可宽松，风格与当前 XiyueAvatar/XiyueActionIcons 的线性风格一致（round cap/join），1000+ 图标覆盖绝大部分 UI 需求。

---

## 九、讨论点（逐个确认）

> 以下问题按优先级排序，我们一个个讨论确认，确认后写入文档。

### 讨论点 1：图标方案选择 ✅ 已确认（2026-09-11）

**确认方案：方案 A —— Lucide 为主 + 自定义补充 + 品牌图标独立**

#### 具体方案

| 类别 | 来源 | 说明 |
|---|---|---|
| 通用 UI 图标 | **Lucide 开源库**（ISC 许可，可商用，需保留版权声明） | 1000+ 线性图标，24×24 / 2px 描边 / round cap/join / currentColor，覆盖播放/工具/媒体/导航/状态/AI 等绝大部分需求 |
| 项目特有图标 | **自行绘制**，严格遵循 Lucide 规范 | 放 `resources/svg/custom/`，规范：24×24 viewBox / fill=none / stroke=currentColor / stroke-width=2 / stroke-linecap=round / stroke-linejoin=round |
| 其他补充图标 | **Tabler Icons**（4000+，MIT）或 **Phosphor**（6000+，MIT） | Lucide 确实没有时从备选库补充，风格类似 |
| 第三方品牌图标 | **独立存放**，不统一风格 | DEEPSEEK/OLLAMA/MINIMAX/GITHUB/BILIBILI/QQ/WECHAT 等品牌 logo 必须保持原样，放 `resources/svg/brand/` |
| 角色形象/表情 | **单独设计**（二次元少女） | 不属于图标体系，见讨论点 2 |

#### 实施要点

1. **替换 eisland-icon.ts**：108 个引用逐个映射到 Lucide 图标，缺失的自行绘制补全
2. **验证 404**：实际运行应用，确认所有图标正常加载（结合讨论点 6）
3. **建立图标规范文档**：写清楚自定义图标的绘制规范，后续新增图标按规范来
4. **品牌图标分离**：15 个第三方品牌图标从主图标集分离到 `brand/` 目录
5. **截图工具栏统一**：33 个独立 SVG 评估是否统一到 SvgIcon 体系（结合讨论点 7）
6. **保留现有自定义图标**：XiyueActionIcons（麦克风/对话气泡）风格已与 Lucide 一致，可保留或替换为 Lucide 对应图标

#### Lucide 风格样例（已展示确认）

播放/暂停/上一曲/下一曲、截图/计算器/翻译/设置、亮度/音量/音乐/麦克风、AI助手/对话/爱心/下载 共 16 个图标，风格与现有 XiyueActionIcons 一致，替换后无割裂感。

### 讨论点 2：汐月角色形象设计方向
- 发色/瞳色/服装风格偏好？
- 是否融入"月亮/潮汐"元素（名字=汐月）？
- 有没有参考图或喜欢的二次元风格？
- 表情 10 种是否够用？需要加害羞/惊讶/吐槽吗？

### 讨论点 3：应用图标设计方向
- 基于汐月角色头像（头肩+圆角底）？
- 还是抽象的"月"元素 logo（月亮+潮汐波纹）？
- 还是两者结合？

### 讨论点 4：Agent 状态反馈设计
- 状态点 4 色（idle绿/thinking蓝/listening红/tool黄）是否够用？
- 副行文案按阶段变化，需要哪些阶段的文案？
- 岛内 compact 条、hover 页、聊天窗共用状态词典，是否需要先定义词典？

### 讨论点 5：许可卡片范式
- 三按钮（允许一次/本会话允许/拒绝）是否合适？
- 岛内紧凑版一行+允许/拒绝，大面板完整版参数详情+通行证时长，这个分层是否合理？
- 颜色用 --cap-success/--cap-danger/警告黄，是否需要新的设计 token？

### 讨论点 6：图标 404 验证
- 需要实际运行应用验证哪些图标缺失，是否现在就做？
- 还是等换图标方案时一起验证补全？

### 讨论点 7：截图工具栏图标统一
- 33 个独立 SVG 是否统一到 SvgIcon 体系？
- 还是保持独立但统一风格？

### 讨论点 8：壁纸与品牌资产
- 是否需要设计 Xiyue 品牌壁纸？
- 现有 3 张壁纸保留还是替换？

---

> 报告结束。从讨论点 1 开始，一个个确认。
