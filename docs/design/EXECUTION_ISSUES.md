# UI 设计系统执行问题记录

> 生成：2026-09-12 自动执行 M1–M6 · 供人工复查  
> **用户验收（2026-09-12）**：当前岛交互/让路/头像「没什么问题」；**P2 露头条取消**；番茄钟等 UI 待精修；品牌图标待出图（见 CHARACTER_ASSET_CHECKLIST §6B）。

## 已完成（本轮）

- M1：语义 token / icon-mono / icon-color；Agent 一行摘要；关闭键可见度；幽灵类样式；自定义页 i18n
- M2：Pomodoro 精简 UI + CSS；TimeTab 重命名延后记录见下
- M3：过渡接线（少女路径）+ 恐龙归档记录；差分图未齐
- M5：放大镜调试色移除；长截图 control 条类名限定；贴图 contain；公告 token 化；accent 对齐

## 遮挡方案（2026-09-12 定稿并实现）

- 默认恢复**悬停展开**（idle-click-expand 默认 false）
- **右键让路约 3 秒**（`window:temp-hide`）；计时内抑制悬停回弹，结束后需先移出再展开
- 引导交互卡 + 行为设置文案说明；长期隐藏仍用现有隐藏功能

## 下一阶段（2026-09-12 验收后）

1. **AI 半成品/未做完善** → 全文见 `docs/AI_COMPLETION_PLAN.md`  
   - P0：信任等级设置 UI、工具审计只读  
   - P1：情绪→TTS/头像、记忆只读页、Silero 可选、浏览器工具收口  
   - P2+：唤醒词、barge-in、CosyVoice、云端、记忆 LLM  
2. 番茄钟等 hover 视觉精修  
3. 品牌图标（CHARACTER_ASSET_CHECKLIST §6B）  
4. 引导页汐月化  
5. 设置 IA 重划  
6. **不做**：P2 露头条  

## 后续计划（引导页）

- [ ] 欢迎页已改为「汐月」；logo 仍 eisland.svg，待品牌图标替换
- [ ] 各交互/音乐/工具/设置页文案从 eIsland 语境全面改成汐月（P1）
- [ ] 增加：右键让路演示动效、空闲点击展开说明、深浅色示意（P1）

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

## 续跑（0b3ec80）

- ControlCenterTab 导出；恐龙归档；hotkey CSS 并轨；番茄时长设置；隐私导航文案；浅色 token；天气最高/最低

## 托盘重启 · soft-restart（2026-09-13 已验收）

| 项 | 结论 |
|---|---|
| 方案 | dev：写 `data/soft-restart.flag` + `app.exit`；electron-vite close 读 flag 原地再拉 electron（不整段重开 CLI） |
| 根因修复 | ① CLI `root===undefined` 时旧补丁 `realpathSync(root)` 抛错吞掉 → 改 `root \|\| process.cwd()` 多路径找 flag（`420110d`）② `app.exit` 在本机不生效 → `process.exit` + VBS 隐藏 `taskkill` 兜底（`c80ce08`）③ 外部强杀勿用 `cmd ping`（Windows Terminal 闪窗）→ VBS Run style 0（`9eef07b`） |
| 提示 | 恢复右下角系统通知；标题写死「汐月正在重新启动」；`app.setName('汐月')` |
| 补丁 | `scripts/patch-electron-vite-hide-console.js`（postinstall 幂等）；chunk 名 `lib-q6ns0vZr.js` 随 electron-vite 升级可能变 |
| 验收 | 见 `docs/ACCEPTANCE_CHECKLIST.md` §I |
| 系统通知品牌 | Windows toast 头跟 **AUMID + 安装快捷方式** 走，不跟 title。dev=`Electron` 难改；打包用 `appId=com.xiyue.app` + `productName=汐月` + `win.icon=xiyue_256x256.ico`，与主进程 `setAppUserModelId('com.xiyue.app')` 对齐后应显示汐月图标/名称 |

## 后续计划 · 角色详情面板（2026-09-13）

| 项 | 内容 |
|---|---|
| 现状 | 仅 hover 汐月页：七态头像 + 状态点 + 时段问候；**无**独立角色/情绪展板 |
| 用户预期 | 点头像进入「角色展示」：情绪说明、七态预览、人格/能力介绍；**不要**再进聊天（与 💬 重复） |
| 方案草案 | 独立 StandaloneTab 或 maxExpand 子页 `character`：当前 mood 高亮、七态图廊、情绪→行为说明；入口=点头像 / 名字区 |
| 优先级 | P1（体验完整度）；缺品牌设定文案时可先做结构+现有 mood 文案 |
| 不做混用 | 聊天仍走 💬 / 语音麦克风；角色面板不承载输入框 |

## 后续计划 · 壁纸（2026-09-13）

| 项 | 内容 |
|---|---|
| 内置壁纸 | UI **已下架**（代码保留 `BUILTIN_WALLPAPERS`）；素材就绪后再上架 |
| 分状态预览 | 按 hover / expand / maxExpand 等岛尺寸展示裁剪与效果（待做） |
| 右键让路设置 | ✅ 已加到「交互行为」：开关默认开 + 隐藏秒数 |
