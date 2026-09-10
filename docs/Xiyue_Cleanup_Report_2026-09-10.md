# Xiyue（汐月）项目垃圾扫描与清理清单

> **扫描日期**：2026-09-10  
> **扫描模式**：只读扫描，未执行任何删除操作  
> **扫描范围**：Xiyue 项目根、OCR 服务目录、APPDATA 用户数据、.workbuddy（仅记录）

---

## 一、汇总总览

| 扫描区域 | 垃圾/可清理大小 | 文件数 | 清理优先级 |
|---|---|---|---|
| Xiyue 插件编译产物 (bin/obj/build) | **627.46 MB** | 905 | 🔴 高 |
| APPDATA Cache + Code Cache | **427.20 MB** | 7,512 | 🔴 高 |
| Xiyue data_backup（重复模型） | **141.03 MB** | 4 | 🟡 中（需确认） |
| Xiyue out/（Electron 构建产物） | **78.94 MB** | 418 | 🔴 高 |
| OCR screenshot/frames（调试帧） | **56.18 MB** | 18 | 🔴 高 |
| OCR 下划线调试文件 (_ls_*, _r* 等) | **43.35 MB** | 128 | 🔴 高 |
| Xiyue 根目录 misplaced traineddata | **7.67 MB** | 2 | 🟡 中（应迁移） |
| APPDATA logs（旧日志） | **~5.11 MB** | 254 | 🟢 低 |
| Xiyue tsbuildinfo 增量缓存 | **1.23 MB** | 2 | 🟢 低 |
| OCR 非下划线垃圾 + __pycache__ | **~0.18 MB** | 10 | 🟢 低 |
| Xiyue 项目 __pycache__ (agent/voice) | **0.07 MB** | 11 | 🟢 低 |
| 空目录 | — | 5 | 🟢 低 |
| **可释放空间总计（估算）** | **~1,388 MB ≈ 1.36 GB** | — | — |

> **.workbuddy**：473.66 KB / 14 文件 — **标记为不可清理**（工作记忆体系）

---

## 二、Xiyue 项目根目录 (F:\Work\Create\Assa\Xiyue\)

### 2.1 插件编译产物（bin / obj / build/Release）

> C# / C++ 编译产物，有源码可安全重建，**最大单项垃圾来源**。

| 序号 | 路径 | 类型 | 大小 | 文件数 | 理由 | 建议动作 |
|---|---|---|---|---|---|---|
| 1 | plugins\eisland-windows-brightness-helper\src\bin | 编译产物 | 77.30 MB | 194 | C# 编译输出，可重建 | 删除 |
| 2 | plugins\eisland-windows-volume-analyzer\src\bin | 编译产物 | 76.90 MB | 192 | 同上 | 删除 |
| 3 | plugins\eisland-windows-volume-helper\src\bin | 编译产物 | 76.82 MB | 192 | 同上 | 删除 |
| 4 | plugins\eisland-windows-smtc-helper\src\bin | 编译产物 | 57.64 MB | 9 | 同上 | 删除 |
| 5 | plugins\eisland-windows-bluetooth-helper\src\bin | 编译产物 | 57.40 MB | 9 | 同上 | 删除 |
| 6 | plugins\eisland-windows-wifi-helper\src\bin | 编译产物 | 44.41 MB | 9 | 同上 | 删除 |
| 7 | plugins\eisland-windows-power-helper\src\bin | 编译产物 | 43.87 MB | 9 | 同上 | 删除 |
| 8 | plugins\eisland-windows-application-icon-helper\src\bin | 编译产物 | 27.87 MB | 9 | 同上 | 删除 |
| 9 | plugins\eisland-windows-screenshot-helper\src\bin | 编译产物 | 25.77 MB | 9 | 同上 | 删除 |
| 10 | plugins\eisland-windows-smtc-helper\src\obj | 编译产物 | 26.50 MB | 23 | 中间对象文件 | 删除 |
| 11 | plugins\eisland-windows-bluetooth-helper\src\obj | 编译产物 | 26.26 MB | 23 | 同上 | 删除 |
| 12 | plugins\eisland-windows-wifi-helper\src\obj | 编译产物 | 19.19 MB | 23 | 同上 | 删除 |
| 13 | plugins\eisland-windows-power-helper\src\obj | 编译产物 | 18.90 MB | 23 | 同上 | 删除 |
| 14 | plugins\eisland-windows-toast-listener\build\Release | 编译产物 | 16.58 MB | 18 | C++ Node 原生模块构建 | 删除 |
| 15 | plugins\eisland-windows-application-icon-helper\src\obj | 编译产物 | 10.22 MB | 24 | 同上 | 删除 |
| 16 | plugins\eisland-windows-screenshot-helper\src\obj | 编译产物 | 9.11 MB | 24 | 同上 | 删除 |
| 17 | plugins\eisland-windows-processes-attacker\build\Release | 编译产物 | 3.98 MB | 20 | 同上 | 删除 |
| 18 | plugins\eisland-windows-fullscreen-detector\build\Release | 编译产物 | 3.94 MB | 17 | 同上 | 删除 |
| 19 | plugins\eisland-windows-performance-monitor\build\Release | 编译产物 | 3.77 MB | 17 | 同上 | 删除 |
| 20 | plugins\eisland-windows-brightness-helper\src\obj | 编译产物 | 0.33 MB | 21 | 同上 | 删除 |
| 21 | plugins\eisland-windows-volume-helper\src\obj | 编译产物 | 0.32 MB | 20 | 同上 | 删除 |
| 22 | plugins\eisland-windows-volume-analyzer\src\obj | 编译产物 | 0.41 MB | 20 | 同上 | 删除 |
| | **小计** | | **627.46 MB** | **905** | | |

### 2.2 out/ — Electron 构建输出

| 序号 | 路径 | 类型 | 大小 | 文件数 | 理由 | 建议动作 |
|---|---|---|---|---|---|---|
| 23 | out\renderer\ | 编译产物 | 76.21 MB | — | Vite 构建输出，`npm run build` 可重建 | 删除 |
| 24 | out\main\ | 编译产物 | 2.55 MB | — | 主进程编译输出 | 删除 |
| 25 | out\preload\ | 编译产物 | 0.18 MB | — | 预加载脚本编译输出 | 删除 |
| | **小计** | | **78.94 MB** | **418** | | |

### 2.3 tsconfig *.tsbuildinfo — TypeScript 增量编译缓存

| 序号 | 路径 | 类型 | 大小 | 数量 | 理由 | 建议动作 |
|---|---|---|---|---|---|---|
| 26 | tsconfig.node.tsbuildinfo | 缓存 | 652.19 KB | 1 | 增量编译缓存，下次编译自动重建 | 删除 |
| 27 | tsconfig.web.tsbuildinfo | 缓存 | 607.50 KB | 1 | 同上 | 删除 |
| | **小计** | | **1.23 MB** | **2** | | |

> 注：node_modules 内另有 4 个 tsbuildinfo（约 0.79 MB），属于依赖包，不建议动。

### 2.4 __pycache__ — Python 字节码缓存（项目级）

> .venv 内的 __pycache__（69.20 MB / 482 目录）属于虚拟环境，**已排除**。以下为项目源码目录中的缓存。

| 序号 | 路径 | 类型 | 大小 | 文件数 | 理由 | 建议动作 |
|---|---|---|---|---|---|---|
| 28 | agent\__pycache__ | 缓存 | 43.04 KB | 3 | Python 字节码，自动重建 | 删除 |
| 29 | agent\memory\__pycache__ | 缓存 | 14.11 KB | 4 | 同上 | 删除 |
| 30 | agent\browser\__pycache__ | 缓存 | 6.77 KB | 1 | 同上 | 删除 |
| 31 | voice\__pycache__ | 缓存 | 8.91 KB | 3 | 同上 | 删除 |
| | **小计** | | **72.83 KB** | **11** | | |

### 2.5 data_backup/ — 数据备份（含重复模型）

| 序号 | 路径 | 类型 | 大小 | 文件数 | 理由 | 建议动作 |
|---|---|---|---|---|---|---|
| 32 | data_backup\models\faster-whisper-base\ | 重复文件 | 141.03 MB | 4 | 与 data\models\faster-whisper-base\ **完全相同**（model.bin 145,217,532 B 等 4 文件一一对应），属冗余备份 | 归档到 archive/ 后删除，或直接删除（data/models/ 完好即可） |
| 33 | data_backup\memory.db | 过期数据 | 16.00 KB | 1 | 旧记忆数据库备份 | 归档 |
| 34 | data_backup\history.json | 过期数据 | 2 B | 1 | 空历史文件 | 删除 |
| 35 | data_backup\working_memory.json | 过期数据 | 162 B | 1 | 旧工作记忆 | 归档 |
| 36 | data_backup\tts\ | 空目录 | 0 B | 0 | 空目录 | 删除 |
| | **小计** | | **141.05 MB** | **7** | | |

### 2.6 根目录 misplaced 文件

| 序号 | 路径 | 类型 | 大小 | 数量 | 理由 | 建议动作 |
|---|---|---|---|---|---|---|
| 37 | chi_sim.traineddata | 其他（错位） | 2.47 MB | 1 | Tesseract 中文训练数据，放在 Xiyue 根目录不合理，应为 OCR 服务依赖 | 迁移到 OCR\models\ 或删除（OCR 用 PaddleOCR 可能不需要） |
| 38 | eng.traineddata | 其他（错位） | 5.20 MB | 1 | Tesseract 英文训练数据，同上 | 同上 |
| 39 | dev-app-update.yml | 其他（构建产物） | 75 B | 1 | electron-updater 自动生成 | 删除（自动重建） |
| | **小计** | | **7.67 MB** | **3** | | |

### 2.7 空目录

| 序号 | 路径 | 类型 | 理由 | 建议动作 |
|---|---|---|---|---|
| 40 | data\tts\ | 空目录 | 从未使用 | 删除 |
| 41 | data_backup\tts\ | 空目录 | 备份中的空目录 | 删除 |
| 42 | src\renderer\api\ai\test\ | 空目录 | 空测试目录 | 删除或保留（如需写测试） |
| 43 | src\renderer\components\states\maxExpand\components\setting\components\user\components\ | 空目录 | 残留空目录 | 删除 |
| 44 | src\renderer\components\states\maxExpand\components\setting\components\user\utils\ | 空目录 | 残留空目录 | 删除 |

> 另有 3 个 .git 内空目录（objects/info, objects/pack, refs/tags），**不动**。

### 2.8 data/tmp/ — 录音临时文件

**结果：目录不存在。** 全项目仅发现 `node_modules\tmp`（npm 依赖包，非录音临时目录）。  
已知的"只写不删"问题当前未体现——可能已被清理，或录音临时文件写入了其他路径（如 APPDATA\native-capture\）。

---

## 三、OCR 服务目录 (F:\Work\Create\OCR\)

### 3.1 下划线前缀调试文件（按前缀分组）

> 全部为一次性调试脚本、调试截图、帧数据 dump，**核心服务不依赖这些文件**。

| 前缀组 | 类型 | 大小 | 文件数 | 说明 | 建议动作 |
|---|---|---|---|---|---|
| **_ls_*** | 调试脚本+二进制+截图 | **20.42 MB** | 35 | 长截图 r10-r38 调试系列；含 2 个大 .bin（_ls_dwarf.bin 9.89MB、_ls_1788790258799.bin 5.81MB）和多张 replay PNG | 删除 |
| **_r* (revision)** | 调试脚本+帧数据+截图 | **21.75 MB** | 64 | r23-r29 revision 调试；含 3 个大 .gray 帧数据（_r26_sessB.gray 3.45MB、_r26_sessA.gray 3.31MB、_r25_frames.gray 3.17MB）和大量 _r27_* 对比截图 | 删除 |
| **_editor*** | 调试截图 | 431.43 KB | 3 | CDP 编辑器截图 | 删除 |
| **_f* (frame)** | 调试截图 | 502.05 KB | 3 | 帧截图（_f32.png 与 _f36.png 完全相同，重复） | 删除 |
| **_tail*** | 调试截图 | 194.29 KB | 1 | 长尾截图 | 删除 |
| **_repro*** | 调试截图 | 42.08 KB | 1 | 复现用例截图 | 删除 |
| **_cdp*** | 调试脚本 | 12.41 KB | 4 | CDP 探测 JS 脚本 | 删除 |
| **_matcher*** | 调试脚本 | 9.57 KB | 1 | 匹配器检查 JS | 删除 |
| **_electron*** | 调试输出 | 5.60 KB | 1 | Electron 进程列表 dump | 删除 |
| **_koffi*** | 调试脚本 | 2.66 KB | 1 | koffi 探测 cjs | 删除 |
| **_mem*** | 调试脚本 | 3.29 KB | 1 | 内存检查 py | 删除 |
| **_vm*** | 调试脚本 | 3.20 KB | 1 | VM 加载检查 JS | 删除 |
| **_verify*** | 调试脚本 | 2.30 KB | 1 | 长截图焦点验证 cjs | 删除 |
| **_mask*** | 调试脚本 | 2.13 KB | 1 | 遮罩几何检查 JS | 删除 |
| **_fix*** | 调试脚本 | 1.35 KB | 2 | 修复桩 py | 删除 |
| **_test*** | 调试截图 | 1.66 KB | 1 | 布局测试 PNG | 删除 |
| **_pip*** | 日志 | 1.62 KB | 4 | pip 安装/卸载日志 | 删除 |
| **_svc*** | 日志 | 669 B | 1 | 服务启动日志 | 删除 |
| **_send*** | 调试脚本 | 633 B | 1 | 热键发送 JS | 删除 |
| **_clip*** | 调试输出 | 10 B | 1 | 剪贴板输出（空） | 删除 |
| | **小计** | **43.35 MB** | **128** | | |

### 3.2 非下划线垃圾文件

| 序号 | 路径 | 类型 | 大小 | 理由 | 建议动作 |
|---|---|---|---|---|---|
| 45 | debug_err.txt | 日志 | 54 B | 调试错误输出 | 删除 |
| 46 | debug_out.txt | 日志 | 0 B | 空调试输出 | 删除 |
| 47 | screenshot_ocr_err.log | 日志 | 0 B | 空错误日志 | 删除 |
| 48 | screenshot_ocr_out.log | 日志 | 235 B | 运行输出日志 | 删除 |
| 49 | test_err.txt | 日志 | 0 B | 空测试错误 | 删除 |
| 50 | test_out.txt | 日志 | 0 B | 空测试输出 | 删除 |
| 51 | Snipaste_2026-06-28_22-42-46.png | 调试截图 | 92.52 KB | 随手截图，非项目资源 | 删除 |
| | **小计** | | **92.80 KB** | **7** | | |

### 3.3 OCR __pycache__

| 序号 | 路径 | 类型 | 大小 | 文件数 | 理由 | 建议动作 |
|---|---|---|---|---|---|---|
| 52 | __pycache__\ | 缓存 | 91.23 KB | 3 | Python 字节码缓存 | 删除 |

### 3.4 screenshot/ 子目录中的调试数据

> screenshot/ 本身是一个截图工具项目（含 capture.js、README.md、docs/、tools/、main/、renderer/ 等源码），**源码部分保留**。以下子目录为调试残留：

| 序号 | 路径 | 类型 | 大小 | 文件数 | 理由 | 建议动作 |
|---|---|---|---|---|---|---|
| 53 | screenshot\frames\ | 调试截图/帧数据 | 56.18 MB | 18 | 调试帧捕获，体积大 | 删除 |
| 54 | screenshot\logs\ | 日志 | 0.45 MB | 9 | 调试日志 | 删除 |
| | **小计** | | **56.63 MB** | **27** | | |

### 3.5 OCR 核心服务文件（保留，不可清理）

| 路径 | 说明 |
|---|---|
| local_capture_service.py | 核心捕获服务（38 KB） |
| screenshot_ocr.py | OCR 主脚本（4.4 KB） |
| toolbox.py | 工具箱（6.2 KB） |
| layout_worker.py | 布局工作器（7.2 KB） |
| run.bat / run_screenshot_ocr.bat / set_env.bat | 启动脚本 |
| venv_ocr\ | Python 虚拟环境（4.58 GB，重装成本极高） |
| models\ | AI 模型（4.04 GB） |
| PaddleOCR\ | PaddleOCR 库（238 MB） |
| screenshot_tool\ | 截图工具源码（90 KB） |
| ocr_toolbox\ | OCR 工具箱源码（72 KB） |
| screenshot\（源码部分） | capture.js、README.md、docs/、tools/、main/、renderer/、reference/、resources/ |
| .claude\settings.local.json | Claude 项目配置（251 B） |

---

## 四、APPDATA 用户数据 (C:\Users\shangmeng\AppData\Roaming\xiyue\)

> 总大小：435.52 MB。Electron 应用的用户数据目录。

| 序号 | 路径 | 类型 | 大小 | 文件数 | 理由 | 建议动作 |
|---|---|---|---|---|---|---|
| 55 | Cache\ | 缓存 | **227.85 MB** | 2,252 | Electron HTTP 缓存，安全可删，应用重启后自动重建 | 删除 |
| 56 | Code Cache\ | 缓存 | **199.35 MB** | 5,260 | V8 JIT 编译缓存，安全可删 | 删除 |
| 57 | logs\ | 日志 | 5.11 MB | 254 | 应用日志，保留最近 3 天即可，旧的可删 | 归档旧日志后删除（保留 2026-09-08 之后） |
| 58 | native-capture\ | 临时文件 | 2.86 MB | 2 | 原生捕获临时文件，检查是否为残留录音 | 检查后删除（应用未运行时） |
| 59 | aba8ba94-*.tmp | 临时文件 | 1.71 KB | 1 | 孤立 .tmp 文件 | 删除 |
| 60 | wallpapers\ | 空目录 | 0 B | 0 | 空目录（含空 video/、video-cover/ 子目录） | 删除 |
| 61 | blob_storage\ | 空目录 | 0 B | 0 | 空目录 | 删除 |
| 62 | eIsland_store\ | 其他（遗留命名） | 2.76 KB | 29 | 旧版命名的配置存储，含用户设置（主题、语言、收藏等 29 个 JSON），**不可直接删** | 保留（建议后续重命名为 xiyue_store 并迁移） |
| | **可清理小计** | | **435.17 MB** | **7,775** | | |

### 需保留的 APPDATA 子目录

| 路径 | 大小 | 说明 |
|---|---|---|
| Local Storage\ | 71.66 KB | DOM 本地存储，含应用状态 |
| Network\ | 75.04 KB | 网络 Cookie 等 |
| Session Storage\ | 39.14 KB | 会话存储 |
| Shared Dictionary\ | 44.07 KB | V8 共享字典 |
| WebStorage\ | 40.00 KB | Web 存储 |
| music-providers\ | 32.18 KB | 音乐提供商配置 |
| Local State / Preferences / .updaterId / DevToolsActivePort / DIPS / SharedStorage | — | Electron 核心状态文件 |

---

## 五、.workbuddy 目录（不可清理）

| 路径 | 大小 | 文件数 | 状态 |
|---|---|---|---|
| F:\Work\Create\Assa\.workbuddy\ | 473.66 KB | 14 | 🔒 **不可清理** — 工作记忆体系 |

---

## 六、重复文件检测

### 6.1 模型文件重复（高价值）

| 文件 | data\models\ 大小 | data_backup\models\ 大小 | 状态 |
|---|---|---|---|
| model.bin | 145,217,532 B | 145,217,532 B | ✅ 完全相同 |
| tokenizer.json | 2,203,239 B | 2,203,239 B | ✅ 完全相同 |
| vocabulary.txt | 459,861 B | 459,861 B | ✅ 完全相同 |
| config.json | 2,309 B | 2,309 B | ✅ 完全相同 |

> **结论**：data_backup\models\faster-whisper-base\ 是 data\models\faster-whisper-base\ 的完整冗余副本，浪费 **141.03 MB**。

### 6.2 OCR 重复 PNG 帧

检测到多组相同大小的调试截图（极可能为完全相同的帧），主要集中在 _r27_* 系列：

| 组 | 文件数 | 单文件大小 | 浪费估算 |
|---|---|---|---|
| _r27_editor_view / _r27_f2_blur / _r27_f2_scroll / _r27_t_t08/t15/t40/t80 | 7 | 450,001 B | ~2.70 MB |
| _r27_h_after_active_off / _r27_h_before / _r27_z_zoombig / _r27_z_zoomtoggle | 4 | 474,480 B | ~1.36 MB |
| _r27_fix_r0/r1/r2/r3 | 4 | 396,114 B | ~1.13 MB |
| _r27_f2_jiggle / _r27_z_baseline | 2 | 474,420 B | ~0.45 MB |
| _r27_fix_r5/r6 | 2 | 456,683 B | ~0.44 MB |
| _r27_ab_fractional / _r27_ab_rounded | 2 | 345,749 B | ~0.33 MB |
| _f32.png / _f36.png | 2 | 181,102 B | ~0.17 MB |
| | | **合计浪费** | **~6.58 MB** |

> 这些重复帧已包含在 3.1 节的 _r* / _f* 整体删除中，不单独计算。

### 6.3 文档文件

- AGENTS.md（5,523 B）与 CLAUDE.md（5,523 B）大小相同 — 这是**正常现象**（不同 AI 工具的项目规则文件，内容可能一致），**不清理**。

---

## 七、高优先级清理项（大文件 / 立即可释放）

| 优先级 | 项目 | 大小 | 操作 | 风险 |
|---|---|---|---|---|
| 🔴 P0 | 插件 bin/obj/build 编译产物 | 627.46 MB | 删除 | 无（源码可重建，首次重建需几分钟） |
| 🔴 P0 | APPDATA Cache\ | 227.85 MB | 删除 | 无（Electron 自动重建） |
| 🔴 P0 | APPDATA Code Cache\ | 199.35 MB | 删除 | 无（V8 自动重建，首次启动略慢） |
| 🔴 P0 | out/ 构建产物 | 78.94 MB | 删除 | 无（npm run build 重建） |
| 🔴 P0 | OCR screenshot\frames\ | 56.18 MB | 删除 | 无（调试帧） |
| 🔴 P0 | OCR _ls_* 调试系列 | 20.42 MB | 删除 | 无 |
| 🔴 P0 | OCR _r* revision 调试系列 | 21.75 MB | 删除 | 无 |
| 🟡 P1 | data_backup 重复模型 | 141.03 MB | 归档后删除 | 低（确认 data/models/ 完好即可） |
| 🟡 P1 | 根目录 traineddata 错位文件 | 7.67 MB | 迁移或删除 | 低（确认 OCR 不依赖 Tesseract） |

## 八、低优先级清理项（小文件 / 数量多）

| 项目 | 大小 | 文件数 | 说明 |
|---|---|---|---|
| APPDATA logs\（旧日志） | ~5 MB | 254 | 保留最近 3 天 |
| tsbuildinfo 缓存 | 1.23 MB | 2 | 增量编译缓存 |
| OCR 其他调试文件（_editor/_f/_cdp 等） | ~1.18 MB | 30 | 小文件多 |
| OCR 非下划线垃圾 | 92.80 KB | 7 | 空日志+截图 |
| 项目 __pycache__ | 72.83 KB | 11 | agent/voice |
| OCR __pycache__ | 91.23 KB | 3 | |
| APPDATA .tmp + 空目录 | <3 MB | 3 | 孤立临时文件 |
| 空目录 | 0 B | 5 | 目录结构清理 |

---

## 九、建议的 archive/ 目录结构（可逆归档方案）

对于不想直接删除、但需要从工作目录移走的内容，建议建立如下归档结构：

```
F:\Work\Create\Assa\archive\
├── 2026-09-10_cleanup\
│   ├── ocr_debug\
│   │   ├── _ls_*\              (长截图调试系列)
│   │   ├── _r*\                (revision 调试系列)
│   │   └── _misc\              (其他下划线调试文件)
│   ├── ocr_screenshot_frames\  (screenshot\frames\ 调试帧)
│   ├── xiyue_data_backup\      (data_backup\ 整体归档)
│   ├── xiyue_traineddata\      (根目录错位的 traineddata)
│   ├── appdata_logs\           (APPDATA 旧日志)
│   └── MANIFEST.txt            (归档清单：原路径→归档路径、大小、日期)
```

**归档原则**：
1. 归档前在 `MANIFEST.txt` 记录每个文件的原始路径、大小、修改日期
2. 归档保留 30 天，确认无问题后可彻底删除
3. 编译产物（bin/obj/build/out/tsbuildinfo）和缓存（Cache/Code Cache/__pycache__）**不需要归档**，直接删除即可
4. 调试脚本和截图可选择性归档到 `archive/`，其余直接删除

---

## 十、执行建议（分批次）

### 第一批：零风险缓存与编译产物（立即执行，释放 ~1,135 MB）
```
删除：插件 bin/obj/build、out/、tsbuildinfo、__pycache__、APPDATA Cache、APPDATA Code Cache
```

### 第二批：OCR 调试垃圾（释放 ~100 MB）
```
删除：OCR 所有 _* 前缀文件、debug_*.txt、test_*.txt、*.log、Snipaste_*.png、screenshot\frames\、screenshot\logs\、__pycache__
```

### 第三批：需确认项（释放 ~154 MB）
```
1. 确认 data/models/faster-whisper-base 完好 → 归档/删除 data_backup/
2. 确认 OCR 不使用 Tesseract → 删除或迁移根目录 *.traineddata
3. 保留最近 3 天日志 → 删除 APPDATA logs/ 中 2026-09-08 之前的日志
4. 应用未运行时 → 检查并删除 APPDATA native-capture\ 和 *.tmp
```

### 第四批：目录结构清理
```
删除空目录：data\tts\、data_backup\tts\、src\renderer\api\ai\test\（如需保留测试目录则跳过）、
           user\components\、user\utils\、APPDATA wallpapers\、APPDATA blob_storage\
```

---

## 十一、注意事项

1. **data/tmp/ 不存在**：已知的"录音只写不删"问题当前未在 Xiyue\data\tmp\ 体现。建议检查 APPDATA\native-capture\（2.86 MB / 2 文件）是否为录音残留，并在代码中确认临时文件写入路径。
2. **eIsland_store 遗留命名**：APPDATA 中配置目录仍叫 `eIsland_store`（29 个 JSON），建议后续版本重命名为 `xiyue_store` 并做迁移，避免混淆。
3. **插件编译产物巨大**：12 个插件的 bin/obj 总计 627 MB，建议在 `.gitignore` 中确认已排除，并考虑添加 `npm run clean` 脚本统一清理。
4. **OCR screenshot/frames 56 MB**：这是截图工具项目的调试帧，非核心服务文件，但位于 screenshot/ 项目目录内，清理时注意不要误删 screenshot/ 的源码部分（capture.js、docs/、tools/ 等）。
5. **本次扫描未执行任何删除操作**，所有数据为实测大小。
