# Xiyue（汐月）设计系统总纲

> **地位**：本文件是 UI 开发的**单一事实源（SSOT）**。与旧文档冲突时，**以本文件为准**。  
> **状态**：2026-09-12 分板块讨论**已定稿**（决策见 §9；实施节奏见 §10）。  
> **上游文档**：`DESIGN_STYLE_GUIDE.md`（历史风格指南，token/组件细节仍可参考，但「恐龙」「岛体玻璃铁律」等表述已废弃）。  
> **其它来源**：`docs/Xiyue_UI设计与图标形象整合报告_v1.0.md`、`docs/Xiyue_设计与改进建议_v1.0.md`、全板块代码调查。  
> **平台**：Windows · Electron · 仅此平台。  
> **截图边界**：截图**功能/拼接/画质**问题由功能侧继续调试；本设计系统**只约束截图 UI**。

---

## 0. 一句话

> **iOS Dynamic Island 骨架 + 冷色玻璃 UI + 暖色「汐月」少女角色。**  
> 冷 UI、暖角色；功能图标单色可主题化；品牌与插画保原色；岛体不抢焦点、不长期遮挡。

---

## 1. 设计基因（不可违反）

| # | 原则 | 说明 |
|---|---|---|
| 1 | Apple-inspired 极简骨架 | 细长胶囊 → 状态条 → 大面板 三段式；spring 弹性形变 |
| 2 | 冷色玻璃面板 | 深色为主、主题蓝强调；桌面浮层必须 blur+saturate |
| 3 | **暖色汐月角色** | **主形象 = 二次元可爱少女**；像素恐龙仅为 eIsland 遗产，**禁止再作为产品人格** |
| 4 | 冷暖对冲 | UI 冷、角色暖；禁止 UI 与角色都冷或都暖 |
| 5 | 岛不抢焦点 | idle 态点击穿透优先；hover 不得在「扫过顶部」时抢走背后点击 |

---

## 2. 颜色 Token（统一方案）

### 2.1 核心（已有，扩展）

在 `reset.css` 的 `:root` / `[data-theme="light"]` 维护：

| Token | dark | light | 用途 |
|---|---|---|---|
| `--color-text-rgb` | `255,255,255` | `0,0,0` | 文字 `rgba(var(--color-text-rgb), α)` |
| `--color-island-bg` | `#000` | `#f5f5f7` | 岛/面板底 |
| `--color-island-text` | `#fff` | `#1d1d1f` | 实色文字 |
| `--color-island-accent` | `oklch(0.7 0.15 250)` | 同 | **唯一强调色** |
| `--color-island-accent-rgb` | **新增** `100,170,255` | 同 | 给独立窗/JS 用的 RGB 三元组（与 oklch 视觉对齐） |
| `--icon-invert` | `1` | `0` | 仅用于**单色功能图标**的 mask/filter |

### 2.2 语义色（新增，必须使用）

禁止在组件里散落 `#34c759` / `#ff4d4f` / `#409cff` 等。统一：

```css
:root {
  --color-ok-rgb: 52, 199, 89;       /* 成功/在线  #34c759 */
  --color-warn-rgb: 255, 149, 0;     /* 警告/待确认 #ff9500 */
  --color-danger-rgb: 255, 59, 48;   /* 危险/错误 #ff3b30 */
  --color-info-rgb: 64, 156, 255;    /* 信息/思考 #409cff */
  /* 用法：color: rgba(var(--color-ok-rgb), .9); */
}
```

| 语义 | 用途 |
|---|---|
| ok | 授权允许、成功 toast、状态点 idle/online |
| warn | 待确认、toolCalling |
| danger | 错误、拒绝、录制危险 |
| info | 思考中、链接、次强调 |

**accent vs info**：品牌按钮/选中态 → `accent`；状态点「思考中」→ `info`（可不同值，但同属 token）。

### 2.3 禁止项

- 组件 CSS 写死 `#fff` / `#000` 做文字或交互态（用 `text-rgb`）
- 新增任意蓝/绿/红硬编码（截图 `#409cff`、公告 `#7cbcff` 等 → 改引 accent 或 accent-rgb）
- 用「颜色字符串嗅探」选色（如 `message.includes('失败')`）→ 用布尔 flag + 语义 class

### 2.4 品牌蓝收敛路径

| 现状 | 目标 |
|---|---|
| `--color-island-accent` oklch | 保留为 CSS 主源 |
| 截图 `#409cff` / `#2f7fe6` | 改为 `var(--color-island-accent-rgb)` 或同源 hex 常量表 |
| 公告 `#7cbcff` | 同上 |
| 通知 `#4fc3f7` | 同上 |

独立窗（capture/pin）若无法直接引用 renderer 变量，在各自 `:root` 用**同一套 hex 表**（见附录 A），禁止再发明新蓝。

---

## 3. 图标色彩策略（替代「一刀切 filter」）

### 3.1 问题

全局 `filter: brightness(0) invert(var(--icon-invert))` 会把**任意颜色压成纯黑再反相**，导致品牌/情绪/天气源文件颜色全部丢失。

### 3.2 三层契约（强制）

| 层 | 内容 | 渲染 | 主题 |
|---|---|---|---|
| **A. 功能单色** | 播放/设置/工具等轮廓图标 | 见 §3.3 方案 | 跟随 dark/light |
| **B. 品牌多色** | DEEPSEEK/微信/GitHub/支付… | **保留源文件官方色** | **不反相** |
| **C. 插画/角色/天气** | 汐月头像、天气 PNG、AGENT 图 | 保留原画 | **不反相** |

### 3.3 功能图标上色：优先 Mask，慎用 brightness(0)

**推荐（新代码一律用）：CSS Mask**

```css
/* 单色功能图标：颜色 = background-color，可跟 accent/语义色，不再 invert 洗色 */
.icon-mono {
  display: inline-block;
  width: 1em;
  height: 1em;
  background-color: currentColor; /* 或 var(--color-island-text) */
  -webkit-mask-image: var(--icon-url);
  mask-image: var(--icon-url);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
  -webkit-mask-position: center;
  mask-position: center;
  -webkit-mask-size: contain;
  mask-size: contain;
  /* 浅色主题：若仍用黑色 SVG 作 mask，形状只取决于 alpha，颜色由 background 决定 → 无需 invert */
}
```

```html
<!-- 用法：img 换成 span，或 CSS 变量传路径 -->
<span class="icon-mono" style="--icon-url: url('./svg/SETTING.svg')"></span>
```

**优点**：

1. 形状来自 SVG alpha，**颜色独立** → 可 `currentColor` / accent / 语义色，不再「只能黑白」。
2. 同一张单色 SVG 在暗色显白、浅色显黑，靠 `color`，**无 brightness(0)**。
3. 需要「品牌色点缀的 UI 图标」（如搜索高亮）可直接改 `background-color`，无需第二套文件。

**过渡（存量）**：允许暂留 `filter: brightness(0) invert(var(--icon-invert))`，但**仅限确认为单色轮廓的 SVG**；新代码禁止再写这条 filter 作为默认。

**品牌/插画**：

```css
.icon-color {
  filter: none !important;
  opacity: 1;
}
```

所有品牌 SVG / 天气 PNG / 角色图必须挂 `.icon-color`（或所在容器保证无 filter）。建议在 `reset.css` 定义**全局** `.no-filter` / `.icon-color`，避免局部「碰巧无 filter」。

### 3.4b Hover 图标尺寸（已定）

**不**一刀切同一像素；按**角色分档**，允许光学微调（需有意、可注释）：

| 角色 | 约束 |
|---|---|
| 功能按钮图标 | 约 18–22px 一档；同排主/次差 ≤ ~4px |
| 内容主视觉（天气等） | 允许单独更大（如 36px），不进按钮档 |
| 品牌 logo | 常 14–16，保色 |

### 3.4c 不该做的

- 给多色 SVG 套 invert 再「想办法调回来」
- 用 `hue-rotate` 滤镜假彩色（边缘脏、不可维护）
- 为 dark/light 维护两套品牌 logo（除非官方就是双版本）

### 3.5 天气图标专条

| 场景 | 策略 |
|---|---|
| Hover 天气主视觉 | 继续用 `public/icon/*.png` 插画，**永不 invert** |
| 设置/通知侧「天气」入口符号 | 二选一（待拍板）：① 继续单色功能图标；② 小号彩色天气 PNG 与 hover 一致 |
| 素材偏灰（雨/云） | 属美术风格；若要「更有色」需**重绘更饱和插画集**，不是 CSS 能解决的 |

---

## 4. 玻璃 · 岛体 · 遮挡

### 4.1 玻璃分层（修正旧铁律）

| 层级 | 策略 | 理由 |
|---|---|---|
| **灵动岛壳** idle/hover/agent | **不透明实底**（或近实底） | 对齐 iOS；可读性、性能、避免 backdrop 伤合成 |
| **桌面浮层** 截图/贴图/OCR/设置面板/公告大块 | **必须** `backdrop-filter: blur(Xpx) saturate(1.4)` + `-webkit-` | Xiyue 玻璃语言 |
| 启动屏 | 有意固定黑底 | 品牌闪屏，可接受 |

**旧 Style Guide §2.6「浮层必须 backdrop-filter」仅适用于桌面浮层，不适用于岛壳。**

### 4.2 岛遮挡与误触（已定策略）

**根因（已查实）**：置顶视觉遮挡 + 50ms 轮询进岛即关穿透并展开；`enterDelay` 曾未接线（已修）。

**产品原则（遮挡，已定）**：

> **默认保留悬停展开**（灵动岛感）。  
> 遮挡背后窗口时：**右键让路约 3 秒**（淡入回来）；长期隐藏用设置/热键。  
> 不以「强制点击展开」为默认。

**落地阶梯**：

| 阶段 | 方案 | 状态 |
|---|---|---|
| **P0** | 悬停展开 + enterDelay 250ms + **右键让路 3s**（计时内不回弹，回来 280ms 淡入） | **已实现并验收** |
| **P1** | idle 热区收窄 | 可选加强，非必须 |
| **P2** | 贴顶休眠露头条 | **取消**（产品验收现方案足够） |

**发现性**：首次引导「右键让路」卡 + 行为设置文案说明。

---

## 4A. 产品信息架构（小面板 / 大面板）

| 层 | 定位 | 例子 |
|---|---|---|
| **小面板 Hover** | 扫一眼、点一下：快捷 + 状态预览 | 控制中心一排按钮、番茄大时间、歌词、汐月头像 |
| **大面板 Expand** | 停下来用：完整功能与设置 | 设置窗、工具箱、聊天、总览、翻译全文 |

**Hover Tab 职责（已定）**：

| Tab | 职责 |
|---|---|
| **ControlCenterTab**（原 TimeTab） | **控制中心**：亮度/音量/截图等快捷按钮；**不再**承担计时 |
| **PomodoroTab** | **精简专注**：大时间 + 工作/休息 + 播放/暂停/重置；**无**岛上填表（时长进设置） |
| Weather / Lyrics / Xiyue | 状态与轻交互 |
| 大面板总览番茄 | **完整控件**（环形进度/时间轴）；与 hover **共用同一 store 状态** |

**Agent 岛条定位（已定）**：

> 岛条 = **状态词 + 一行摘要（可截断，不滚动全文）**；长回答进大聊天窗；**授权卡片仍在岛**。

**设置入口**：大面板「设置」页签 = **打开独立设置窗**（不做空壳、不做大面板内精简设置）。

---

## 5. 角色形象（汐月）· 替换恐龙计划

### 5.1 定位

- **主形象**：二次元可爱少女（设计 brief 见整合报告 §2.2）。
- **像素恐龙**：eIsland 遗产；**归档，不进正式应用**（`public/image/legacy/eisland-dino/` 或删除）；不得出现在默认路径与品牌叙事。
- **过渡期（已定）**：代码只认 `xiyue_{mood}.png`；差分未齐的 mood **临时共用已有少女图或状态点**，**禁止回落恐龙**。

### 5.2 现状分裂

| 位置 | 现用 | 目标 |
|---|---|---|
| 岛内 Agent 条（74px） | `AGENT_*.png` 恐龙五态 | **少女五态+** 差分 |
| Hover 汐月页 | `xiyue_happy.png`（仅 happy）；其它 mood → 冷色 SVG | 全 mood 图片模式 |
| 应用/托盘图标 | eisland | 汐月品牌图标 |

### 5.3 状态差分清单（比「五态」更丰富）

在原 connecting/thinking/tool/answer/error 上扩展：

| ID | 状态 | 用途 | 优先级 |
|---|---|---|---|
| `calm` | 平静/待机 | idle 问候 | P0 |
| `happy` | 开心 | 完成/日常 | P0（已有图） |
| `thinking` | 思考 | LLM 推理 | P0 |
| `tool` | 专注/操作 | 工具调用 | P0 |
| `listening` | 聆听 | 语音输入 | P0 |
| `speaking` | 说话 | TTS/回复中 | P1 |
| `confuse` | 困惑 | 参数不清/失败 | P0 |
| `excited` | 兴奋 | 好消息 | P1 |
| `gentle` | 温和 | 共情/安慰 | P1 |
| `tired` | 疲惫 | 深夜/长任务 | P2 |
| `anxious` | 紧张 | 高风险确认 | P2 |
| `angry` | 微怒/吐槽 | 可选彩蛋 | P2 |

### 5.4 尺寸与文件命名

| 尺寸 | 用途 | 命名 |
|---|---|---|
| 40–44px | 岛 hover 头像 | `xiyue_{mood}.png` 脸部特写 |
| 74–80px | Agent 条 / 大面板 | `xiyue_{mood}.png` 或 `_full` |
| 256px+ | 关于页/展示 | `xiyue_{mood}_full.png` |
| 应用图标 | 托盘 16 / 安装 256 | `resources/icon/xiyue_*.ico` |

正式路径约定：

```text
src/renderer/public/image/agent/
  xiyue_calm.png
  xiyue_happy.png
  xiyue_thinking.png
  xiyue_tool.png
  xiyue_listening.png
  xiyue_speaking.png
  xiyue_confuse.png
  …
  xiyue_happy_full.png   # 大尺寸
```

根目录 `F:/Work/Create/Assa/xiyue_*.png` 为**工作草稿**，验收后拷入上述路径；未入库不得在组件引用。

### 5.5 接线映射（目标）

`AgentPhase` / `AgentMood` → 资源：

| Phase | Mood | 资源 | 文案意图 |
|---|---|---|---|
| connecting | calm | `xiyue_calm.png` | 正在连接… |
| thinking | thinking | `xiyue_thinking.png` | 正在思考… |
| toolCalling | tool | `xiyue_tool.png` | 正在调用工具… |
| answering | speaking | `xiyue_speaking.png`（缺则共用 happy） | 正在回答… |
| done | happy | `xiyue_happy.png` | 已完成 / 回答完成 |
| error | confuse | `xiyue_confuse.png` | 出错了 |
| STT | listening | `xiyue_listening.png` | 我在听… |

Hover 与岛内 Agent **共用同一套路径表**（禁止再分叉成恐龙/少女两套）。  
**阶段文案必须走 i18n**（zh-CN / en-US 成对）。

### 5.6 动态「活人感」（CSS，P0）

- 呼吸 `scale(1~1.02)` 4s  
- mood 切换 300ms 淡入淡出  
- thinking 左右微晃；listening 放大+光晕  
- 与 4 色状态点同步（色用语义 token，见 §2.2）  
- P1：眨眼/口型需分层 PNG；P2：鼠标跟随/时间感知  

不做 Live2D（44px 看不清、性能与成本不划算）。

### 5.7 遗留恐龙处置

1. 代码：`PHASE_IMAGE` 全部改指 `xiyue_{mood}.png`。  
2. 资源：`AGENT_*.png` 移入 `public/image/legacy/eisland-dino/` 或删除（团队定）。  
3. 文档：所有「像素小恐龙」表述改为「汐月少女」。  
4. persona `agent/persona/xiyue.md` 同步删「无形象」过时描述。

---

## 6. Lucide 图标迁移分析

### 6.1 数据（2026-09-12）

| 项 | 数量 |
|---|---|
| tsx 中 `SvgIcon.*` 调用 | ~187 |
| 使用文件 | 56 |
| 唯一 key | 67 |
| `public/svg` 文件 | 108（枚举全量） |
| 其中彩色 | 19 |

### 6.2 结论（推荐）

| 项 | 建议 |
|---|---|
| **本季度整批替换** | **不推荐** |
| **增量策略** | **推荐**：新图标 Lucide 规范；破损/高频先迁；品牌独立 |
| 映射方式 | 保持 `SvgIcon` 枚举 API，底层换文件 → 调用点几乎不动 |
| 规范 | 24×24 / fill none / stroke currentColor / stroke-width 2 / round cap/join |
| 品牌 | `resources/svg/brand/` 或 `public/svg/brand/`，**永不进 mono filter/mask 若需要彩色** |

**原因**：67 个 key × 视觉回归成本高；与「换角色、修遮挡、统一 token」争资源。Mask 化 + no-filter 已解决「颜色被洗白」主诉，Lucide 是风格统一而非功能必需。

### 6.3 若你选择激进迁移

预估：映射表 67 项 + 截图 27 可选第二批 + 全 UI 目视回归；建议独立里程碑，不与角色替换同 PR。

---

## 6B. 设置信息架构（已定）

| 决策 | 说明 |
|---|---|
| **按钮三并二** | `hotkey-btn` 有 `.active` → `lyrics-source-btn`；其余 → `card-action-btn`；danger 修饰符归属统一 |
| **幽灵类** | 输入框用 `settings-field-input`；需要主操作则补一档 primary 样式（非空 class） |
| **隐私与安全分区** | 侧栏/快速导航聚类：隐藏窗口、URL 黑名单、邮箱授权码、翻译密钥等 |
| **大类按任务重划** | 外观 / 行为 / 通知与提醒 / 隐私与安全 / 数据与账户 / 高级（压每组子页数） |
| **浅色高风险** | chip、录制态、碟片、loading 等改 token；下拉抽公共类 |
| **大面板设置** | 点击打开独立设置窗 |

## 6C. 动画开关（已定）

- **不**以 Windows 系统「减少动画」为唯一依据。
- 以 App 设置 **「灵动岛弹性动画」** 为主开关（关=去弹跳、平滑过渡），并**扩大覆盖**到漏网大动画。
- 「动画速度」继续调快/慢。

## 6D. 其它已定 UI 点

| 板块 | 决策 |
|---|---|
| Hover | 自定义页空态 token + i18n；间距 4/8；分隔线 24；番茄精简；TimeTab→ControlCenterTab |
| 天气 | 去误导均温；样式归 CSS 模块；日夜图标跟数据 isDay；彩色 PNG 保留 |
| 大面板 | 碟片跟主题 token；翻译收口全局图标/文案规范；番茄与 hover 分工共用状态 |
| 截图/贴图/公告 UI | 去放大镜调试色；长截图按钮类名拆分；贴图默认等比 + i18n；公告交互色 token；强调蓝统一 accent |
| Lucide | **增量**（新图标 Lucide 规范；存量按破损/高频分批）；不整批替换 |

---

## 7. 开发检查清单（Code Review）

- [ ] 颜色走 token / `rgba(var(--*-rgb), α)`，无写死黑白与野色  
- [ ] 强调色仅用 accent（或 accent-rgb），无新蓝  
- [ ] 功能图标用 `.icon-mono`（mask）；品牌/插画用 `.icon-color`  
- [ ] **禁止**对多色资源使用 `brightness(0) invert`  
- [ ] 桌面浮层有 blur+saturate；岛壳无强制 blur  
- [ ] 角色图来自 `public/image/agent/xiyue_*`，无恐龙默认路径  
- [ ] 新 UI 文案有 `t()`，zh-CN / en-US 成对  
- [ ] 用户可见字符串无裸中文（含 agent phase）  
- [ ] hover/交互色用 `text-rgb`，浅色下可读  
- [ ] 改岛交互时确认 idle 不抢焦点（点击展开/热区）  
- [ ] 大动画尊重 App「弹性动画」开关（非仅系统 reduced-motion）  
- [ ] 数字场景 `tabular-nums`  
- [ ] Hover 不放长文滚动；Agent 完整回答只在大窗  

---

## 8. 文档地图（合并后）

| 文档 | 角色 |
|---|---|
| **`docs/design/DESIGN_SYSTEM.md`（本文件）** | **SSOT：原则、token、图标、岛交互、角色、Lucide** |
| `docs/design/CHARACTER_ASSET_CHECKLIST.md` | 汐月素材制作/验收清单 |
| `docs/design/DESIGN_STYLE_GUIDE.md` | 历史 token/尺寸/组件速查；**§2.6 玻璃、§4.2 恐龙、§9 总结已过时** |
| `docs/Xiyue_UI设计与图标形象整合报告_v1.0.md` | 讨论点与决策记录 |
| `src/renderer/AGENTS.md` | SVG 主题策略 → 改为指向 mask/`icon-mono`（待改） |

---

## 附录 A · 建议共享 hex（独立窗对齐用）

| 名 | 值 | 说明 |
|---|---|---|
| accent | `#409cff` | 与 oklch 蓝视觉对齐的工程 hex |
| accent-strong | `#2f7fe6` | hover/按下 |
| danger | `#e5484d` / `#ff3b30` | 按组件语境 |
| success | `#30a46c` / `#34c759` | 同上 |
| warn | `#ffc400` / `#ff9500` | 同上 |

新代码优先 token；capture/pin 可复制此表并注释「与 DESIGN_SYSTEM 同步」。

---

## 9. 决策定稿（2026-09-12）

全板块讨论结论如下；**实现按 §10 里程碑**，本表不再视为「待拍板」。

### 板块 1 全局

| # | 结论 |
|---|---|
| 1.1 | 汐月替换恐龙；P0 差分见 §5.3 / 素材清单 |
| 1.2 | 功能图标 mask；品牌/插画 `icon-color` 保色 |
| 1.3 | 颜色 token + 统一 accent |
| 1.4 | 岛 P0 点击展开 + enterDelay（**已实现**）；P1 热区、P2 露头条待做 |
| 1.5 | Lucide **增量** |
| 1.6 | 设置侧天气入口 **单色** |

### 板块 2 岛 + Hover

| # | 结论 |
|---|---|
| 2.1 | 番茄 **A 单模式**；hover 只留状态+开关；时长进设置 |
| 2.2 | TimeTab → **ControlCenterTab** |
| 2.3 | 自定义页 token + i18n |
| 2.4 | 图标风格统一 + 角色分档 + 光学微调 |
| 2.5 | 间距 4/8；分隔线 24 |
| 2.6 | 天气去均温、样式归位、日夜跟数据 |
| 2.7 | Agent 岛条 = 状态 + 一行摘要；长回答大窗；授权在岛 |
| 2.8 | mood 粒度 → 与 §5.5 表统一 |
| 2.9 | 动画以 App 弹性开关为主并扩大覆盖 |

### 板块 3 角色

| # | 结论 |
|---|---|
| 3.1 | 只保留少女；恐龙归档不进正式应用 |
| 3.2 | 过渡双轨：只认 xiyue 路径；缺图共用少女/状态点 |
| 3.3 | 阶段→表情→文案表（§5.5） |
| 3.4 | 应用/托盘图标 **做** |
| 3.5 | 阶段文案 i18n |

### 板块 4 设置

| # | 结论 |
|---|---|
| 4.1 | 按钮三并二 |
| 4.2 | 幽灵类补齐/改引用 |
| 4.3 | 隐私与安全分区 |
| 4.4 | 大类按任务重划 |
| 4.5 | 浅色高风险修复 + 公共下拉 |
| 4.6 | 大面板设置 → 独立设置窗 |

### 板块 5 大面板

| # | 结论 |
|---|---|
| 5.1 | 碟片跟主题 |
| 5.2 | 翻译收口规范 |
| 5.3 | 番茄 hover/总览分工，共用状态 |

### 板块 6 截图等 UI

| # | 结论 |
|---|---|
| 6.1 | 去放大镜调试色 |
| 6.2 | 长截图按钮类名拆分 |
| 6.3 | 贴图等比 + i18n |
| 6.4 | 公告浅色 token |
| 6.5 | 强调蓝统一 accent |
| 6.6 | 截图功能问题不在本系统范围 |

---

## 10. 实施里程碑（建议顺序）

> 依赖：M1 尽量不依赖美术；M3 依赖出图节奏。截图只动 UI。

### M0 · 已完成 / 已锁定基线

- 岛交互 P0：默认点击展开 + enterDelay  
- 本文档 + `CHARACTER_ASSET_CHECKLIST.md` 为 SSOT  

### M1 · 地基（无美术依赖，优先）

| 项 | 内容 |
|---|---|
| 颜色 | 语义 token；accent 收敛（公告/通知/截图蓝） |
| 图标 | 全局 `.icon-mono` / `.icon-color`；品牌去 filter；禁止新写 `brightness(0) invert` 默认路径 |
| Agent 岛条 | 一行摘要 + 截断；去掉 2 行滚动全文；关闭键可见度 |
| 动画 | 弹性开关覆盖补全 |
| 幽灵类 | 输入框/主按钮样式落地 |

**验收**：品牌 logo 保色；浅色下公告/自定义页可读；Agent 条不再试图滚全文。

### M2 · 岛与 Hover 体验

| 项 | 内容 |
|---|---|
| 控制中心 | TimeTab 重命名/迁移 ControlCenterTab（兼容旧 hoverTab 存储） |
| 番茄精简 | hover 只读大时间+控制；时长进设置 |
| Hover 收口 | 4/8 网格；分隔线 24；自定义页；天气信息与 isDay |
| 岛 P1 | idle 中心热区（可选本里程碑或 M2.5） |

**验收**：切 Tab 对齐稳定；番茄不表单化；控制中心职责清晰。

### M3 · 角色与品牌

| 项 | 内容 | 状态 |
|---|---|---|
| 素材 | P0 七态入库 `public/image/agent/` | **已完成** |
| 接线 | PHASE_IMAGE / AVATAR / 阶段文案 | **已完成** |
| 归档 | 恐龙移 legacy | **已完成** |
| 图标 | 托盘 16 + 应用 256 替换 | **待素材**（见 CHARACTER_ASSET_CHECKLIST §6B） |

**验收**：产品路径无恐龙；hover 与岛为同一少女；托盘为汐月。

### M4 · 设置 IA（可与 M2 并行，偏产品改版）

> **SSOT 增补：`docs/design/SETTINGS_UI_REDESIGN.md`**（2026-09-13 七类导航 + 主页搜索原型）

| 项 | 内容 |
|---|---|
| 大类重划 | **七类**（主页/外观/交互/AI与隐私/媒体/系统/账号）+ 主页搜索 |
| 隐私安全 | 独立一级「AI 与隐私」 |
| 导航 | 单栏钻取：类别 → 子项列表 → 详情 ← 返回 |
| 玻璃 | 侧栏/面板更强 blur+saturate；卡片副标题 α≥0.55 |
| 按钮并轨 | hotkey → 二套（下一轮） |
| 大面板设置 | 打开独立窗 |

**验收**：安全项一处可寻；无幽灵 class；浅色无明显翻车点；默认进主页搜索可用。

### M5 · 截图/贴图/公告 UI 修缮（小步）

调试色、长截图类名、贴图等比+i18n、公告 token。**不碰拼接算法。**

### M6 · 增量图标与清理（可穿插）

Lucide 新图标规范落地；死 CSS；文档再同步。

---

### 里程碑依赖简图

```text
M0 基线（已定）
 └─ M1 地基（token/图标/Agent条）
      ├─ M2 岛与Hover
      │    └─ M4 设置IA（可并行）
      ├─ M3 角色品牌（等图）
      └─ M5 截图UI / M6 图标增量
```

---

## 11. 下一阶段（2026-09-12 验收后）

| 优先级 | 事项 | 依赖 |
|---|---|---|
| 1 | **AI 侧半成品/未做完善** | 见 **`docs/AI_COMPLETION_PLAN.md`**（SSOT） |
| 2 | **番茄钟等 hover 视觉精修** | 无 |
| 3 | **品牌图标**（托盘/应用 ICO） | `CHARACTER_ASSET_CHECKLIST` §6B |
| 4 | 引导页全文化 | 无 |
| 5 | 设置 IA 大类重划 | 可与 1 部分并行 |

**已取消**：P2 屏顶露头条。  
**AI 完善顺序建议**：安全可感知（信任等级 UI+审计列表）→ 情绪/形象 → 记忆可见 → VAD/浏览器收口。

---

## 附录 B · 历史推荐与定稿关系

原 B1–B6 推荐均已由用户确认；**以 §9 定稿与 §10 里程碑为准**。
