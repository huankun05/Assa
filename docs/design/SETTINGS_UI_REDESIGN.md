# 设置 UI 重设计说明

> 状态：**原型实施中（2026-09-13）**  
> 上游：`docs/design/DESIGN_SYSTEM.md` §0/§2  
> 原则：功能全保留；先定壳与导航，再精修控件

## 1. 目标

- 一级 **7 类**，默认进 **主页（搜索 + 常用）**
- 单栏钻取：类别 → 子项列表 → 详情 ← 返回
- 更冷玻璃、更高对比度；功能页组件复用

## 2. 信息架构

| 一级 | 子项（映射到既有页面） |
|------|------------------------|
| 主页 | 全局搜索 + 分类入口 |
| 外观 | 主题 · 动画 · 位置 · 相册 · 布局预览 · 展开布局 · 全展开布局 · 控制中心 |
| 交互 | 交互行为 · 休息提醒 · 闹钟 · 快捷键 |
| AI 与隐私 | AI 信任与审计 · 隐藏窗口 · URL 黑名单 · 剪贴板历史 · 截图 |
| 媒体 | 歌曲设置 · 天气 |
| 系统 | 声音 · 通知 · 性能 · 性能监控 · 网络 · 实用工具 · 语言 |
| 账号与更新 | 邮箱 · 更新 · 壁纸市场 · 关于 |

## 3. 视觉（原型阶段）

- 侧栏：玻璃药丸 + accent；图标 mono invert
- 主面板：更强 blur + 边缘高光；卡片副标题 α ≥ 0.55
- 列表项：图标 18 + 标题 + 一行说明；hover accent 描边
- 控件三件套（Switch / Segment / Stepper）**下一轮**再全量替换

## 4. 实施边界

- ✅ 导航重组、主页搜索、玻璃感、对比度
- ✅ 旧设置页组件原样挂载
- ⏳ 控件统一、软删冗余 CSS、设置 IA 与导出兼容

## 5. 文件

| 文件 | 作用 |
|------|------|
| `setting/config/settingsCategories.ts` | 七类 + 子项映射 |
| `setting/components/home/SettingsHomeSection.tsx` | 主页 |
| `setting/components/home/SettingsCategoryHub.tsx` | 类别子项列表 |
| `SettingsTab.tsx` | 导航壳 |
| `styles/settings/modules/settings-layout.css` | 玻璃与列表样式 |
