# 汐月角色与品牌素材清单

> 最后更新：2026-09-12
> 状态：P0 七态头像 ✅ 已完成 | 品牌图标 ✅ 已完成 | P1 待启动

---

## 一、P0：七态差分头像（已完成 ✅）

### 1.1 已交付素材

| 状态 | 文件名 | 尺寸 | 路径 | 状态 |
|------|--------|------|------|------|
| 平静 calm | `assa_calm.png` | 512×512 透明 PNG | `src/renderer/public/image/agent/` | ✅ |
| 开心 happy | `assa_happy.png` | 512×512 透明 PNG | `src/renderer/public/image/agent/` | ✅ |
| 思考 thinking | `assa_thinking.png` | 512×512 透明 PNG | `src/renderer/public/image/agent/` | ✅ |
| 操作 tool | `assa_tool.png` | 512×512 透明 PNG | `src/renderer/public/image/agent/` | ✅ |
| 聆听 listening | `assa_listening.png` | 512×512 透明 PNG | `src/renderer/public/image/agent/` | ✅ |
| 困惑 confuse | `assa_confuse.png` | 512×512 透明 PNG | `src/renderer/public/image/agent/` | ✅ |
| 说话 speaking | `assa_speaking.png` | 512×512 透明 PNG | `src/renderer/public/image/agent/` | ✅ |

### 1.2 形象规范（每次生成必须遵守）

- **角色**：汐月，二次元可爱少女
- **发型**：暖金色渐变湖蓝色长发（冷暖对比，过渡自然）
- **眼睛**：湖蓝色大眼，淡妆（不可浓妆）
- **发饰**：月牙发夹（左侧）
- **服装**：白色卫衣，**统一露左肩**（单肩，不可双肩或不露肩）
- **头部**：微微倾斜，头身比例固定（不可变化）
- **光影**：柔和光感，对比度适中（不可过强）
- **背景**：透明（PNG alpha）
- **风格**：二次元扁平插画，矢量感

### 1.3 表情差异化规范

| 状态 | 眉眼 | 嘴巴 | 其他 |
|------|------|------|------|
| calm | 平视，眼睑自然放松 | 轻轻闭合的一字嘴（无笑意） | 头部微正 |
| happy | 弯弯笑眼 | 张嘴笑（露齿或心形嘴） | 头部微倾 |
| thinking | 视线向上偏移 | 微张的小圆嘴 | 手可托腮（如有） |
| tool | 专注注视 | 轻抿嘴 | 眼神坚定 |
| listening | 微微侧头，耳朵"竖起"感 | 轻闭的 o 型小嘴 | 头部倾斜角度最大 |
| confuse | 眉头微蹙，视线偏斜 | 波浪嘴或小三角嘴 | 歪头 |
| speaking | 张嘴说话形态（口型可变） | 张开的椭圆嘴 | 可加音符/声波装饰 |

---

## 二、P0：品牌应用图标（已完成 ✅）

### 2.1 已交付素材

| 用途 | 文件名 | 格式 | 路径 | 状态 |
|------|--------|------|------|------|
| 源图（512px） | `assa_512.png` | PNG | `resources/icon/` | ✅ |
| 应用图标（多尺寸） | `assa_256x256.ico` | ICO（16/32/48/64/128/256） | `resources/icon/` | ✅ |
| 托盘图标 | `assa_16x16.ico` | ICO（16/32） | `resources/icon/` | ✅ |

### 2.2 图标设计规范

- **风格**：月夜海滩扁平插画
- **元素**：左上角金色弯月（带光晕）+ 右上角星星 + 紫色云层 + 深蓝海面 + 金色月光倒影 + 米色沙滩 + 白色浪花
- **形状**：圆角方形（iOS 风格）
- **配色**：深蓝紫夜空 + 金色月亮 + 湖蓝海面 + 米色沙滩
- **与角色关联**：月牙发夹 ↔ 弯月图标；湖蓝发色 ↔ 海面颜色

### 2.3 代码接线（已完成 ✅）

| 文件 | 修改内容 | 状态 |
|------|----------|------|
| `electron-builder.json` | `win.icon` → `assa_256x256.ico` | ✅ |
| `src/main/tray.ts` | `TRAY_ICON_PATH` → `assa_16x16.ico` | ✅ |
| `src/main/window/mainWindow.ts` | `icon` → `assa_256x256.ico` | ✅ |
| `src/main/window/settingsWindow.ts` | `icon` → `assa_256x256.ico` | ✅ |
| `src/main/window/standaloneWindow.ts` | `icon` → `assa_256x256.ico` | ✅ |
| `src/main/window/splashWindow.ts` | `icon` → `assa_256x256.ico` | ✅ |
| `src/main/window/guideWindow.ts` | `icon` → `assa_256x256.ico` | ✅ |

---

## 三、P0：CSS 微动系统（已完成 ✅）

### 3.1 已实现

- **基础呼吸感**：所有状态通用的轻微上下浮动
- **7 种状态独特微动**：calm/happy/thinking/tool/listening/confuse/speaking 各有专属动画
- **7 色状态点**：头像右下角小圆点，不同状态不同颜色
- **switching 过渡**：状态切换时的淡入淡出
- **prefers-reduced-motion**：尊重系统减少动画设置

### 3.2 文件位置

- 配置：`src/renderer/components/states/hover/pages/assa/config/assaMoodConfig.ts`
- 组件：`src/renderer/components/states/hover/pages/assa/components/AssaAvatar.tsx`
- 样式：`src/renderer/styles/hover/assa-tab.css`

---

## 四、P1：待启动

### 4.1 Live2D / 动态形象（调研中）

- 方案：CSS 微动 P0 已落地，Live2D 作为 P1 增强
- 参考：桌宠类应用动态切换方案
- 状态：方案已写入设计文档，待评估开发成本

### 4.2 更多表情差分

- 害羞 shy、生气 angry、困倦 sleepy、惊讶 surprised 等
- 状态：待 P0 稳定后扩展

### 4.3 全身立绘

- 用于大面板/设置页/关于页
- 状态：待设计

---

## 五、旧素材处理

| 文件 | 处理方式 | 状态 |
|------|----------|------|
| `assets/avatar/T.jpg`（139.6KB） | 临时占位，确认后可删 | ⏳ 待确认 |
| `resources/icon/eisland.svg` | eIsland 原 SVG，保留备份 | 保留 |
| `resources/icon/eisland_16x16.ico` | eIsland 原托盘图标，保留备份 | 保留 |
| `resources/icon/eisland_256x256.ico` | eIsland 原应用图标，保留备份 | 保留 |
| `resources/icon/assa.svg` | 早期手画 SVG v1，未采用 | 保留 |
| `resources/icon/assa_icon_v2.svg` | 手画 SVG v2，未采用 | 保留 |
| `resources/icon/assa_icon_v3.svg` | 手画 SVG v3，未采用 | 保留 |
| `resources/icon/assa_icon_final.svg` | 手画简约 SVG，未采用 | 保留 |

---

## 六、Git 提交记录

| Commit | 内容 |
|--------|------|
| `122d4c5` | feat: 汐月二次元差分头像 + CSS微动系统 |
| `待提交` | feat: 汐月品牌应用图标（月夜海滩）接入全窗口 |
