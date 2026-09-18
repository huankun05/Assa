# Assa 图标与形象设计调查报告

> 调查日期：2026-09-11
> 调查范围：全项目的图标、图像、角色头像资源及使用位置
> 目标：摸清哪些地方需要图标/头像，规划一整套属于 Assa 自己的图标体系和 AI 形象

---

## 一、应用图标（品牌层）

### 当前状态（全部还是 eisland 品牌）

| 文件 | 大小 | 用途 |
|---|---|---|
| `resources/icon/eisland.svg` | 195 KB | 应用图标源文件（SVG） |
| `resources/icon/eisland_16x16.ico` | 0.5 KB | 系统托盘图标 |
| `resources/icon/eisland_256x256.ico` | 361 KB | 应用图标/安装包图标 |
| `resources/icon/gabatb.png` | 18.8 KB | 用途不明（需确认） |

### 引用位置

- **electron-builder.json**：`"win.icon": "resources/icon/eisland_256x256.ico"`
- **src/main/tray.ts**：`TRAY_ICON_PATH = .../eisland_16x16.ico`
- **appId**：已改为 `com.assa.app`，**productName**：已改为 `汐月`（品牌名已改，图标未改）

### 需要做的

1. 设计 Assa 自己的应用图标（建议基于"汐月"=潮汐+月亮的意象，或基于汐月角色形象）
2. 输出三种规格：SVG 源文件 + 16x16 ICO（托盘）+ 256x256 ICO（应用/安装包）
3. 替换 electron-builder.json 和 tray.ts 中的引用
4. 确认 gabatb.png 用途，无用则删除

---

## 二、UI 图标体系（SvgIcon）

### 架构

- **位置**：`src/renderer/utils/SvgIcon/`
- **主图标集**：`eisland-icon.ts`，**108 个图标枚举**，每个值是 SVG 文件路径（如 `'./svg/CONTINUE.svg'`）
- **分类文件**：

| 文件 | 大小 | 内容 |
|---|---|---|
| eisland-icon.ts | 4.3 KB | 主 UI 图标集（108 个） |
| dev-icon.ts | 5 KB | 开发语言/文件类型图标 |
| agent-icon.ts | 1.1 KB | Agent 相关图标 |
| player-icon.ts | 1.2 KB | 播放器图标 |
| service-icon.ts | 1.1 KB | 服务图标 |
| country-icon.ts | 2.3 KB | 国家/地区图标 |

- **SVG 文件位置**：`resources/svg/`，**实际只有 33 个 SVG 文件**
- **使用方式**：`<img src={SvgIcon.XXX} />`，通过 `filter: brightness(0) invert(var(--icon-invert))` 做主题适配

### 问题

1. **文件缺失**：eisland-icon.ts 引用了 108 个图标，但 resources/svg/ 只有 33 个文件，大量图标路径可能 404（需验证哪些实际存在）
2. **品牌残留**：文件名还是 `eisland-icon.ts`，导出名还是 `SvgIcon`（内容已不只是 eisland）
3. **风格混杂**：混合了线性图标、面性图标、品牌 logo，视觉不统一
4. **第三方品牌图标**：DEEPSEEK、OLLAMA、MINIMAX、ALIPAY、WECHATPAY、GITHUB、BILIBILI、QQ、WECHAT、KOOK、GITEE、MICROSOFT 等 15 个品牌图标（需保留，但确保授权合规）

### 108 个主图标分类清单

| 类别 | 图标 |
|---|---|
| 播放控制 | CONTINUE, PAUSE, PREVIOUS_SONG, NEXT_SONG, MUTE, UNMUTE |
| 窗口/岛操作 | HIDE, POWER_OFF, EXPAND, COLLAPSE, PIN_ON_TOP, DRAG |
| 工具 | SCREENSHOT, TASK_MANAGER, CALCULATOR, PLUGIN, DIY, CODING |
| 时间 | TIMER, POMODORO, BREAK, PROLONGED_SITTING, DRINKING_WATER |
| 媒体 | MUSIC, LRC, LYRIC, SMTC, BRIGHTNESS, VOLUME, SOUND |
| 网络/服务 | NETWORK, WEATHER, MAIL, UPDATE, UPDATE_TIME |
| 设置/布局 | LAYOUT, SETTING, THEME, THEME_DARK, THEME_LIGHT, THEME_FOLLOW_SYSTEM, INTERACTION, ANIMATION, SHORTCUT_KEY, MANAGE_PAGES |
| 导航 | MOVE, MOVE_UP, MOVE_DOWN, NEXT, PREVIOUS, RETURN, CANCEL, LINK |
| 内容 | PHOTO_ALBUM, MEMO, VIDEO, OCR, SEARCH, FILTER, BOOKMARK, BOOKMARK_ON, ATTACHMENT |
| 用户/身份 | USER, BOY, GIRL, LOVER, VERIFIED, AI |
| 支付/商业 | PRO, VIP, ALIPAY, WECHATPAY, RECHARGE, STOCK_CHOOSE |
| 品牌/平台 | DEEPSEEK, OLLAMA, MINIMAX, GITHUB, GITEE, BILIBILI, QQ, WECHAT, KOOK, MICROSOFT |
| 状态/操作 | STAR, DOWNLOAD, COPY, DELETE, PLUS, SWITCHING, VISIBLE, INVISIBLE, CHECKED, FIRE, INFORMATION, GUIDE, WEBSITE, DOCS, DEVELOPER, QUESTIONNAIRE, UNKNOWN, REVERT, MOKUGYO, MIMO |

### 需要做的

1. **统一图标风格**：建议线性图标，24x24 viewBox，1.5px 描边，圆角端点（round cap/join），单色 currentColor
2. **补全缺失图标**：验证 108 个引用哪些 404，补全 SVG 文件
3. **可引用开源图标库**（MIT/ISC 许可，可商用）：
   - **Lucide**（ISC，1000+ 图标，风格统一，推荐首选）
   - **Tabler Icons**（MIT，4000+ 图标）
   - **Phosphor Icons**（MIT，6 种粗细可选）
4. **品牌图标保留**：第三方服务 logo 单独存放，不混入通用图标集
5. **重命名**：`eisland-icon.ts` → `assa-icon.ts`（P2，涉及大量引用修改）

---

## 三、汐月 AI 头像/角色形象

### 当前状态

| 组件 | 位置 | 说明 |
|---|---|---|
| AssaAvatar.tsx | hover/pages/assa/components/ | 内联 SVG 头像，圆形框+眼嘴表情+AI sparkle |
| assaMoodConfig.ts | hover/pages/assa/config/ | 4 种状态（happy/thinking/confuse/listening），AVATAR_IMAGE_MAP 全空（用 SVG 模式） |
| T.jpg | src/renderer/assets/avatar/ | 139.6 KB，临时头像图片（需确认内容） |

### AssaAvatar 当前实现

- **双轨渲染**：AVATAR_IMAGE_MAP 配了路径走图片模式，否则走内联 SVG 模式
- **SVG 模式**：32x32 viewBox，圆形头像框（r=10.6）+ 眼嘴表情（随状态变化）+ 右上角 AI sparkle（四角星）
- **4 种表情**：
  - happy：圆眼 + 微笑
  - thinking：半闭眼（向下弧）+ 抿嘴
  - confuse：一眼眯（横线）一眼睁 + 波浪嘴
  - listening：睁眼 + 张嘴（小圆）
- **主题适配**：全部 currentColor + filter invert

### 问题

1. **形象不符**：当前是极简线条风格（圆框+眼嘴），不是用户要求的"可爱小姑娘二次元"形象
2. **表情不足**：只有 4 种，换脑后情绪系统有 8 种标签（happy/sad/anxious/calm/excited/angry/tired/gentle）+ 工作状态
3. **无正式设计稿**：汐月形象目前没有设计稿（板块 1 已确认，留替代空间）
4. **T.jpg 不明**：assets/avatar/ 下有一张 139.6KB 的图片，需确认是否为临时占位

### 需要做的

#### 角色形象设计

- **风格**：可爱小姑娘二次元（用户明确要求）
- **设计元素建议**：
  - 名字"汐月"=潮汐+月亮，可融入月亮/潮汐/水元素
  - 发色/瞳色/服装风格待定（需用户参与设计决策）
  - 头像为圆形裁切，透明背景

#### 表情清单（至少 10 种）

| 表情 | 对应情绪/状态 | 使用场景 |
|---|---|---|
| happy 开心 | PAD 愉悦高 | 日常待机、完成任务 |
| sad 悲伤 | PAD 愉悦低 | 安慰用户、共情 |
| anxious 焦虑 | PAD 唤醒高+愉悦低 | 处理复杂任务、等待 |
| calm 平静 | PAD 中性 | 默认待机 |
| excited 兴奋 | PAD 愉悦+唤醒双高 | 好消息、庆祝 |
| angry 愤怒 | PAD 愉悦低+支配高 | （较少用，可做吐槽表情） |
| tired 疲惫 | PAD 唤醒低 | 深夜、长时间运行 |
| gentle 温和 | PAD 愉悦中+支配低 | 温柔回复、关心用户 |
| thinking 思考中 | 工作状态 | LLM 推理中 |
| listening 聆听中 | 工作状态 | 语音输入中 |

#### 尺寸规格

| 尺寸 | 用途 | 位置 |
|---|---|---|
| 40x40 | 灵动岛 hover 态头像 | AssaTab |
| 48x48 | 聊天界面消息头像 | ChatMessageRow |
| 80x80 | 大面板/设置页头像 | 大面板 AI 页 |
| 256x256 | 关于页/形象展示 | 设置页关于 |

#### 格式与存储

- **格式**：PNG（透明背景，日常使用）+ SVG（矢量，源文件）
- **内置默认**：`src/renderer/assets/avatar/`（替换 T.jpg）
- **用户自定义**：`%APPDATA%\assa\data\custom\avatar\`（板块 5 已确认的自定义上传）
- **切换机制**：沿用现有 AVATAR_IMAGE_MAP 双轨设计，用户上传后自动切到图片模式

---

## 四、各 UI 区域图标使用清单

### 4.1 灵动岛 hover 态（6 个 Tab）

| Tab | 图标数量 | 图标清单 |
|---|---|---|
| time（时间/工具） | 11 | HIDE, POWER_OFF, BRIGHTNESS, VOLUME, SCREENSHOT, TASK_MANAGER, PLUGIN(工具箱), CALCULATOR, LANGUAGE(翻译), MANAGE_PAGES, SETTING |
| lyric（歌词/音乐） | 5 | PREVIOUS_SONG, PAUSE, CONTINUE(播放), NEXT_SONG, HeartIcon(自定义) |
| weather（天气） | 1+ | WEATHER（+ 天气状况图标，需确认来源） |
| assa（AI） | 2 | MicrophoneIcon(自定义), ChatBubbleIcon(自定义) + AssaAvatar |
| 其他 Tab | - | 需确认（guide/miniGame 等） |

### 4.2 大面板（13 页）

各页面有独立图标，在设置页配置中定义（见 4.3）。需逐页确认图标使用情况。

### 4.3 设置页（30+ 图标）

| 设置项 | 图标 |
|---|---|
| 布局预览/展开布局/大面板布局 | LAYOUT |
| 相册 | PHOTO_ALBUM |
| 隐藏进程列表 | TASK_MANAGER |
| 位置 | MOVE |
| 网络 | NETWORK |
| 邮件 | MAIL |
| 天气 | WEATHER |
| 音乐（5个子页） | LRC/MUSIC/SMTC/STAR |
| 快捷键 | SHORTCUT_KEY |
| 更新 | UPDATE_TIME |
| 关于 | ABOUT |
| 主题 | THEME |
| 语言 | LANGUAGE |
| 行为 | INTERACTION |
| 动画 | ANIMATION |
| URL解析 | LINK |
| 剪贴板历史 | COPY |
| 闹钟 | TIMER |
| 休息提醒 | BREAK |
| 控制中心 | INTERACTION |
| 开机自启 | CONTINUE |
| 声音 | SOUND |
| 通知 | NOTIFICATION |
| 性能/性能监控 | TASK_MANAGER |
| 截图设置 | SCREENSHOT |
| 插件市场 | PLUGIN |

### 4.4 截图标注工具栏（33 个独立 SVG）

`resources/svg/` 下的 33 个 SVG 是截图标注工具的图标：

ARROW, BLUR, CANCEL, COPY, CURSOR, ELLIPSE, FINISH, LINE, LONGSHOT, MOSAIC, MOVE, NOISE, OCR, PAINTBRUSH, PICKER, PIN, PRO, QR, REC, RECTANGLE, REDO, SAVE, SELECT, SOLID, TEXT, TRANSLATION, UNDO 等

- **问题**：这 33 个和 SvgIcon 体系是分开的，风格可能不一致
- **需要**：统一到 SvgIcon 体系，或保持独立但统一风格

### 4.5 工具箱（12 个卡片图标）

`commonToolboxConfig.ts` 定义了 12 个工具卡片：

DOWNLOAD(创建/历史), STAR(软件), LANGUAGE(翻译), TASK_MANAGER(哈希), CODING(JSON/Base64), NETWORK(网络), PLUGIN(图片压缩/历史), DIY(图片格式/视频格式)

---

## 五、壁纸/背景资源

### 当前内置壁纸

| 文件 | 大小 |
|---|---|
| art002e004441~orig.jpg | 1.3 MB |
| art002e008486~orig.jpg | 500 KB |
| art002e008487~orig.jpg | 471 KB |

- 配置文件：`src/renderer/assets/wallpaper/builtinWallpapers.ts`
- 用户可自定义壁纸（板块 5 已确认，存储在 `%APPDATA%\assa\data\custom\wallpaper\`）
- **建议**：可保留现有壁纸，也可设计 1-2 张 Assa 品牌壁纸（汐月形象+月亮/潮汐元素）

---

## 六、问题汇总与优先级

### 高优先级（影响品牌识别和日常体验）

| # | 问题 | 影响 |
|---|---|---|
| 1 | 应用图标还是 eisland 品牌 | 用户安装后看到的是别人的 logo |
| 2 | 汐月头像还是极简线条，非二次元小姑娘 | 与产品定位不符，AI 形象缺失 |
| 3 | SvgIcon 108 个引用但可能大量 404 | 部分 UI 图标显示不出来 |
| 4 | 托盘图标还是 eisland | 系统托盘显示别人的 logo |

### 中优先级（影响视觉一致性）

| # | 问题 | 影响 |
|---|---|---|
| 5 | UI 图标风格混杂（线性/面性/品牌混合） | 视觉不统一 |
| 6 | 截图工具栏 33 个 SVG 与 SvgIcon 体系分离 | 两套图标体系 |
| 7 | eisland-icon.ts 文件名品牌残留 | 代码维护 |
| 8 | 表情只有 4 种，换脑后不够用 | 情绪系统接入后表情不足 |

### 低优先级（优化类）

| # | 问题 | 影响 |
|---|---|---|
| 9 | gabatb.png 用途不明 | 清理 |
| 10 | 壁纸无 Assa 品牌 | 品牌一致性 |
| 11 | T.jpg 临时头像需清理 | 清理 |

---

## 七、设计建议方案

### 方案 A：引用开源图标库 + 自行设计角色形象（推荐）

**图标**：
- 通用 UI 图标：引用 **Lucide**（ISC 许可，1000+ 图标，风格统一，可直接下载 SVG 放入 resources/svg/）
- 品牌图标：保留现有第三方 logo（确保授权），单独存放
- 截图工具图标：用 Lucide 对应图标替换或重绘统一风格
- 预计工作量：1-2 天（补全 108 个图标 + 统一风格）

**角色形象**：
- 委托设计或 AI 生成 + 人工修图，设计汐月二次元小姑娘形象
- 输出 10 种表情 + 4 种尺寸 + PNG/SVG 双格式
- 预计工作量：3-5 天（含设计沟通和修改）

**应用图标**：
- 基于汐月角色形象或"月"元素设计
- 输出 SVG + 16ICO + 256ICO
- 预计工作量：1 天

### 方案 B：全部自行绘制（不推荐）

- 所有图标自行设计，风格完全统一
- 但工作量大（108+ 图标 + 角色形象 + 应用图标），且需要专业设计能力
- 预计工作量：2-3 周

### 方案 C：保持现状，只换应用图标和头像（最低限度）

- 只做应用图标 + 汐月头像，UI 图标保持现状
- 工作量最小，但 UI 图标风格混杂和 404 问题不解决
- 预计工作量：2-3 天

---

## 八、开源图标库对比

| 图标库 | 许可 | 图标数量 | 风格 | 推荐度 |
|---|---|---|---|---|
| **Lucide** | ISC（可商用，需保留版权声明） | 1000+ | 线性，24x24，2px 描边 | ⭐⭐⭐⭐⭐ 首选 |
| Tabler Icons | MIT | 4000+ | 线性，24x24，2px 描边 | ⭐⭐⭐⭐ 备选 |
| Phosphor Icons | MIT | 6000+ | 6 种粗细（线性/面性/填充等） | ⭐⭐⭐⭐ 备选 |
| Remix Icon | Apache 2.0 | 2500+ | 线性+面性 | ⭐⭐⭐ 备选 |
| Heroicons | MIT | 300+ | 线性+面性，Tailwind 官方 | ⭐⭐⭐ 数量少 |

**Lucide 推荐理由**：ISC 许可宽松（可商用，只需保留版权声明），风格与当前 AssaAvatar/AssaActionIcons 的线性风格一致（round cap/join），1000+ 图标覆盖绝大部分 UI 需求，社区活跃更新频繁。

---

## 九、下一步讨论点

1. **图标方案选择**：方案 A（引用 Lucide + 自行设计形象）/ 方案 B（全部自行绘制）/ 方案 C（最低限度）
2. **汐月角色形象设计方向**：发色/瞳色/服装/元素（月亮/潮汐），是否有参考图
3. **应用图标设计方向**：基于角色形象还是抽象"月"元素
4. **表情数量**：10 种是否够用，是否需要更多（如害羞/惊讶/吐槽）
5. **用户自定义头像**：是否需要支持 Live2D/动态头像（P3 远期）
6. **图标 404 验证**：需要实际运行应用验证哪些图标缺失

---

> 报告结束。以上为全面调查结果，待用户确认设计方向后进入实施阶段。
