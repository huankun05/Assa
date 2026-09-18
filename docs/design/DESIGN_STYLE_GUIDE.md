# Assa（eIsland）设计风格指南

> **⚠ 本文部分章节已过时。**  
> **UI 开发请优先阅读并遵循：[`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md)**（颜色 token、图标保色/遮罩、岛不抢焦点、汐月角色替换恐龙、Lucide 策略）。  
> 角色素材见：[`CHARACTER_ASSET_CHECKLIST.md`](./CHARACTER_ASSET_CHECKLIST.md)。  
> 本文件仍可作为**尺寸/圆角/动画曲线/组件 CSS 片段**的速查；但以下内容已废弃：  
> - 「像素小恐龙」作为产品形象（§1、§4.2、§9）→ 主形象为**汐月少女**  
> - 「浮层必须 backdrop-filter」一刀切（§2.6）→ **岛体有意不透明**；仅桌面浮层强制玻璃  
>
> 适用：灵动岛（Dynamic Island）、截图工具栏、贴图浮窗、启动屏、设置面板等所有 Assa 浮层 UI。
> 本文档基于 `src/renderer/styles/`、`resources/capture.css`、`resources/pin.css`、灵动岛状态组件（`src/renderer/components/states/agent`）综合提炼。

---

## 1. 设计基因（Design DNA）

Assa 是 **Apple Dynamic Island 复刻** 的 Windows 浮层工具，整体语言由三层叠加：

1. **Apple-inspired 极简骨架**
   - iOS Dynamic Island 的「细长胶囊 → 状态条 → 全屏面板」三段式形变
   - iOS 通知中心 / Live Activity 的玻璃拟态 + 信息密度
   - iOS 风格弹性动画（cubic-bezier 缓动 + 物理回弹）

2. **冷色玻璃面板**
   - 深色为主，主题蓝（iOS 蓝）强调
   - 玻璃拟态（backdrop-filter blur + saturate）
   - 文字按主题色自适应的 rgba(var(--color-text-rgb), α) 写法

3. **暖色汐月角色注入温度**
   - **主形象：二次元可爱少女（汐月）**，多 mood 差分；见 `CHARACTER_ASSET_CHECKLIST.md`
   - 像素恐龙（AGENT_*.png）为 eIsland 遗产，**非产品人格**，计划整体替换
   - 暖色打破冷色玻璃的科技感，让 AI 拟人、可亲

> **设计铁律：UI 冷、角色暖。冷暖对冲，永远不要让 UI 和角色都冷、都暖。**

---

## 2. 设计 Token（Design Tokens）

### 2.1 颜色

| Token | 值（dark） | 值（light） | 用途 |
|---|---|---|---|
| `--color-text-rgb` | `255, 255, 255` | `0, 0, 0` | 文字色（以 r,g,b 形式，便于 rgba(_, α) 复用） |
| `--color-island-bg` | `#000000` | `#f5f5f7` | 灵动岛背景 |
| `--color-island-text` | `#ffffff` | `#1d1d1f` | 灵动岛文字（与文字 r,g,b 解耦） |
| `--color-island-accent` | `oklch(0.7 0.15 250)` | 同 | 主题强调色（iOS 蓝） |
| `--color-accent-rgb`（备） | `59, 130, 246` | 同 | 主蓝 RGB（settings 等用） |
| `--color-shadow-rgb` | `0, 0, 0` | 同 | 阴影源色 |
| `--icon-invert` | `1` | `0` | SVG 图标反相 |

**截图工具栏颜色（capture.css `var(--cap-*)`，仅浮层内使用）**

| Token | 值 | 用途 |
|---|---|---|
| `--cap-accent` | `#409cff` | 主题蓝 |
| `--cap-accent-strong` | `#2f7fe6` | 主蓝 hover/按下 |
| `--cap-danger` | `#e5484d` | 危险/红色按钮 |
| `--cap-success` | `#30a46c` | 成功/允许 |
| `--cap-surface` | `rgba(20, 24, 32, .82)` | 毛玻璃面板 |
| `--cap-surface-solid` | `rgba(18, 22, 30, .92)` | 实心玻璃（二级菜单） |
| `--cap-border` | `rgba(255, 255, 255, .14)` | 标准边框 |
| `--cap-border-soft` | `rgba(255, 255, 255, .08)` | 弱边框 |
| `--cap-text` | `rgba(255, 255, 255, .95)` | 主文字 |
| `--cap-text-dim` | `rgba(255, 255, 255, .62)` | 暗文字 |

**语义色（出现于各组件的硬编码）**

| 场景 | 值 | 备注 |
|---|---|---|
| 录制中红点 | `#ff4d4f` | 带 `0 0 10px rgba(255, 77, 79, .8)` 发光 |
| 警告黄 | `#ffc400` / `#ffd76a` | 边框 `rgba(255, 196, 0, .35)`，底 `rgba(255, 196, 0, .12)` |
| 错误红 | `#ff5252` | P0 提醒、agent 错误态 |
| 允许绿 | `#4caf50` / `rgba(76, 175, 80, .12)` | agent 授权 |
| 拒绝红 | `#ef5350` | agent 不授权 |

**颜色书写铁律**

- **永远不要在灵动岛/通知内写死 `#ffffff` / `#000000`**，用 `rgba(var(--color-text-rgb), α)` 主题自适应
- 主题切换走 `[data-theme="light"]` 覆盖 `--color-text-rgb` 等变量
- 强调色用 `--color-island-accent`（oklch）或 RGB 三元组 var

---

### 2.2 字体

```
--island-ui-font: 'Microsoft YaHei', 'PingFang SC', -apple-system, sans-serif;
--island-lyrics-font: 同上;
```

| 场景 | size | weight | 行高 |
|---|---|---|---|
| 大数字（时间） | 14px (sm) | 500 medium | 1 |
| 主标题（agent text body） | 13px | 400 regular | 1.4 |
| 次级标签（phase label） | 11px | 500 medium | 1.4 |
| 通知正文 | 12px | 400 | 1.5 |
| 工具栏按钮 | 12px | 500 | 1.4 |
| 等宽数字 | tabular-nums + letter-spacing .02em | — | — |

**铁律**

- 中文优先 `Microsoft YaHei`，macOS 用户兜底 `PingFang SC`
- 数字/时间必须 `font-variant-numeric: tabular-nums`，避免抖动
- 不要用 emoji 做 UI 元素，只作为内容符号

---

### 2.3 圆角

| 场景 | 圆角 |
|---|---|
| 灵动岛 idle（顶部条） | `0 0 22px 22px`（仅下半圆角） |
| 灵动岛 pill | `21px`（52 高）、`30px`（hover 72）、`44px`（agent/notification 100）、`26px`（expanded/announcement） |
| 截图/翻译/二维码面板 | `var(--cap-radius-lg) = 14px` |
| 按钮/输入 | `var(--cap-radius-md) = 9px` |
| 小按钮/标签 | `6px ~ 7px` |
| 录制条/长截图条 | `999px`（胶囊） |
| 头像/图标块 | `50%` |

---

### 2.4 间距与尺寸

- **8 像素基准**：所有间距 / 内边距走 4 / 6 / 8 / 10 / 12 / 14 / 16 / 20
- 灵动岛 idle: `260 × 42`，hover: `500 × 60`，agent: `500 × 100`（默认）
- 灵动岛 pill 容器：`height: 52`，hover `72`，agent `100`，expanded `164`，maxExpand/announcement `416`
- agent 内容 padding: `3px 16px 8px`
- agent 图标: `74 × 74`，object-fit: contain
- 工具栏按钮高: `30px`，padding `0 10px`，圆角 `9px`
- 主面板 padding: `12px 14px` / `14px 14px`

---

### 2.5 阴影

| 用途 | 值 |
|---|---|
| 主面板浮起（截图/翻译/二维码） | `0 12px 40px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.35)` |
| 工具条/胶囊 | `0 4px 16px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.12)` |
| 贴图（pin）常驻 | `0 2px 8px rgba(0,0,0,.14), 0 8px 24px rgba(0,0,0,.22)` |
| 贴图悬停发光 | 加 `0 0 0 1.5px rgba(255,255,255,.85)` + 多层模糊晕 |
| 灵动岛浅色模式 | `0 2px 16px rgba(0,0,0,.12), 0 0 0 1px rgba(0,0,0,.06)` |
| 主题蓝按钮按下 | `0 2px 8px rgba(64, 156, 255, .35)` |
| 录制红点 | `0 0 10px rgba(255, 77, 79, .8)` |

---

### 2.6 玻璃（Backdrop Filter）

```
backdrop-filter: blur(<n>px) saturate(1.4);
-webkit-backdrop-filter: 同上;
```

| 层级 | blur | saturate |
|---|---|---|
| 主浮层面板（截图/翻译） | `24px` | `1.4` |
| 工具条 | `24px` | `1.4` |
| 取色器/二选一面板 | `24px` | `1.4` |
| 贴图工具条 | `16px` | `1.4` |
| 尺寸角标/底部提示 | `10px ~ 14px` | `1.2 ~ 1.3` |

**铁律（修订）**：  
- **桌面浮层**（截图/贴图/OCR/设置面板等）必须带 `backdrop-filter: blur + saturate(1.4)` 才是 Assa 风；裸 `background` 视为未完成。  
- **灵动岛壳**（idle/hover/agent）**有意不透明实底**，不强制 backdrop-filter（对齐 iOS，保可读性与性能）。详见 `DESIGN_SYSTEM.md` §4.1。

---

### 2.7 动画曲线

| 场景 | curve | duration |
|---|---|---|
| 默认入场/退场 | `cubic-bezier(0.22, 1, 0.36, 1)` | `.12s ~ .18s` |
| 状态切换形变（spring） | `cubic-bezier(0.25, 1.06, 0.45, 1)` | `.68s` |
| Agent 入场 | `cubic-bezier(0.22, 1, 0.36, 1)` | `.4s` |
| 弹性形变（idle → agent） | `cubic-bezier(0.25, 1.06, 0.45, 1)` | `.68s` |
| 收缩回弹 | `cubic-bezier(0.22, 1, 0.36, 1)` | `.68s` |
| 工具栏按下 | `transform: scale(.96)` | `.1s` |
| 按钮 hover 颜色 | `transition: background .12 ~ .15s ease` | — |
| 旋转（spinner） | `linear infinite` | `.8s` |

**关键动画帧**

```css
/* 入场：上浮 + 缩放 */
@keyframes cap-pop {
  from { opacity: 0; transform: translateY(8px) scale(.97); }
}

/* 向下入场 */
@keyframes cap-pop-down {
  from { opacity: 0; transform: translateY(-8px) scale(.97); }
}

/* 纯淡入 */
@keyframes cap-fade {
  from { opacity: 0; }
}

/* idle → agent 弹性（agent 专属，比通用通知更稳） */
@keyframes shellExpandToAgent {
  0%   { transform: scaleX(0.92) scaleY(1); }
  30%  { transform: scaleX(1.014) scaleY(0.986); }
  58%  { transform: scaleX(0.998) scaleY(1.002); }
  82%  { transform: scaleX(1.001) scaleY(0.999); }
  100% { transform: scale(1); }
}
```

---

## 3. 组件范式

### 3.1 灵动岛主壳（shell）

```css
.island-shell {
  position: relative;
  width: 260px;
  height: 42px;
  background: var(--color-island-bg);
  border-radius: 0 0 22px 22px;
  display: flex; align-items: center; justify-content: center;
  cursor: default;
  user-select: none;
  transition: width .4s, height .4s, border-radius .4s, background .4s, box-shadow .4s, opacity .8s;
  overflow: hidden;
  transform-origin: top center;
  will-change: width, height, border-radius, transform;
  backface-visibility: hidden;
  mask-image: radial-gradient(white, white); /* 防锯齿 */
}

.island-shell.shape-pill { height: 52px; border-radius: 21px; }
.island-shell.shape-pill.hover { height: 72px; border-radius: 30px; }
.island-shell.shape-pill.agent,
.island-shell.shape-pill.notification,
.island-shell.shape-pill.stt,
.island-shell.shape-pill.cli { height: 100px; border-radius: 44px; }
.island-shell.shape-pill.expanded { height: 164px; }
.island-shell.shape-pill.maxExpand,
.island-shell.shape-pill.announcement { height: 416px; }
```

### 3.2 Agent 状态条（当前任务核心）

```
┌──────────────────────────────────────────────┐
│  ┌──────┐   [phase label: 正在连接…]         │
│  │      │   ─────────────────────             │
│  │ 恐龙 │   [text body: 单/多行回答流]        │
│  │ 74×74│                                     │
│  └──────┘                          [关闭]     │
└──────────────────────────────────────────────┘
```

CSS（`agent.css`）：

```css
.agent-content {
  display: flex; align-items: flex-start; gap: 8px;
  width: 100%; height: 100%;
  padding: 3px 16px 8px;
  animation: agentEnter 0.4s cubic-bezier(0.22, 1, 0.36, 1) both;
}
.agent-icon { width: 74px; height: 74px; flex-shrink: 0; object-fit: contain; }
.agent-text-label { font-size: 11px; font-weight: 500; color: rgba(var(--color-text-rgb), 0.45); }
.agent-text-body { font-size: 13px; line-height: 1.4; color: rgba(var(--color-text-rgb), 0.9);
  max-height: calc(1.4em * 2); overflow-y: auto; white-space: pre-line; word-break: break-all; }
.agent-text-body.agent-text-thinking { color: rgba(var(--color-text-rgb), 0.35); font-style: italic; }
.agent-text-body.agent-text-error { color: #ff5252; }
.agent-actions { position: absolute; right: 16px; bottom: 8px; display: flex; gap: 4px; }
.agent-action-btn { background: none; border: none; font-size: 11px; font-weight: 500;
  color: rgba(var(--color-text-rgb), 0.35); padding: 2px 6px; border-radius: 4px;
  transition: color .2s, background .2s; }
.agent-action-btn:hover { color: rgba(var(--color-text-rgb), 0.7); background: rgba(var(--color-text-rgb), 0.08); }
.agent-action-allow { color: #4caf50; }
.agent-action-deny { color: #ef5350; }
```

### 3.3 工具栏（截图编辑器）

- 双行：编辑工具行 + 样式与操作行
- 主蓝渐变：`linear-gradient(135deg, var(--cap-accent), var(--cap-accent-strong))`
- 激活态：`background: 渐变 + box-shadow: 0 2px 10px rgba(64,156,255,.45), inset 0 0 0 1px rgba(255,255,255,.18)`
- 危险按钮：`background: rgba(229, 72, 77, .82)`
- 分隔线：`.sep { width: 1px; height: 18px; background: rgba(255,255,255,.18); }`

### 3.4 贴图浮窗（pin）

- 整窗可拖，hover 出工具条
- 整图 + 柔和常驻阴影 + 悬停加白色 1.5px 描边发光
- 工具条：右上角胶囊 `padding: 3px`，按钮 `26×26`，圆角 `7px`

### 3.5 启动屏 / 启动视频

- 背景 `#000000`，圆角 24px
- 视频居中 60% / 60%
- 设置按钮：胶囊玻璃（`backdrop-filter: blur(14px) saturate(140%)`，border-radius 999px）
- hover 设置图标 旋转 45°

---

## 4. 图标体系

### 4.1 工具栏图标（`resources/svg/`）

- 全部 **24×24 viewBox SVG**，单色 `#fff` / 单色黑（自动反相）
- 在按钮内通过 `filter: brightness(0) invert(1)` 适配主题
- 按钮尺寸：`14×14`，`object-fit: contain`

### 4.2 AI 角色图（`src/renderer/public/image/agent/assa_*.png`）

| 状态 | 文件 | 视觉 |
|---|---|---|
| connecting | `assa_calm.png` | 静立等待 |
| thinking | `assa_thinking.png` | 手托下巴 + 思考气泡 |
| toolCalling | `assa_tool.png` | 用笔电 |
| answering | `assa_speaking.png` | 举手 + 灯泡 |
| done | `assa_happy.png` | 开心 |
| error | `assa_confuse.png` | 挠头 + 乱线团 + 流汗 |

同一套图也用作灵动岛内的情绪头像，映射见 `assaMoodConfig.ts`（calm / happy / thinking / tool / listening / confuse / speaking；另有全身图 `assa_happy_full.png`）。状态→图片的兜底见 `agentContentConfig.ts`（`PHASE_IMAGE_FALLBACK = assa_happy.png`）。

> eIsland 时代的像素小恐龙图标（`AGENT_*.png`）已归档至 `src/renderer/public/image/legacy/eisland-dino/`，仅 `docs/design/archive/` 下的历史预览稿引用。

**绘制风格铁律**（适用于归档的像素小恐龙 `AGENT_*.png`）

- 8-bit pixel art：每个色块有明显「方块感」，不要抗锯齿柔化
- 主色：橙黄 `#F8B66E`（身体）+ 深橙 `#E89540`（描边/阴影）+ 黑眼 `#1a1a1a` + 粉腮 `#F8C8B0`
- 角色化、可亲（不要抽象几何、不要科幻发光球）
- 每次新状态都让恐龙做不同动作；不要只换表情

### 4.3 灵动岛导航点（`hover/nav-dots.css`）

- 5 个圆点，激活态直径 6px，半透明白；非激活态直径 5px，`rgba(255,255,255,.3)`

---

## 5. 状态（State）与形变

| 状态 | 高度 | 圆角 | 形变动画 |
|---|---|---|---|
| idle | 42 | `0 0 22px 22px` | — |
| hover | 60 | `0 0 22px 22px` | `shellExpandFromIdle` |
| pill (idle) | 52 | 21 | — |
| pill.hover | 72 | 30 | — |
| pill.notification / .agent / .stt / .cli | 100 | 44 | `shellExpandToNotification` / `shellExpandToAgent` |
| pill.lyrics / .agentVoiceInput | 52 | 21 | — |
| pill.lyricsTranslation | 72 | 30 | — |
| pill.expanded | 164 | 26 | — |
| pill.maxExpand / .guide / .announcement | 416 | 26 | — |

**形变铁律**：所有形变 0.68s，spring curve，绝不瞬间切换。`shape-pill.spring-animation` 自动获得形变。

---

## 6. 排版细节铁律

1. **玻璃面板**：永远 `backdrop-filter: blur(24px) saturate(1.4); -webkit-backdrop-filter: 同`
2. **边框**：永远先设边框位（`border: 1px solid var(--cap-border)`）再单独设背景透明，避免亮边穿透
3. **滚动条**：主题化细滚动条 `width: 4px / 8px`，thumb `rgba(255,255,255,.18)` → hover `.32`
4. **隐藏**：`[hidden] { display: none !important; }` 必须能压过 `display: inline-flex`，否则「显示原文」等按钮会常驻无效
5. **will-change**：尺寸每帧变化的元素**不要**加（暗条、手柄）；只在 shell 上加 transform/will-change
6. **蒙版过渡**：截图蒙版必须 `transition: none`，任何 transition 都会让用户感知到「进入截图」的一次变化
7. **字体度量同步**：文字工具的 textarea 必须与 canvas fillText 同字体度量（JS 同步）
8. **contain**：截图蒙版容器用 `contain: layout paint size`，把每帧重排限制在全屏盒内
9. **像素放大镜**：直角（不要 border-radius + overflow:hidden），暗蒙版不会从圆角透出
10. **图标反相**：`filter: brightness(0) invert(1)`，按钮 hover/active 颜色通过背景层体现，图标本身只承担轮廓

---

## 7. 模块布局参考

| 模块 | 入口文件 |
|---|---|
| 灵动岛主壳 | `src/renderer/styles/shell/shell.css` |
| 灵动岛 Agent | `src/renderer/styles/agent/agent.css` + `states/agent/components/AgentContentView.tsx` |
| 灵动岛 hover 扩展 | `src/renderer/styles/hover/*.css` |
| 灵动岛 notification | `src/renderer/styles/notification/*.css` |
| 灵动岛 STT / CLI | `src/renderer/styles/stt/`, `src/renderer/styles/cli/` |
| 灵动岛过程指示 | `src/renderer/components/components/DynamicIslandProcessIndicator/styles/` |
| 灵动岛 Todo / Thinking | `src/renderer/components/components/DynamicIslandAgentProcessComponents/todo/` |
| 截图编辑器 | `resources/capture.css` + `resources/capture.js` |
| 贴图浮窗 | `resources/pin.css` + `resources/pin.html` |
| 启动屏 | `src/renderer/styles/splash.css` |
| 设置面板 | `src/renderer/styles/settings/modules/*.css` |
| AI 全屏背景 | `src/renderer/DynamicIslandAibackground.html` |

---

## 8. 改动检查清单（Code Review）

每改一个 Assa UI 模块，自查：

- [ ] 颜色是否走 `rgba(var(--color-text-rgb), α)` 或设计 token，没硬编码 `#fff`/`#000`？
- [ ] 是否带 `backdrop-filter: blur(X) saturate(1.4)` 与 `-webkit-` 前缀？
- [ ] 圆角是否落在 token 表的档位（14 / 9 / 7 / 6 / 4 / 999px）？
- [ ] 动画是否走 `cubic-bezier(0.22, 1, 0.36, 1)` 或 spring curve？
- [ ] 字体是否设了 `font-variant-numeric: tabular-nums`（数字场景）？
- [ ] 浅色主题下可见性：是否在 `[data-theme="light"]` 增加了边框/阴影？
- [ ] 是否有「冷色玻璃面板 + 暖色角色」对冲？新元素不要全冷也不要全暖？
- [ ] `backdrop-filter` / `transform` / `contain: paint` 建 containing block 的元素是否避开了 fixed 子元素？
- [ ] 是否避开了 `box-shadow inset` 把贴图边缘像素盖住（用 1.5px outline + 外发光）？
- [ ] 是否保留了 prefers-reduced-motion 兜底？

---

## 9. 一句话风格总结

> **iOS Dynamic Island 的极简骨架 + 深色玻璃拟态 + 汐月少女角色的温度。冷面板、暖角色、弹性形变、细圆角；桌面浮层玻璃、岛体实底；功能图标单色可主题化，品牌与插画保原色。**  
> 完整规范见 `DESIGN_SYSTEM.md`。