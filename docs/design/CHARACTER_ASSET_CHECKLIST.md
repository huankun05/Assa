# 汐月角色素材清单（替换恐龙 · 制作与验收）

> 配套：`DESIGN_SYSTEM.md` §5 / §9 / §10（M3）  
> 状态：计划已定稿 2026-09-12 · 美术/生成/外包均适用  
> 原则：**透明底 PNG**；禁止文字水印；32px 下表情可辨；暖色系与冷玻璃对冲。  
> 过渡：差分未齐前代码只认少女路径，缺图共用已有少女图；**恐龙已归档，不进正式应用**。

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

| 文件名 | 表情/状态 | 用途 | 尺寸建议 | 现状 |
|---|---|---|---|---|
| `xiyue_calm.png` | 平静待机 | 连接中 / idle | 256 透明 | 缺 |
| `xiyue_happy.png` | 开心 | 完成 / 日常 | 256 透明 | **有**（`public/image/agent/`） |
| `xiyue_thinking.png` | 思考 | LLM 推理 | 256 透明 | 缺 |
| `xiyue_tool.png` | 专注操作 | 工具调用 | 256 透明 | 缺 |
| `xiyue_listening.png` | 聆听 | 语音输入 | 256 透明 | 缺 |
| `xiyue_confuse.png` | 困惑/出错 | error | 256 透明 | 缺 |
| `xiyue_speaking.png` | 说话中 | 回答流/TTS | 256 透明 | 缺（P1 可缓） |

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

## 6. 当前资产盘点（2026-09-12）

| 路径 | 内容 |
|---|---|
| `public/image/agent/xiyue_happy.png` | 女孩 happy（已接线） |
| `public/image/agent/xiyue_happy_full.png` | 完整版 |
| `public/image/AGENT_*.png` | **恐龙五态（待替换）** |
| `public/assets/avatar/T.jpg` | 旧占位，待清理 |
| 根目录 `xiyue_face_*` / `xiyue_island*` / `xiyue_happy_*` | 草稿，未进包 |

---

## 7. 里程碑建议

| 里程碑 | 内容 |
|---|---|
| M1 | P0 六态出图 + 接线替换恐龙（岛内+hover 一致） |
| M2 | 状态点/文案/语义色；`enterDelay` 与点击展开（可并行） |
| M3 | 应用/托盘图标替换 |
| M4 | P1/P2 差分 + CSS 微动完善 |
