# Xiyue（汐月）文档索引

> 最后整理：2026-09-10 | 整理范围：docs/ 全部文档
> 当前技术栈：**Electron + React + Python 侧车**（2026-08-30 从 Tauri2+Rust 战略转向，fork 自 eIsland）
> 2026-09-10 完成全项目全面调查 + 垃圾清理（释放 ~1.35 GB），新增 4 份调查报告，详见"调查报告"分类

---

## 一、文档分类总览

### 已实现（描述的功能已在当前代码中落地）

| 文档 | 大小 | 一句话要点 |
|---|---|---|
| [汐月Electron版现状.md](./汐月Electron版现状.md) | 14 KB | 当前架构事实基线（2026-08-31 起，更新至 09-02），取代 Tauri 时代设计文档 |
| [灵动岛分档改造计划书.md](./灵动岛分档改造计划书.md) | 39 KB | 灵动岛三档+独立窗改造，5 阶段全部 ✅ 完成 |

### 草案 / 进行中（规划方案，部分或尚未实现）

| 文档 | 大小 | 一句话要点 |
|---|---|---|
| [方案_存储与移植规划_v1.0.md](./方案_存储与移植规划_v1.0.md) | 11 KB | 数据目录统一收口 + desk-pet hermes_core 记忆/情绪/人格模块移植（"换脑"），v1.0 草案待评审 |
| [Xiyue_设计与改进建议_v1.0.md](./Xiyue_设计与改进建议_v1.0.md) | 约 12 KB | 技术债优先级 + 二次元形象 brief + UI 范式建议（许可卡片/状态反馈）+ 落地顺序，与全面调查报告互补 |
| [AI_COMPLETION_PLAN.md](./AI_COMPLETION_PLAN.md) | 约 8 KB | **AI/语音/权限 半成品与未做完善方案（2026-09-12）**：信任等级 UI、审计、情绪接线、记忆可见、VAD、浏览器收口里程碑 |

### 调查报告（2026-09-10 全面调查产出）

| 文档 | 大小 | 一句话要点 |
|---|---|---|
| [Xiyue_全面调查报告_v1.0.md](./Xiyue_全面调查报告_v1.0.md) | 33 KB | **全项目三层综合报告**（现状-目标-方法），含技术债务汇总与下一步建议，调查的首选入口 |
| [Xiyue_Electron_Source_Audit.md](./Xiyue_Electron_Source_Audit.md) | 53 KB | Electron 应用层源码调查（main/preload/renderer/plugins，~180 IPC channel、13 状态机、14 插件） |
| [Xiyue_Agent_Voice_Source_Audit.md](./Xiyue_Agent_Voice_Source_Audit.md) | 36 KB | Agent 侧车与语音链路源码调查（10 API 端点、5 高优先级技术债务、Ollama/STT/TTS 全链路） |
| [Xiyue_Cleanup_Report_2026-09-10.md](./Xiyue_Cleanup_Report_2026-09-10.md) | 21 KB | 项目垃圾清理清单（~1.36 GB 可释放，62 项逐项可追溯），**清理已于 2026-09-10 执行完成** |

### 参考 / 规范（持续性参考，不随版本过期）

| 文档 | 大小 | 一句话要点 |
|---|---|---|
| [FRONTEND_STANDARDS.md](./FRONTEND_STANDARDS.md) | 39 KB | HTML/CSS/JS/TS/React/Next.js 全栈前端编码规范（eIsland 原作者 JNTMTMTM 制定） |
| [COMMENT_STANDARDS.md](./COMMENT_STANDARDS.md) | 6.6 KB | JSDoc 注释规范 + GPL-3.0 版权声明模板 |
| [ICON_ENUM.md](./ICON_ENUM.md) | 15 KB | 天气图标枚举（UAPI + WMO 双标准，约 400+ 天气/预警代码） |
| [design/DESIGN_STYLE_GUIDE.md](./design/DESIGN_STYLE_GUIDE.md) | 16 KB | Xiyue UI 设计风格指南（颜色/字体/圆角/动画/组件范式 + Code Review 清单） |
| [LEGAL/PRIVACY_POLICY.md](./LEGAL/PRIVACY_POLICY.md) | 3 KB | 隐私政策（中英双语，2026-04-23） |
| [LEGAL/TERMS_OF_SERVICE.md](./LEGAL/TERMS_OF_SERVICE.md) | 2.6 KB | 服务条款（中英双语，2026-04-23） |
| [LEGAL/BILLING_REFUND_POLICY.md](./LEGAL/BILLING_REFUND_POLICY.md) | 2 KB | 计费与退款政策（中英双语，2026-04-23） |

### 历史记录（存档性质，反映特定时间点的状态）

| 文档 | 大小 | 一句话要点 |
|---|---|---|
| [CHANGE_LOG.md](./CHANGE_LOG.md) | 325 KB | 基于 git 提交自动生成的变更日志，覆盖 V26.4.x ~ V26.7.4（生成于 2026-08-29） |
| [长截图问题排查记录.md](./长截图问题排查记录.md) | 52 KB | 长截图功能 r19~r60 调试全记录（2026-09-07 ~ 09-10），含 15 个问题根因与修复 |
| [设计文档审查报告.md](./设计文档审查报告.md) | 14 KB | 第一轮审查（AI管家设计方案 v1.0），推动设计文档升级至 v1.1（2026-08-30） |
| [项目全面审查报告.md](./项目全面审查报告.md) | 10 KB | 第二轮全项目审查（代码/配置/环境/就绪度），推动设计文档升级至 v1.2（2026-08-30） |

### ⚠️ 已废弃（方案/功能已被放弃或替代，请勿作为实现依据）

| 文档 | 大小 | 废弃原因 |
|---|---|---|
| [AI管家设计方案.md](./AI管家设计方案.md) | 37 KB | **Tauri2+Rust 架构**，2026-08-30 战略转向 Electron 后整体失效；仅保留作历史决策记录 |
| [灵动岛改造方案.md](./灵动岛改造方案.md) | 9.5 KB | **Tauri 时代**早期灵动岛改造方案（引用 `@tauri-apps/api`、Rust `set_island_size`），已被《灵动岛分档改造计划书》取代 |

---

## 二、快速导航：想了解 X 看哪个文档

| 你想了解… | 首选文档 | 辅助参考 |
|---|---|---|
| **当前代码架构是什么样** | [汐月Electron版现状.md](./汐月Electron版现状.md) | [Xiyue_全面调查报告_v1.0.md](./Xiyue_全面调查报告_v1.0.md) |
| **项目整体现状/目标/方法** | [Xiyue_全面调查报告_v1.0.md](./Xiyue_全面调查报告_v1.0.md) | [Xiyue_Electron_Source_Audit.md](./Xiyue_Electron_Source_Audit.md) / [Xiyue_Agent_Voice_Source_Audit.md](./Xiyue_Agent_Voice_Source_Audit.md) |
| **灵动岛各档位装什么、怎么交互** | [灵动岛分档改造计划书.md](./灵动岛分档改造计划书.md) | [design/DESIGN_STYLE_GUIDE.md](./design/DESIGN_STYLE_GUIDE.md) |
| **UI 设计规范（颜色/圆角/动画）** | [design/DESIGN_STYLE_GUIDE.md](./design/DESIGN_STYLE_GUIDE.md) | [FRONTEND_STANDARDS.md](./FRONTEND_STANDARDS.md) |
| **技术债优先级 / 形象 brief / UI 范式建议** | [Xiyue_设计与改进建议_v1.0.md](./Xiyue_设计与改进建议_v1.0.md) | [Xiyue_全面调查报告_v1.0.md](./Xiyue_全面调查报告_v1.0.md) |
| **前端代码怎么写** | [FRONTEND_STANDARDS.md](./FRONTEND_STANDARDS.md) | [COMMENT_STANDARDS.md](./COMMENT_STANDARDS.md) |
| **数据存在哪、怎么清理** | [方案_存储与移植规划_v1.0.md](./方案_存储与移植规划_v1.0.md) | [Xiyue_Cleanup_Report_2026-09-10.md](./Xiyue_Cleanup_Report_2026-09-10.md)（已执行） |
| **Agent 侧车"换脑"（hermes_core 移植）** | [方案_存储与移植规划_v1.0.md](./方案_存储与移植规划_v1.0.md) | [Xiyue_Agent_Voice_Source_Audit.md](./Xiyue_Agent_Voice_Source_Audit.md) |
| **Agent 侧车与语音链路实现细节** | [Xiyue_Agent_Voice_Source_Audit.md](./Xiyue_Agent_Voice_Source_Audit.md) | — |
| **Electron 主进程/渲染层/插件实现细节** | [Xiyue_Electron_Source_Audit.md](./Xiyue_Electron_Source_Audit.md) | — |
| **长截图功能原理与已知问题** | [长截图问题排查记录.md](./长截图问题排查记录.md) | — |
| **版本更新了什么** | [announcement/](./announcement/)（V26.6.5 起中英双语） | [CHANGE_LOG.md](./CHANGE_LOG.md)（git 提交级） |
| **项目最初的设计意图** | [AI管家设计方案.md](./AI管家设计方案.md) ⚠️ | 仅作历史参考，架构已变 |
| **法律条款** | [LEGAL/](./LEGAL/) | — |

---

## 三、已废弃文档警示

> 以下文档包含 **Tauri/Rust 时代的过时表述**，与当前 Electron 代码不符。阅读时请注意区分"设计意图"（仍有参考价值）与"技术实现"（已失效）。

### AI管家设计方案.md（v1.2）
- **过时点**：全文基于 Tauri2（Rust 后端 + React 前端）+ Python sidecar 架构；引用 `src-tauri/`、`cargo tauri`、`tauri.conf.json`、Rust 命令沙箱、Rust 终审闸门等。
- **仍有价值**：产品定位（本地常驻 AI 管家）、权限模型（四级信任 L0–L3）、双闸门安全理念、交互闭环设计、分期路线思路。
- **当前对应**：架构已迁移至 Electron（fork eIsland），主进程 TypeScript 承担原 Rust 职责；详见 [汐月Electron版现状.md](./汐月Electron版现状.md)。

### 灵动岛改造方案.md
- **过时点**：引用 `@tauri-apps/api/window` 的 `setIgnoreCursorEvents`、Rust `set_island_size` 命令、"汐月（Tauri+React）"表述。
- **仍有价值**：Apple HIG 四技法调研（弹簧形变/鼠标穿透/状态配置表/悬停预览）、eIsland 数值参考。
- **当前对应**：已被《灵动岛分档改造计划书》全面取代，后者基于 Electron 实现且 5 阶段全部完成。

---

## 四、子目录说明

### announcement/ — 版本公告
- **覆盖范围**：V26.4.4 ~ V26.7.5（约 40 个文件）
- **格式**：V26.6.5 之前为根目录单文件中文公告；V26.6.5 起按版本建子目录，含 `CH_*.md` / `EN_*.md` 中英双语
- **主要变更主题**：
  - **V26.4.x**：基础功能迭代（灵动岛、系统状态、音乐控制）
  - **V26.5.x**：CLI 控制台、活动热力图、外部代理检测、翻译工具
  - **V26.6.x**：CLI 实时控制台、URL 收藏夹管理、问卷系统、壁纸市场
  - **V26.7.x**：网易云音乐登录/喜欢同步、歌词精确匹配、问卷奖励、汐月 AI 集成深化
- **注意**：公告为 eIsland 上游 + Xiyue fork 混合历史，V26.7.x 后期公告仓库链接已指向 `huankun05/Assa`（Xiyue fork）

### design/ — 设计原型与风格指南
- **DESIGN_STYLE_GUIDE.md**：当前有效的 UI 设计规范（必读）
- **dynamic-island-ai-redesign.png/svg**：AI 灵动岛重设计稿（矢量+位图）
- **xiyue-tab-preview.html / .png**（v1~v6）：汐月 AI Tab 的 UI 预览原型迭代，v6 为最终 4 方案对比
- **xiyue-tab-verify.html / .png**：用项目真实 CSS 验证 Tab 渲染效果
- **xiyue-dot-verify.html / .png**：状态点（4 种状态）渲染验证
- **用途**：均为开发期设计验证原型，HTML 引用项目真实样式文件，可直接在浏览器打开对照

### LEGAL/ — 法律文档
- 三份文档均为中英双语，最后更新 2026-04-23
- 联系邮箱为 `*@mail.shicthrs.com`（eIsland 上游），Xiyue fork 后如需正式发布应评估是否更新
- 内容覆盖：隐私政策、服务条款、计费与退款政策

---

## 五、文档维护说明

### 新增文档规范
1. 文件名使用中文或英文均可，但应**自解释**（如 `长截图问题排查记录.md`）
2. 文档开头应包含：**状态**（草案/已实现/已废弃）、**最后更新日期**、**适用范围**
3. 规划类文档应在标题或开头标注版本号（如 `_v1.0`）
4. 涉及架构的文档必须明确标注技术栈（Electron / Tauri），避免混淆

### 废弃文档处理
- 不删除，保留作历史决策记录
- 在文档开头添加 `> ⚠️ 已废弃：本方案基于 Tauri 架构，当前已迁移至 Electron，详见《汐月Electron版现状.md》`
- 在本索引的"已废弃"区域登记

### 定期维护
- 每次大版本发布后更新 `announcement/`
- `CHANGE_LOG.md` 由脚本自动生成，无需手动维护
- 本 README 索引应在新增/删除/废弃文档时同步更新
- `汐月Electron版现状.md` 应作为架构事实基线持续更新

### 编码注意
- `CHANGE_LOG.md` 含 GBK 编码的提交信息（中文作者名），用 UTF-8 读取时部分中文会乱码，属正常现象
- 所有 Markdown 文档统一使用 UTF-8 编码
