# UI 设计系统执行问题记录

> 生成：2026-09-12 自动执行 M1–M6 · 供人工复查

## 已完成（本轮）

- M1：语义 token / icon-mono / icon-color；Agent 一行摘要；关闭键可见度；幽灵类样式；自定义页 i18n
- M2：Pomodoro 精简 UI + CSS；TimeTab 重命名延后记录见下
- M3：过渡接线（少女路径）+ 恐龙归档记录；差分图未齐
- M5：放大镜调试色移除；长截图 control 条类名限定；贴图 contain；公告 token 化；accent 对齐

## 待人工确认 / 跳过

| 项 | 原因 |
|---|---|
| TimeTab 文件/组件重命名 ControlCenterTab | 存储 `hoverTab === 'time'` 与多处引用面大；本轮保留 `TimeTab` 名，文档已定义职责。建议独立 PR 做机械重命名+兼容 |
| 岛 idle 中心热区（P1）/ 露头条（P2） | 需主进程 hit-test 与几何联调，风险高；本轮未做 |
| 设置大类重划 + 隐私安全分区 | 产品 IA 大改，需设置导航/搜索/i18n 全量回归；建议独立里程碑 |
| settings-hotkey-btn 全量并轨 | 使用面 20+ 文件，需分批；本轮只补幽灵类，未删 hotkey-btn |
| Lucide 整批替换 | 按决策为增量；本轮未换存量文件 |
| 少女差分图 7 态 | 素材未齐；缺图 mood 应回落 happy（代码侧 PHASE_IMAGE 待 M3 完整表） |
| 托盘/应用 ico 设计 | 无视觉源文件；未改 electron-builder/tray 引用 |
| prefers-reduced-motion | 按决策改走 App 弹性开关；本轮未扩覆盖 |
| 番茄时长设置页 | hover 已固定 25/5；设置项未新建（避免未注册 SEARCHABLE_SETTINGS） |
| 恐龙文件物理移动 | 仅改配置意图；`AGENT_*.png` 仍在 public/image，待素材表落地后移 legacy |

## 风险备注

- 公告 CSS 大范围 `rgba(255,255,255` → `text-rgb` 可能影响个别白字装饰，需目视浅色/深色
- Agent 正文改单行截断后，授权卡仍两行 clamp；与「一行摘要」策略一致
- `settings-card-action-btn-primary` 为新类，仅音乐登录处使用
