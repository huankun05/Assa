# Xiyue（汐月）Electron 应用层深度源码调查报告

> **版本**：26.7.4 ｜ **调查日期**：2026-09-10 ｜ **项目路径**：`F:\Work\Create\Assa\Xiyue`
> **技术栈**：Electron 43.4.0 + React 19.2.8 + TypeScript 7.0.2 + Vite 7.3.6 + Tailwind 4.3.3 + zustand 5.0.15
> **协议**：GPL-3.0-or-later（含附加条款，Windows-only 禁止移植 macOS）
> **上游**：eIsland（JNTMTMTM/eIsland），汐月为衍生换芯版

---

## 1. 模块地图

```
Xiyue/
├── src/
│   ├── main/                          # 主进程（Node.js 环境）
│   │   ├── index.ts                   # [已查证] 入口，1056行：单实例锁、多窗口创建、IPC注册、服务初始化、协议注册
│   │   ├── smtcWorker.ts              # [已查证] SMTC 监听 Worker 线程（独立打包入口）
│   │   ├── tray.ts                    # [已查证] 系统托盘
│   │   ├── window/                    # [已查证] 窗口管理：mainWindow/captureWindow/settingsWindow/splashWindow/guideWindow/standaloneWindow/capturePinWindow/screenshotHelper/dwmTransition
│   │   ├── ipc/                       # [已查证] IPC 注册，按域分6个子目录
│   │   │   ├── agent/                 #   汐月Agent/Ollama/CustomDirect/ClaudeCode/Codex/本地工具
│   │   │   ├── app/                   #   应用生命周期/下载/更新/邮件/网络/存储/日志/图片压缩/格式工厂/扩展
│   │   │   ├── media/                 #   媒体控制/音乐设置/汽水音乐/壁纸视频/音乐提供商认证
│   │   │   ├── settings/              #   主题/灵动岛/剪贴板
│   │   │   ├── system/                #   系统信息/快捷键/截图热键/隐藏进程
│   │   │   └── window/                #   窗口尺寸/鼠标穿透/截图/壁纸
│   │   ├── services/                  # [已查证] 服务层：appLifecycle/updater/hotkey/xiyueAgent/captureOcr/nativeCapture/chromiumFlags/imageTranslation
│   │   ├── core/                      # [已查证] 核心模块
│   │   │   └── downloadEngine/        #   多线程下载引擎（config/utils 子目录）
│   │   ├── config/                    # [已查证] storeConfig.ts：所有持久化配置的读写与 sanitize
│   │   ├── system/                    # [已查证] autoHideWatcher/externalAgentWatcher/claudeCodeStatus/codexStatus/runningProcesses/mediaKey/sessionLimits
│   │   ├── clipboard/                 # [已查证] URL 监听状态 + 剪贴板 URL 监视器
│   │   ├── music/                     # [已查证] smtcService/smtcAccessor/neteaseWatcher/mediaLike/musicBeatSource + providers/
│   │   ├── log/                       # [已查证] mainLog.ts 会话日志写入器
│   │   ├── installer/                 # [已查证] 安装器相关
│   │   ├── extensions/                # [已查证] extensionManager/extensionRegistry
│   │   ├── types/                     # [已查证] agent/config/core/system 类型定义
│   │   └── utils/                     # [已查证] broadcast/clipboardUrl/ffmpegPath
│   ├── preload/
│   │   ├── index.ts                   # [已查证] 预加载桥接，1962行：contextBridge 暴露 window.api（~150个方法）+ window.electron
│   │   └── types/                     # [已查证] 所有 IPC 载荷类型定义
│   ├── renderer/                      # 渲染进程（React 19）
│   │   ├── DynamicIslandMain.tsx      # [已查证] 主入口：bootstrap→主题/字体/认证/天气→挂载 DynamicIsland
│   │   ├── components/
│   │   │   ├── DynamicIsland.tsx      # [已查证] 根组件：Background + StateContent + Coordinator
│   │   │   ├── components/            # [已查证] 共享组件：AgentInputBall/ProcessComponents(thinking/todo)/GuidePages/ProcessIndicator/SharedWaveEffect
│   │   │   ├── states/                # [已查证] 灵动岛状态机（13个状态目录）
│   │   │   ├── hooks/                 # [已查证] 17个协调Hook：coordinator/shell/hoverInteraction/nowPlayingSync/notificationSubscriptions/...
│   │   │   └── config/                # [已查证] dynamicIslandConfig/controlCenterButtons
│   │   ├── store/                     # [已查证] zustand：7个slice + types + constants + utils
│   │   ├── api/                       # [已查证] API层：ai/weather/lyrics/miniGame/tools/update/user/announcement/site
│   │   ├── styles/                    # [已查证] CSS模块：shell/hover/expanded/lyrics/notification/settings/guide/cli/stt/agent/reset
│   │   ├── utils/                     # [已查证] audio/theme/font/lrcParser/security(totp)/SvgIcon/GifIcon/logger/sliderCaptcha/authSession
│   │   └── i18n/                      # [已查证] i18next 初始化
│   └── shared/                        # [已查证] 主/渲染共享：islandDimensions/storeKeys/musicProviderAuth/browserSource/qishuiBusiness/extensionTypes
├── plugins/                           # [已查证] 14个原生插件（eisland-windows-* 前缀，历史遗留命名）
├── i18n/                              # [已查证] zh-CN.json + en-US.json
├── schemas/                           # [已查证] tool_schema.json（AI工具定义）
├── sdk/                               # [已查证] TypeScript SDK（package.json + src/ + templates/）
├── web/                               # [已查证] 3个Web应用：eisland-web-docs / eisland-web-guide / eisland-web-issue-report
├── resources/                         # [已查证] capture.html/js/css, pin.html/js/css, qishui-auth, netease-watcher(Rust), ffmpeg.exe, svg, icon, installer.nsh
├── agent/                             # [已查证] Python 侧车（Hermes Agent，server.py 监听 127.0.0.1:8765）
├── scripts/                           # [已查证] changelog生成/release上传/COS上传/ESA缓存刷新/注释规范检查/i18n完整性检查
├── assets/                            # [已查证] 图片/壁纸资源
├── voice/                             # [已查证] 语音资源
├── data/                              # [已查证] 运行时数据（faster-whisper 模型等）
├── electron.vite.config.ts            # [已查证] main/preload/renderer 三端打包配置，6个renderer入口
├── electron-builder.json              # [已查证] NSIS打包，asarUnpack原生插件，extraResources
├── vitest.config.ts                   # [已查证] node环境，匹配 src/**/*.test.ts
└── package.json                       # [已查证] 依赖清单+scripts
```

---

## 2. IPC Channel 清单

> 共 **~180+** 个 IPC channel，按6个域分类。以下为完整清单（已查证，来源：`src/main/ipc/**/*.ts` 中 `ipcMain.handle/on` 调用）。

### 2.1 agent 域（`src/main/ipc/agent/`）

| Channel | 类型 | 功能 | 文件 |
|---|---|---|---|
| `xiyue:health` | handle | 汐月Hermes侧车健康检查 | xiyueAgentIpc.ts:54 |
| `xiyue:chat` | handle | 文本对话（→Python侧车） | xiyueAgentIpc.ts:62 |
| `xiyue:voice` | handle | 语音对话（录音→STT→LLM→TTS） | xiyueAgentIpc.ts:70 |
| `xiyue:transcribe` | handle | 本地音频转写（16k mono wav base64） | xiyueAgentIpc.ts:79 |
| `xiyue:stream:start` | handle | 启动工具化流式对话（SSE） | xiyueAgentIpc.ts:88 |
| `xiyue:stream:abort` | handle | 中止流式会话 | xiyueAgentIpc.ts:155 |
| `xiyue:tool-result` | handle | 回传本地工具执行结果 | xiyueAgentIpc.ts:163 |
| `xiyue:identity` | handle | 获取汐月身份配置（name/role/model/情感/记忆/工具等） | xiyueIdentity.ts:91 |
| `ollama:ping` | handle | 检测本地Ollama服务 | ollamaIpc.ts:63 |
| `ollama:models` | handle | 获取Ollama模型列表 | ollamaIpc.ts:71 |
| `ollama:detectBaseUrl` | handle | 自动检测Ollama端口 | ollamaIpc.ts:79 |
| `ollama:chat:start` | handle | 启动Ollama ReAct编排会话 | ollamaIpc.ts:87 |
| `ollama:chat:abort` | handle | 中止Ollama会话 | ollamaIpc.ts:137 |
| `customDirect:chat:start` | handle | 启动自定义API直连ReAct编排 | ollamaIpc.ts:149 |
| `customDirect:chat:abort` | handle | 中止自定义API直连会话 | ollamaIpc.ts:200 |
| `agent:local-tool:execute` | handle | 执行本地Agent工具（主进程侧） | localToolIpc.ts:39 |
| `claude-code:status:get` | handle | 获取Claude Code状态快照 | claudeCodeStatusIpc.ts:40 |
| `claude-code:hook:install` | handle | 安装Claude Code钩子 | claudeCodeStatusIpc.ts:41 |
| `claude-code:hook:uninstall` | handle | 卸载Claude Code钩子 | claudeCodeStatusIpc.ts:42 |
| `claude-code:events:clear` | handle | 清除事件记录 | claudeCodeStatusIpc.ts:43 |
| `claude-code:sessions:delete` | handle | 删除会话记录 | claudeCodeStatusIpc.ts:44 |
| `claude-code:permission:resolve` | handle | 解决权限请求(allow/always/deny) | claudeCodeStatusIpc.ts:45 |
| `codex:status:get` | handle | 获取Codex状态快照 | codexStatusIpc.ts:30 |
| `codex:monitor:enable` | handle | 启用Codex监控 | codexStatusIpc.ts:31 |
| `codex:monitor:disable` | handle | 禁用Codex监控 | codexStatusIpc.ts:32 |
| `codex:events:clear` | handle | 清除Codex事件 | codexStatusIpc.ts:33 |
| `codex:sessions:delete` | handle | 删除Codex会话 | codexStatusIpc.ts:34 |

### 2.2 app 域（`src/main/ipc/app/`）

| Channel | 类型 | 功能 | 文件 |
|---|---|---|---|
| `app:quit` | on | 退出应用 | app.ts:2215 |
| `app:restart` | handle | 重启应用 | app.ts:2383 |
| `app:open-logs-folder` | handle | 打开日志目录 | app.ts:2394 |
| `app:clear-logs-cache` | handle | 清理日志缓存 | app.ts:2405 |
| `app:pick-local-search-directory` | handle | 选择本地搜索目录 | app.ts:2219 |
| `app:pick-skill-file` | handle | 选择Skill(.md)文件 | app.ts:2237 |
| `app:read-text-file` | handle | 读取文本文件 | app.ts:2256 |
| `app:save-text-file` | handle | 保存文本文件 | app.ts:2267 |
| `app:search-local-files` | handle | 本地文件名称搜索 | app.ts:2319 |
| `app:pick-feedback-screenshot-file` | handle | 选择反馈截图 | app.ts:2338 |
| `app:pick-feedback-log-file` | handle | 选择反馈日志 | app.ts:2358 |
| `app:get-file-icon` | handle | 获取文件图标(base64) | app.ts:2419 |
| `app:open-file` | handle | 打开文件/应用 | app.ts:2430 |
| `app:open-in-explorer` | handle | 在资源管理器中定位 | app.ts:2440 |
| `app:save-image-as` | handle | 图片另存为 | app.ts:2452 |
| `app:resolve-shortcut` | handle | 解析.lnk快捷方式 | app.ts:2486 |
| `app:open-standalone-window` | handle | 打开独立窗口（倒数日/TODO） | app.ts:2499 |
| `app:open-settings-window` | handle | 打开设置窗口 | app.ts:2515 |
| `app:close-standalone-window` | handle | 关闭独立窗口 | app.ts:2525 |
| `app:pick-file-for-hash` | handle | 选择文件用于哈希校验 | app.ts:2555 |
| `app:compute-file-hash` | handle | 计算文件哈希(md5/sha1/sha256/sha512) | app.ts:2573 |
| `window:minimize` | on | 最小化当前窗口 | app.ts:2535 |
| `window:maximize` | on | 最大化/还原 | app.ts:2540 |
| `window:close` | on | 关闭当前窗口 | app.ts:2550 |
| `log:write` | on | 写入日志文件 | log.ts:37 |
| `store:read` | handle | 从JSON文件读取数据 | store.ts:45 |
| `store:write` | handle | 写入JSON文件 | store.ts:58 |
| `net:fetch` | handle | 主进程代理HTTP请求（绕过CORS） | net.ts:135 |
| `mail:inbox:list` | handle | 读取IMAP收件箱 | mail.ts:285 |
| `download:start` | handle | 启动多线程下载 | download.ts:203 |
| `download:cancel` | handle | 取消下载 | download.ts:224 |
| `download:pause` | handle | 暂停下载 | download.ts:230 |
| `download:resume` | handle | 恢复下载 | download.ts:236 |
| `download:remove` | handle | 移除下载任务 | download.ts:250 |
| `download:list` | handle | 列出下载任务 | download.ts:266 |
| `download:get` | handle | 获取单个任务 | download.ts:270 |
| `download:pick-save-path` | handle | 选择保存路径 | download.ts:276 |
| `download:get-default-dir` | handle | 获取默认下载目录 | download.ts:293 |
| `updater:check` | handle | 检查更新 | updater.ts:81 |
| `updater:download` | handle | 下载更新 | updater.ts:112 |
| `updater:install` | handle | 安装更新并重启 | updater.ts:136 |
| `updater:version` | handle | 获取当前版本 | updater.ts:141 |
| `guide:reset` | handle | 重置首次启动标记 | updater.ts:145 |
| `extension:list` | handle | 列出扩展 | extension.ts:40 |
| `extension:install` | handle | 安装扩展 | extension.ts:50 |
| `extension:uninstall` | handle | 卸载扩展 | extension.ts:74 |
| `image-compression:pick-images` | handle | 选择待压缩图片 | imageCompression.ts:260 |
| `image-compression:pick-output-dir` | handle | 选择输出目录 | imageCompression.ts:280 |
| `image-compression:start` | handle | 启动图片压缩任务 | imageCompression.ts:296 |
| `image-compression:list` | handle | 列出压缩任务 | imageCompression.ts:439 |
| `image-compression:remove` | handle | 移除压缩任务 | imageCompression.ts:443 |
| `format-factory:pick-video` | handle | 选择视频文件 | formatFactory.ts:75 |
| `format-factory:extract-track` | handle | 提取音轨/视频轨（ffmpeg） | formatFactory.ts:111 |
| `splash:open-settings` | on | 启动动画上打开设置（index.ts:515） | index.ts |
| `cli-glow:show` | handle | 显示CLI检测全屏光效 | index.ts:522 |
| `cli-glow:hide` | handle | 关闭CLI检测光效 | index.ts:523 |

### 2.3 media 域（`src/main/ipc/media/`）

| Channel | 类型 | 功能 | 文件 |
|---|---|---|---|
| `media:current-info:get` | handle | 获取当前播放信息 | media.ts:55 |
| `media:nowplaying-ready` | on | 通知主进程播放监听器就绪 | media.ts:66 |
| `media:play-pause` | handle | 播放/暂停 | media.ts:76 |
| `media:next` | handle | 下一曲 | media.ts:84 |
| `media:prev` | handle | 上一曲 | media.ts:91 |
| `media:accept-source-switch` | handle | 接受播放源切换 | media.ts:98 |
| `media:reject-source-switch` | handle | 拒绝播放源切换 | media.ts:115 |
| `media:seek` | handle | 跳转到指定位置(ms) | media.ts:120 |
| `media:get-volume` | handle | 获取系统音量（**硬编码返回0.5，stub**） | media.ts:125 |
| `media:set-volume` | handle | 设置系统音量（**空实现，stub**） | media.ts:127 |
| `media:get-muted` | handle | 获取静音状态 | media.ts:131 |
| `media:toggle-muted` | handle | 切换静音 | media.ts:133 |
| `smtc:get-timestamp` | handle | 轻量获取SMTC播放时间戳 | media.ts:141 |
| `music:whitelist:get/set` | handle | 播放器白名单读写 | music.ts:85/89 |
| `music:lyrics-source:get/set` | handle | 歌词源配置 | music.ts:102/106 |
| `music:provider-mode:get/set` | handle | 音乐提供商模式(guest/logged-in) | music.ts:117/128 |
| `music:lyrics-karaoke:get/set` | handle | 逐字扫光开关 | music.ts:139/151 |
| `music:lyrics-clock:get/set` | handle | 歌词界面时钟开关 | music.ts:163/175 |
| `music:lyrics-calibrate-enabled:get/set` | handle | 歌词校准开关 | music.ts:186/198 |
| `music:lyrics-enabled:get/set` | handle | 歌词功能开关 | music.ts:209/221 |
| `music:lyrics-translation-enabled:get/set` | handle | 翻译歌词开关 | music.ts:232/244 |
| `music:lyrics-calibrate-delay:get/set` | handle | 歌词校准延迟(秒) | music.ts:255/267 |
| `music:smtc-unsubscribe-ms:get/set` | handle | SMTC自动取消订阅时间 | music.ts:279/283 |
| `music:detect-source-app-id` | handle | 检测所有SMTC播放源 | music.ts:296 |
| `music:like:check` | handle | 检查歌曲是否已收藏 | music.ts:311 |
| `music:like:list` | handle | 列出收藏歌曲 | music.ts:317 |
| `music:like:toggle` | handle | 切换收藏（本地+网易云快捷键） | music.ts:319 |
| `music:like:sync` | handle | 深度同步网易云喜欢状态 | music.ts:344 |
| `music:like:hotkey:get/set` | handle | 喜欢快捷键配置 | music.ts:410/412 |
| `music:like:count` | handle | 收藏歌曲数量 | music.ts:420 |
| `music-provider-auth:status` | handle | 音乐提供商登录状态 | musicProviderAuth.ts:66 |
| `music-provider-auth:create-qr` | handle | 创建登录二维码 | musicProviderAuth.ts:69 |
| `music-provider-auth:check-qr` | handle | 检查二维码登录状态 | musicProviderAuth.ts:72 |
| `music-provider-auth:clear` | handle | 清除登录会话 | musicProviderAuth.ts:75 |
| `netease-auth:login/status/clear` | handle | 网易云认证（3个） | musicProviderAuth.ts:79-86 |
| `qishui:status/search/feed/playlists/playlist-tracks/lyrics/song-url/comments/create-comment/check-liked/like/collect-playlist/collect-album/add-song/recent-play` | handle | 汽水音乐业务API（14个） | qishui.ts:32-70 |
| `wallpaper:video:probe` | handle | 探测视频信息 | wallpaperVideo.ts:243 |
| `wallpaper:video:prepare` | handle | 准备壁纸视频（转码/缓存） | wallpaperVideo.ts:253 |
| `wallpaper:video:cover` | handle | 提取视频封面 | wallpaperVideo.ts:426 |
| `wallpaper:video:clear-cache` | handle | 清理视频缓存 | wallpaperVideo.ts:452 |

### 2.4 settings 域（`src/main/ipc/settings/`）

| Channel | 类型 | 功能 | 文件 |
|---|---|---|---|
| `theme:mode:get/set` | handle | 主题模式(dark/light/system) | theme.ts:44/56 |
| `island:opacity:get/set` | handle | 灵动岛透明度(10-100) | island.ts:52/65 |
| `island:expand-mouseleave-idle:get/set` | handle | expand鼠标移开回idle | island.ts:78/90 |
| `island:maxexpand-mouseleave-idle:get/set` | handle | maxExpand鼠标移开回idle | island.ts:102/114 |
| `island:idle-click-expand:get/set` | handle | idle点击展开 | island.ts:126/138 |
| `island:spring-animation:get/set` | handle | 弹性动画开关 | island.ts:150/162 |
| `island:animation-speed:get/set` | handle | 动画速度(slow/medium/fast) | island.ts:174/186 |
| `island:shape-mode:get/set` | handle | 形态模式(notch/pill) | island.ts:199/203 |
| `island:autostart:get/set` | handle | 开机自启模式 | island.ts:212/224 |
| `island:nav-order:get/set` | handle | 快速导航卡片配置 | island.ts:246/271 |
| `clipboard:read-text` | handle | 读取剪贴板文本 | clipboard.ts:61 |
| `clipboard:write-text` | handle | 写入剪贴板 | clipboard.ts:69 |
| `clipboard:url-blacklist:get/set/add-domain` | handle | 剪贴板URL黑名单 | clipboard.ts:78/82/96 |
| `clipboard:url-detect-mode:get/set` | handle | URL识别模式 | clipboard.ts:113/117 |
| `clipboard:url-monitor:get/set` | handle | URL监听开关 | clipboard.ts:131/135 |
| `clipboard:open-url` | handle | 外部浏览器打开URL | clipboard.ts:154 |

### 2.5 system 域（`src/main/ipc/system/`）

| Channel | 类型 | 功能 | 文件 |
|---|---|---|---|
| `system:open-task-manager` | on | 打开任务管理器 | system.ts:358 |
| `system:open-calculator` | on | 打开计算器 | system.ts:371 |
| `system:running-processes:get` | handle | 非系统进程列表 | system.ts:395 |
| `system:running-processes:with-icons:get` | handle | 进程列表(含图标) | system.ts:400 |
| `system:open-windows:with-icons:get` | handle | 打开窗口列表(含图标) | system.ts:405 |
| `system:focused-window:get` | handle | 当前焦点窗口 | system.ts:410 |
| `system:brightness:get/set` | handle | 屏幕亮度(0-100) | system.ts:415/426 |
| `system:volume:get/set` | handle | 系统音量(0-100) | system.ts:439/449 |
| `system:performance-snapshot:get` | handle | 性能快照(CPU/GPU/磁盘) | system.ts:462 |
| `system:screenshot` | handle | 全屏截图(base64) | capture.ts:378 |
| `system:screenshot:region:start` | handle | 启动选区截图 | capture.ts:368 |
| `hide-process-list:get/set` | handle | 隐藏进程名单 | hideProcess.ts:52/56 |
| `hide-process-list:auto-hide-fullscreen:get/set` | handle | 全屏窗口自动隐藏 | hideProcess.ts:76/80 |
| `hotkey:get/set` | handle | 隐藏灵动岛快捷键 | hotkey.ts:107/111 |
| `hotkey:suspend/resume` | handle | 暂停/恢复所有快捷键 | hotkey.ts:513/518 |
| `quit-hotkey:get/set` | handle | 关闭快捷键 | hotkey.ts:301/305 |
| `screenshot-hotkey:get/set` | handle | 截图快捷键 | screenshotHotkey.ts:47/51 |
| `next-song-hotkey:get/set` | handle | 切歌快捷键 | hotkey.ts:205/209 |
| `play-pause-song-hotkey:get/set` | handle | 播放/暂停快捷键 | hotkey.ts:237/241 |
| `reset-position-hotkey:get/set` | handle | 还原位置快捷键 | hotkey.ts:269/273 |
| `toggle-tray-hotkey:get/set` | handle | 切换托盘快捷键 | hotkey.ts:331/335 |
| `show-settings-window-hotkey:get/set` | handle | 显示设置窗口快捷键 | hotkey.ts:173/177 |
| `open-clipboard-history-hotkey:get/set` | handle | 打开剪贴板历史快捷键 | hotkey.ts:141/145 |
| `toggle-passthrough-hotkey:get/set` | handle | 切换鼠标穿透快捷键 | hotkey.ts:363/367 |
| `toggle-ui-lock-hotkey:get/set` | handle | 切换UI锁定快捷键 | hotkey.ts:397/401 |
| `agent-voice-input-hotkey:get/set` | handle | Agent语音输入快捷键 | hotkey.ts:433/437 |
| `toggle-shape-mode-hotkey:get/set` | handle | 切换形态模式快捷键 | hotkey.ts:473/477 |

### 2.6 window 域（`src/main/ipc/window/`）

| Channel | 类型 | 功能 | 文件 |
|---|---|---|---|
| `window:enable-mouse-passthrough` | on | 启用鼠标穿透 | window.ts:242 |
| `window:disable-mouse-passthrough` | on | 禁用鼠标穿透 | window.ts:248 |
| `window:expand` | on | 展开到hover尺寸(500x60) | window.ts:255 |
| `window:expand-notification` | on | 展开到notification尺寸(500x88) | window.ts:267 |
| `window:expand-lyrics` | on | 展开到lyrics尺寸(500x42) | window.ts:279 |
| `window:expand-lyrics-translation` | on | 展开到lyrics+翻译尺寸(500x60) | window.ts:291 |
| `window:expand-full` | on | 完整展开(860x150) | window.ts:303 |
| `window:expand-settings` | on | 展开到设置面板(860x400) | window.ts:315 |
| `window:collapse` | on | 收缩回idle(260x42) | window.ts:327 |
| `window:hide/show` | on | 隐藏/显示窗口 | window.ts:339/346 |
| `window:toggle-visibility` | handle | 切换可见性 | window.ts:353 |
| `window:get-mouse-position` | handle | 获取鼠标屏幕坐标 | window.ts:364 |
| `window:move-delta` | on | 按像素偏移移动窗口 | window.ts:369 |
| `window:get-mouse-window-state` | handle | 获取鼠标位置+窗口边界 | window.ts:382 |
| `window:get-bounds` | handle | 获取窗口边界 | window.ts:402 |
| `window:island-displays:list` | handle | 可用显示器列表 | window.ts:417 |
| `window:island-display:get/set` | handle | 灵动岛显示器选择 | window.ts:427/431 |
| `window:island-position:get/set` | handle | 灵动岛位置偏移 | window.ts:439/443 |
| `dialog:open-image` | handle | 打开图片选择对话框 | wallpaper.ts:181 |
| `dialog:open-video` | handle | 打开视频选择对话框 | wallpaper.ts:210 |
| `dialog:open-font` | handle | 打开字体选择对话框 | wallpaper.ts:239 |
| `font:read-file` | handle | 读取字体文件(base64) | wallpaper.ts:260 |
| `wallpaper:load-file` | handle | 加载壁纸文件(dataURL) | wallpaper.ts:275 |
| `wallpaper:clear-cache` | handle | 清理壁纸缓存 | wallpaper.ts:304 |
| `wallpaper:read-file-buffer` | handle | 读取文件为Uint8Array | wallpaper.ts:319 |
| `wallpaper:system:set` | handle | 设置Windows桌面壁纸 | wallpaper.ts:332 |
| `album:load-thumbnail` | handle | 生成相册缩略图 | wallpaper.ts:292 |
| `capture-desktop-sources` | handle | 获取桌面捕获源 | capture.ts:404 |
| `capture-longshot-frame` | handle | 长截图单帧捕获(desktopCapturer) | capture.ts:419 |
| `capture-longshot-gdi` | handle | 长截图GDI抓屏(BitBlt) | capture.ts:494 |
| `capture-ls-autoscroll` | handle | 长截图自动滚动控制 | capture.ts:573 |
| `capture-ls-active` | on | 长截图激活状态 | capture.ts:587/854 |
| `capture-complete` | on | 截图完成回调 | capture.ts:592 |
| `capture-ocr-local` | handle | 本地OCR(tesseract.js) | capture.ts:602 |
| `capture-ocr` | handle | 云端OCR | capture.ts:630 |
| `capture-translate` | handle | 截图翻译(云端) | capture.ts:653 |
| `capture-translate-local` | handle | 截图翻译(本地) | capture.ts:680 |
| `capture-translate-text` | handle | 文本翻译 | capture.ts:706 |
| `capture-longshot-editor` | on | 长截图编辑器 | capture.ts:1021 |
| `capture-save` | on | 保存截图 | capture.ts:1090 |
| `capture-longshot-save` | on | 保存长截图(多帧拼接) | capture.ts:1122 |
| `capture-cancel` | on | 取消截图 | capture.ts:1136 |
| `capture-record-save` | handle | 保存录屏 | capture.ts:1195 |
| `settings:preview` | handle | 实时预览广播(不持久化) | broadcast.ts |

---

## 3. 灵动岛状态机说明

### 3.1 状态列表（13个运行时状态）

> 来源：`src/renderer/store/types/index.ts:35`（`IslandState` 类型）+ `src/renderer/store/constants/islandTransition.ts`（尺寸定义）

| 状态 | 尺寸(W×H) | 面积 | 鼠标穿透 | UI 内容 |
|---|---|---|---|---|
| **idle** | 260×42 | 10920 | 启用 | 时间/日期/天气图标/计时器/番茄钟（紧凑胶囊） |
| **hover** | 500×60 | 30000 | 禁用 | 多标签页：time(控制中心)/lyrics/weather/xiyue(汐月Agent)/pomodoro/custom(自定义URL页) |
| **expanded** | 860×150 | 129000 | 禁用 | 完整操作面板，标签：hover/tools/translation/performanceMonitor |
| **maxExpand** | 860×400 | 344000 | 禁用 | 全功能面板，15个标签：aiChat/todo/urlFavorites/localFileSearch/clipboardHistory/album/mail/memo/countdown/alarm/toolbox/miniGame/stock/cli/settings |
| **notification** | 500×88 | 44000 | 禁用 | 通知卡片：标题/正文/图标，支持11种类型（default/source-switch/update-*/weather-alert/clipboard-url/restart/external-agent-*/cli-session-detected） |
| **lyrics** | 500×42 | 21000 | 启用 | 单行同步歌词（滚动显示当前行） |
| **lyricsTranslation** | 500×60 | 30000 | 启用 | 歌词+翻译双行显示 |
| **guide** | 860×400 | 344000 | 禁用 | 首次启动引导（9个子页面：welcome/language/shape/theme/lyric-mode/smtc-test/smtc-white-list/update/sponsors/github） |
| **announcement** | 860×400 | 344000 | 禁用 | 公告展示页 |
| **agentVoiceInput** | 500×42 | 21000 | 启用 | Agent语音输入录音状态（波形动画） |
| **agent** | 500×88 | 44000 | 禁用 | AI Agent紧凑条：输入球+思考/待办过程组件 |
| **stt** | 500×88 | 44000 | 禁用 | 语音转文字结果展示 |
| **cli** | 500×88 | 44000 | 禁用 | CLI Agent（Claude Code/Codex）会话检测状态 |

**类型定义中存在但无独立目录的状态**（均为860×400，复用maxExpand渲染）：`minimal`、`login`、`register`、`resetPassword`、`setPassword`、`bindOAuth`、`bindEmail`、`payment`、`musicProvidersLogin`。

### 3.2 状态转换关系

> 来源：`src/renderer/store/slices/islandSlice.ts`（setter函数）+ `src/renderer/components/hooks/useIslandHoverInteraction.ts`（鼠标交互驱动）

```
                        ┌─────────────────────────────────────────────┐
                        │              事件驱动通知                    │
                        │  (toast/update/clipboardURL/                 │
                        │   externalAgent/cliSession)                  │
                        └──────────┬──────────────────────────────────┘
                                   │ setNotification()
                                   ▼
  ┌──────┐  mouse enter   ┌───────┐  click   ┌──────────┐  nav→settings  ┌───────────┐
  │ idle │◄──────────────►│ hover │─────────►│ expanded │───────────────►│ maxExpand │
  └──┬───┘  mouse leave   └───┬───┘          └────┬─────┘                └─────┬─────┘
     │                        │                    │                            │
     │ click                  │ lyrics tab         │ ESC / back                 │ ESC
     │ (idleClickExpand)      ▼                    ▼                            ▼
     │                  ┌──────────┐         (回idle)                       (回idle)
     │                  │  lyrics  │◄──── music playing + lyrics enabled
     │                  └────┬─────┘
     │                       │ mouse enter → hover(lyrics tab)
     │                       ▼
     │                  ┌──────────────────┐
     │                  │ lyricsTranslation │
     │                  └──────────────────┘
     │
     │  voice hotkey hold      ┌──────────────────┐
     ├────────────────────────►│ agentVoiceInput  │
     │                          └────────┬─────────┘
     │                                   │ release → STT
     │                                   ▼
     │                             ┌──────────┐
     │                             │   stt    │
     │                             └────┬─────┘
     │                                  │ confirm → Agent
     │                                  ▼
     │                             ┌──────────┐
     │                             │  agent   │
     │                             └──────────┘
     │
     │  first launch          ┌───────┐
     ├───────────────────────►│ guide │
     │                        └───────┘
     │
     │  startup announcement  ┌──────────────┐
     └───────────────────────►│ announcement │
                              └──────────────┘

  全局约束：
  - uiStateLocked=true 时，禁止所有状态切换（除非切换到同一状态）
  - setIdle() 非强制调用时，从 expanded/maxExpand/guide/announcement 不会自动回 idle
  - setIdle(force=true) 可覆盖上述锁定
  - 缩小切换时，旧画布保留 getIslandMorphDuration() 毫秒（防止内容被裁剪）
  - 动画速度：slow=1100ms / medium=700ms / fast=360ms
```

**转换触发源**（已查证）：
- **鼠标进入/离开**：`useIslandHoverInteraction.ts` 管理 enterTimer/leaveTimer，pill模式强制click-to-hover
- **点击**：`handleIslandClick` 在 coordinator 中，根据当前状态决定 expand→maxExpand 或 idle→expanded
- **音乐事件**：`useIslandNowPlayingSync` 订阅 `onNowPlayingInfo`，播放时自动切 lyrics/lyricsTranslation
- **通知事件**：`useIslandNotificationSubscriptions` 订阅 toast/update/clipboardURL/externalAgent，触发 setNotification
- **语音流程**：hotkey hold → agentVoiceInput → release → stt → confirm → agent
- **CLI检测**：`useClaudeCliSessionStatus` 检测到 Claude Code/Codex 会话 → setCli + 全屏光效
- **ESC键**：`useIslandEscapeNavigation` 逐级回退（maxExpand→expanded→idle）

---

## 4. 渲染层状态管理说明

> 来源：`src/renderer/store/slices/index.ts` + `src/renderer/store/types/index.ts`

### 4.1 Store 架构

```
useIslandStore (zustand create)
├── createIslandSlice       # UI状态机核心
├── createWeatherSlice      # 天气数据
├── createTimerSlice        # 倒计时/计时器
├── createNotificationSlice # 通知数据（注：与islandSlice.notification存在冗余）
├── createMediaSlice        # 媒体/歌词/播放
├── createAiSlice           # AI配置/对话
└── createPomodoroSlice     # 番茄钟
```

### 4.2 各 Slice 职责

| Slice | 关键状态 | 关键方法 | 持久化 |
|---|---|---|---|
| **islandSlice** | `state`(IslandState), `uiStateLocked`, `hoverTab`, `expandTab`, `maxExpandTab`, `notification`, `sttText`, `agentPrompt`, `springAnimation`, `animationSpeed`, `shapeMode`, `customPages`, `controlCenterButtons`, `cliProvider`, `musicProviderLogin` | `setIdle/setHover/setExpanded/setMaxExpand/setLyrics/setLyricsTranslation/setNotification/setGuide/setAnnouncement/setAgentVoiceInput/setStt/setAgent/setCli`, `toggleUiStateLock`, 标签页切换, 自定义页面CRUD | customPages/controlCenterButtons → storeWrite; cliProvider → localStorage |
| **weatherSlice** | `weather`(WeatherData), `location`, `lastRefreshAt` | `setWeather`, `fetchWeatherData`(读缓存→定位→获取→写缓存，5分钟节流) | 配置通过 storeWrite 持久化 |
| **timerSlice** | `countdown`(目标日期/标签/启用), `timerData`(state/remainingSeconds/输入) | `setCountdown`, `setTimerData` | [推断] 通过 store 持久化 |
| **notificationSlice** | `notification`(NotificationData) | （仅状态，无方法——与islandSlice.notification重复） | 无 |
| **mediaSlice** | `isMusicPlaying`, `isPlaying`, `lrcMode`, `currentDurationMs`, `currentPositionMs`, `currentLyricText`, `mediaInfo`, `nearbyLyrics`, `coverImage`, `dominantColor`(RGB), `syncedLyrics`(逐字音节), `translationLyrics`, `lyricsLoading` | `updateLrcData`, `onMediaChanged`, `setPlaybackState`, `setLrcMode`, `updateProgress`, `setCoverImage`, `setDominantColor`, `handleNowPlayingUpdate`, `setSyncedLyrics`, `setTranslationLyrics` | 无（运行时状态） |
| **aiSlice** | `aiConfig`(apiKey/endpoint/model/ollama/customApi/skills/workspaces/STT Orb等), `aiChatSessions`, `activeAiChatSessionId`, `aiChatMessages`, `aiChatStreaming`, `aiWebAccessPrompt` | `setAiConfig`, 会话CRUD, `setAiChatStreaming`, `markAiChatSessionReplyFinished`, Web访问提示管理 | aiConfig/chatSessions/messages → localStorage (4个key) |
| **pomodoroSlice** | `pomodoroPhase`(work/shortBreak/longBreak), `pomodoroRemaining`, `pomodoroRunning`, `pomodoroCompletedCount` | `setPomodoroPhase/Remaining/Running/CompletedCount` | 无（运行时状态） |

### 4.3 持久化机制

- **主进程侧**：`userData/eIsland_store/` 目录下 JSON 文件，通过 `store:read/store:write` IPC 访问
- **渲染侧**：`localStorage` 用于 AI 配置/对话（`eIsland_aiConfig` 等4个key）、CLI provider（`eisland-cli-provider`）
- **配置同步**：`useIslandSettingsSync` Hook 订阅 `onSettingsChanged` 广播，主进程配置变更实时推送渲染层

---

## 5. 原生插件清单

> 来源：`plugins/` 目录（14个）+ 各插件 `package.json` + 源码文件检测
> 所有插件通过 `file:` 协议在 package.json 中声明为本地依赖（12个直接依赖，volume-analyzer在build脚本中，hardware-info-helper为孤儿）

### 5.1 C# Native AOT + koffi FFI 加载（9个）

> 实现方式：C# 编译为 Native AOT DLL（net10.0-windows10.0.19041.0, win-x64），JS 侧通过 `ffi-loader.js` 使用 `koffi` 加载 DLL 并定义 C 函数签名。`asarUnpack` 确保 DLL 不被打包进 asar。

| # | 插件名 | 版本 | 功能 | C#文件数 | 关键文件 |
|---|---|---|---|---|---|
| 1 | `@eisland/windows-application-icon-helper` | 26.0.1 | 按名称/PID/路径提取Windows应用/进程图标 | 5 | `src/*.cs`, `ffi-loader.js` |
| 2 | `@eisland/windows-bluetooth-helper` | 26.0.0 | 蓝牙设备枚举与实时监控 | 15 | `src/*.cs` (2个csproj) |
| 3 | `@eisland/windows-brightness-helper` | 26.0.3 | 屏幕亮度查询/控制（WMI + DDC/CI），WMI事件监控 | 7 | `src/*.cs` |
| 4 | `@eisland/windows-power-helper` | 26.0.0 | 电池状态与电源事件监控 | 14 | `src/*.cs` (2个csproj) |
| 5 | `@eisland/windows-screenshot-helper` | 26.0.2 | 高性能屏幕截图（Native AOT DLL + JS FFI） | 7 | `src/*.cs`, `ffi-loader.js` |
| 6 | `@eisland/windows-smtc-helper` | 26.0.0 | SMTC一体化：播放控制/状态/实时会话监控 | 14 | `src/*.cs`, `ffi-loader.js`, `smtc-monitor.js` |
| 7 | `@eisland/windows-volume-analyzer` | 26.0.2 | 进程级音频分析：频谱/振幅/节拍检测（WASAPI loopback） | 12 | `src/*.cs` |
| 8 | `@eisland/windows-volume-helper` | 26.0.3 | 默认播放设备音量查询/控制/监控（Core Audio COM） | 8 | `src/*.cs` |
| 9 | `@eisland/windows-wifi-helper` | 26.0.0 | WiFi连接状态与事件监控 | 14 | `src/*.cs` (2个csproj) |

### 5.2 C/C++ node-gyp N-API 加载（4个）

> 实现方式：C/C++ 源码通过 `binding.gyp` + node-gyp 编译为 `.node` 原生模块，直接 `require()` 加载。

| # | 插件名 | 版本 | 功能 | 语言 | 关键文件 |
|---|---|---|---|---|---|
| 10 | `@eisland/windows-fullscreen-detector` | 26.0.1 | 多显示器前台全屏窗口检测 | C | `binding.gyp`, `src/*.c`, `build/Release/*.node` |
| 11 | `@eisland/windows-performance-monitor` | 26.0.2 | 低开销CPU/内存/温度性能快照 | C# + C混合 | `binding.gyp`, `src/*.c`(2), `src/*.cs`(8), `*.node` |
| 12 | `@eisland/windows-processes-attacker` | 26.0.0 | 按名称/PID关闭进程 | C | `binding.gyp`, `src/*.c`(5), `*.node` |
| 13 | `@eisland/windows-toast-listener` | 26.0.0 | 通知中心Toast变更监听 | C++ + C | `binding.gyp`, `src/*.cpp`(3), `*.node` |

### 5.3 孤儿插件（1个）

| # | 插件名 | 版本 | 功能 | 语言 | 状态 |
|---|---|---|---|---|---|
| 14 | `@eisland/windows-hardware-info-helper` | 26.0.1 | 硬件信息查询（WMI EXE helper） | C# | **不在package.json依赖中，不在plugins:build脚本中**——疑似遗留/实验性 |

### 5.4 加载方式总结

| 加载方式 | 数量 | 插件 |
|---|---|---|
| C# Native AOT DLL + koffi FFI | 9 | icon/bluetooth/brightness/power/screenshot/smtc/volume-analyzer/volume/wifi |
| C/C++ node-gyp N-API (.node) | 4 | fullscreen/performance-monitor/processes/toast |
| 孤儿（未集成） | 1 | hardware-info |

**注入方式**：全部通过 `package.json` 的 `file:plugins/<name>` 本地依赖声明，`npm install` 时创建符号链接到 `node_modules/@eisland/`。`electron-builder.json` 的 `asarUnpack` 配置确保 `.node` 文件和 Native AOT DLL 不被压缩进 asar。

---

## 6. 构建与测试说明

### 6.1 构建流程

> 来源：`package.json` scripts + `electron.vite.config.ts` + `electron-builder.json`

| 命令 | 作用 | 细节 |
|---|---|---|
| `npm run dev` | 开发模式 | `electron-vite dev`：main/preload/renderer 三端 HMR，sourcemap=inline |
| `npm run build` | 编译 | `electron-vite build`：输出到 `out/main/`、`out/preload/`、`out/renderer/` |
| `npm run preview` | 预览 | `electron-vite preview`：预览生产构建 |
| `npm run package` | 打包安装包 | `electron-vite build && electron-builder`：NSIS安装包输出到 `dist/` |
| `npm run plugins:build` | 编译所有原生插件 | `run-s` 串行执行13个插件的build（C# dotnet publish + node-gyp rebuild） |
| `npm run plugins:clean` | 清理插件 | `run-p` 并行清理 |
| `npm run postinstall` | 安装后钩子 | `electron-builder install-app-deps`：为Electron重建原生模块 |
| `npm run test` | 运行测试 | `vitest run` |
| `npm run test:coverage` | 覆盖率 | `vitest run --coverage`（v8 provider） |

**Renderer 多入口**（6个HTML，已查证 `electron.vite.config.ts:65-71`）：
1. `DynamicIslandIndex.html` — 主灵动岛
2. `DynamicIslandStandalone.html` — 独立窗口（倒数日/TODO）
3. `DynamicIslandSettings.html` — 设置窗口
4. `DynamicIslandAibackground.html` — Agent语音输入全屏光效
5. `DynamicIslandSplash.html` — 启动动画
6. `DynamicIslandGuide.html` — 引导窗口

**Main 多入口**（2个）：`index`（主进程）+ `smtcWorker`（SMTC监听Worker线程）

**打包配置**（`electron-builder.json`）：
- appId: `com.xiyue.app`，productName: `汐月`
- 目标：NSIS x64，`${productName}-${version}-Setup.exe`
- asarUnpack：`@eisland/**/bin/Release/**`、`@eisland/**/*.node`、`koffi/**`
- extraResources：icon/capture.html/pin.html/qishui-auth/netease-watcher/ffmpeg.exe/brightness&volume helper DLL
- 自动更新：generic provider，URL `https://pub-4c1e73c3c2004901aecd6ca014cb16bd.r2.dev`（Cloudflare R2）

### 6.2 测试

> 来源：`vitest.config.ts` + 全量 test 目录扫描

- **测试框架**：Vitest 4.1.10，node 环境
- **测试文件数**：**129个** `.test.ts` 文件（已查证，`src/**/*.test.ts`）
- **测试目录数**：55个 `test/` 目录
- **覆盖率工具**：`@vitest/coverage-v8`
- **测试分布**：

| 区域 | 测试目录数 | 覆盖内容 |
|---|---|---|
| 主进程 main/ | 17 | config/downloadEngine(utils+config)/ipc(6域)/log/music(含qishuiAudio)/services/system/utils/installer/clipboard/core |
| 渲染层 renderer/ | 38 | store(slices/constants/utils)/api(ai/lyrics/miniGame/weather)/components(states/hooks/config)/utils(audio/theme/security/SvgIcon/GifIcon/logger)/i18n/assets |

**[推断]** 测试主要集中在工具函数、配置解析、歌词解析、store slice 逻辑等纯函数模块；UI 组件（React TSX）和 IPC 集成测试较少。未实际运行 `test:coverage`，无法给出具体覆盖率百分比。

---

## 7. 关键功能实现方式

### 7.1 音乐播放与 SMTC 集成

> 来源：`src/main/music/smtcService.ts` + `src/main/smtcWorker.ts` + `src/main/music/neteaseWatcher*.ts` + `plugins/eisland-windows-smtc-helper/`

**架构**（三层）：

1. **原生层**：`@eisland/windows-smtc-helper`（C# Native AOT DLL），通过 koffi FFI 调用 Windows SMTC API，提供 `SmtcMonitor`（会话监控）、`play/pause/next/prev/seek`（播放控制）、`getTimestamp`（时间戳）
2. **Worker 层**：`smtcWorker.ts` 运行在 `worker_threads` 中，持有 `SmtcMonitor` 实例，缓存所有媒体会话（media/playback/timeline），通过 `parentPort.postMessage` 推送 `session-update` 事件到主进程。**避免 SMTC 回调阻塞主进程事件循环**
3. **服务层**：`smtcService.ts` 管理：
   - 会话运行时（`Map<deviceId, SmtcSessionRuntimeEntry>`）
   - 白名单过滤（仅白名单内的播放器触发灵动岛歌词状态）
   - 播放源切换检测（新源开始播放 → 推送 `media:source-switch-request` 通知 → 用户 accept/reject）
   - 自动取消订阅（可配置超时，0=永不）
   - 运行时清理（`SMTC_RUNTIME_CLEANUP_INTERVAL_MS` 周期清理过期会话）

**网易云音乐特殊处理**（已查证 README + 源码）：
- 网易云的 SMTC 会话**无时间轴信息**，UIA 无障碍树为空
- 解决方案：`netease-watcher`（**Rust 编写的独立进程**，位于 `resources/netease-watcher/`）通过钩子注入获取真实播放进度/歌曲ID，通过本地 **WebSocket `/ws`** 推送给主进程
- `neteaseWatcherLauncher.ts` 负责随应用启动/停止该进程
- `neteaseWatcher.ts` 订阅 WebSocket 消息，补充 SMTC 缺失的 position_ms 和 songId

**播放控制**：`media:play-pause/next/prev/seek` IPC → 主进程 → `@eisland/windows-smtc-helper` 的 `play()/pause()/next()` 等导出函数（直接在 `index.ts:87` import）

### 7.2 歌词显示

> 来源：`src/renderer/api/lyrics/` + `src/renderer/store/slices/mediaSlice.ts` + `src/renderer/components/states/lyrics/`

**歌词获取**（多源回退链，已查证 `lrcs/index.ts`）：
- 支持 **8个歌词源**：netease / qqmusic / kugou / sodamusic / applemusic / spotify / moekoe / lrclib（兜底）
- 按 SMTC 进程名自动选择首选源，多级回退
- 普通歌词（LRC）和逐字歌词（Karaoke）两套体系
- **逐字歌词**：支持 QRC（QQ音乐加密格式，含 `decrypt/qrc.ts` + `qrcDes.ts`）、KRC（酷狗加密，`decrypt/krc.ts`）、TTML（Apple Music，`parsers/ttml.ts`），解密后得到逐音节时间偏移，用于"扫光"效果
- 翻译歌词：`translation.ts`，部分源支持（netease/qqmusic/sodamusic），不支持时返回 `unsupportedTranslationLyrics`

**歌词渲染**：
- `lyrics` 状态（500×42）：单行滚动显示当前歌词
- `lyricsTranslation` 状态（500×60）：原文+翻译双行
- `hover` 状态的 lyrics 标签页：完整歌词列表
- 逐字扫光：`SyncedLyricSyllable` 数组驱动，按 `start_offset_ms` + `duration_ms` 渲染

**歌词校准**：
- `smtc:get-timestamp` 获取轻量级播放位置
- 可配置校准延迟（默认20秒触发，`music:lyrics-calibrate-delay`）
- 网易云使用 netease-watcher 的真实进度

### 7.3 长截图功能

> 来源：`src/main/ipc/window/capture.ts`（1200+行）+ `resources/capture.html/js/css`

**模块位置**：`src/main/ipc/window/capture.ts`，通过 `captureWindowService`（`src/main/window/captureWindow.ts`）管理截图覆盖窗口

**实现方式**（双引擎）：

1. **Electron desktopCapturer 方式**（`capture-longshot-frame`）：
   - `desktopCapturer.getSources({types:['screen']})` 获取屏幕缩略图
   - 按选区 crop，返回 dataURL
   - **缺点**：每次调用 600~900ms，主进程阻塞

2. **GDI BitBlt 方式**（`capture-longshot-gdi`，**首选**）：
   - 通过 `koffi` 直接 FFI 调用 `user32.dll` + `gdi32.dll`
   - 函数链：`GetDC → CreateCompatibleDC → CreateCompatibleBitmap → SelectObject → BitBlt → GetDIBits → DeleteObject`
   - **毫秒级**抓屏，避免主进程阻塞
   - 返回 BGRA raw 像素数据

**长截图流程**：
- `capture-ls-autoscroll`：控制鼠标滚轮自动滚动（start/stop/step，可配 intervalMs 和 delta）
- 每帧通过 GDI 抓取选区内容
- `capture-longshot-save`：将多帧图片拼接为长图
- `capture-longshot-editor`：截图后编辑器（标注/裁剪）
- 截图覆盖层由 `resources/capture.html` + `capture.js` + `capture.css` 实现（独立 BrowserWindow）

**其他截图能力**：区域截图、全屏截图、OCR（本地tesseract.js + 云端）、截图翻译（本地+云端）、录屏（`capture-record-save`）

### 7.4 下载引擎（downloadEngine）

> 来源：`src/main/core/downloadEngine.ts`（449行）+ `src/main/core/downloadEngine/config/` + `utils/`

**类**：`MultiThreadDownloadEngine`

**核心机制**：
1. **探测阶段**：HEAD 请求获取 `Content-Length` 和 `Accept-Ranges`，推断文件名（URL path / Content-Disposition）
2. **分块**：`buildChunks()` 将文件按 `threads`（默认归一化后线程数）切分为多个字节区间
3. **并发下载**：每个 chunk 一个 `fetch` + `AbortController`，写入独立 `.part` 文件
4. **临时目录**：`.eisland-download-<uuid>/` 存放 part 文件和临时输出
5. **合并**：`mergePartFiles()` 按序拼接所有 part → `rename` 为目标文件
6. **进度上报**：采样计算 `speedBytesPerSecond` + `estimatedFinishAt`，按 `EMIT_INTERVAL_MS` 节流 emit
7. **控制**：`cancelDownload`（abort所有controller）、`pauseDownload`、`resumeDownload`（利用Range断点续传）

**IPC 接口**：`download:start/cancel/pause/resume/remove/list/get/pick-save-path/get-default-dir`，进度通过 `download:task-updated` 事件推送

### 7.5 通知系统

> 来源：`src/renderer/store/slices/islandSlice.ts`（setNotification）+ `src/renderer/components/hooks/useIslandNotificationSubscriptions.ts` + `src/renderer/components/states/notification/`

**通知类型**（11种，已查证 `NotificationData.type`）：
`default` / `source-switch` / `update-available` / `update-downloading` / `update-ready` / `weather-alert-startup` / `clipboard-url` / `restart-required` / `external-agent-active` / `external-agent-stopped` / `cli-session-detected`

**触发源**：
- Windows Toast 通知 → `@eisland/windows-toast-listener`（node-gyp C++）监听通知中心
- 播放源切换 → SMTC service 检测到新源
- 应用更新 → electron-updater 事件
- 剪贴板URL → `clipboard/urlWatcher.ts` 监听剪贴板变化
- 外部Agent → `externalAgentWatcher.ts` 检测 Claude/Codex 等进程
- CLI会话 → `claudeCodeStatusService` / `codexStatusService` 钩子事件

**行为**：setNotification 时展开到 notification 尺寸（500×88），播放通知音效（`playNotificationSoundOnce`，cli-session-detected 类型除外），自动超时回 idle

---

## 8. 已发现的问题与技术债务

### 8.1 已查证的问题

| # | 问题 | 严重度 | 位置/证据 |
|---|---|---|---|
| 1 | **插件命名不一致**：项目已改名 xiyue，但14个插件仍保留 `eisland-windows-*` 前缀，`appUserModelId` 仍为 `com.eisland.app`（index.ts:862），store目录仍为 `eIsland_store`（index.ts:573），自定义协议仍为 `eisland-media://` / `eisland-qishui://` | 中 | 全局历史遗留 |
| 2 | **stub 实现**：`media:get-volume` 硬编码返回 `0.5`（media.ts:125），`media:set-volume` 为空函数（media.ts:127） | 低 | ipc/media/media.ts |
| 3 | **notificationSlice 冗余**：`notificationSlice` 仅有一个 `notification` 状态且无任何方法，与 `islandSlice.notification` 完全重复，两者同时存在于 store | 低 | store/slices/notificationSlice.ts + islandSlice.ts:71 |
| 4 | **孤儿插件**：`eisland-windows-hardware-info-helper` 存在于 plugins/ 目录且有 package.json，但不在 `package.json` dependencies 中，也不在 `plugins:build` 脚本中 | 低 | plugins/ + package.json |
| 5 | **巨型文件**：`ipc/app/app.ts` 2500+行，`ipc/window/capture.ts` 1200+行，`preload/index.ts` 1962行，`main/index.ts` 1056行——单文件职责过重 | 中 | 多个文件 |
| 6 | **README 版本徽章过时**：README.md:9 显示 Electron 35 徽章，实际 package.json 为 Electron 43.4.0 | 低 | README.md:9 |
| 7 | **Node 版本要求激进**：`engines.node >=25.0.0`，Node 25 为当前最新版，兼容性风险 | 中 | package.json:9 |
| 8 | **TypeScript 7.0.2**：非稳定版（TS 最新稳定为5.x），可能存在类型检查兼容性问题 | 中 | package.json:132 |
| 9 | **预加载 API 过于庞大**：`window.api` 暴露约150个方法，全部在一个1962行文件中，缺乏模块化拆分 | 中 | preload/index.ts |
| 10 | **electron-builder asarUnpack 过宽**：`node_modules/koffi/**/*` 整个 unpack，可能包含不必要文件 | 低 | electron-builder.json:15 |

### 8.2 推断的潜在问题

| # | 问题 | 依据 |
|---|---|---|
| 1 | **测试覆盖率可能偏低**：129个测试文件但主要集中在纯函数模块，UI组件和IPC集成测试缺失；未运行 coverage 无法确认 | 测试目录分布分析 |
| 2 | **SMTC Worker 内存泄漏风险**：`sessionCache`（smtcWorker.ts:40）是无限增长的 Map，依赖主进程 cleanup 清理，异常退出可能残留 | smtcWorker.ts 源码结构 |
| 3 | **长截图 GDI 资源泄漏**：`capture-longshot-gdi` 中 GetDC/CreateCompatibleDC/CreateCompatibleBitmap 需严格配对 ReleaseDC/DeleteDC/DeleteObject，异常路径可能泄漏 GDI 句柄 | capture.ts:452-478 FFI 定义 |
| 4 | **Python 侧车进程管理**：`xiyueAgentService` 通过 child_process 拉起 Python server.py，崩溃重启策略未在调查中确认 | README 描述 + index.ts:865 |
| 5 | **多窗口内存占用**：启动后6秒预创建 standaloneWindow（index.ts:944-952），注释说明约50-150MB常驻，低配设备可能有压力 | index.ts:941-952 注释 |

---

## 附录：关键数字实测

| 指标 | 值 | 来源 |
|---|---|---|
| 项目版本 | 26.7.4 | package.json:3 |
| Electron 版本 | 43.4.0 | package.json:121 |
| React 版本 | 19.2.8 | package.json:129 |
| TypeScript 版本 | 7.0.2 | package.json:132 |
| Vite 版本 | 7.3.6 | package.json:133 |
| zustand 版本 | 5.0.15 | package.json:103 |
| Tailwind 版本 | 4.3.3 | package.json:131 |
| Node 要求 | >=25.0.0 | package.json:9 |
| 主进程入口行数 | 1056 | src/main/index.ts |
| 预加载行数 | 1962 | src/preload/index.ts |
| IPC channel 总数 | ~180+ | 6域grep统计 |
| 灵动岛状态数 | 13（运行时）+ 9（类型定义） | store/types/index.ts:35 |
| zustand slice 数 | 7 | store/slices/index.ts:37-45 |
| 原生插件数 | 14（目录）/ 13（build脚本）/ 12（deps） | plugins/ + package.json |
| C# FFI 插件 | 9 | 源码检测 |
| node-gyp C/C++ 插件 | 4 | 源码检测 |
| 孤儿插件 | 1 | hardware-info-helper |
| 测试文件数 | 129 | src/**/*.test.ts |
| 测试目录数 | 55 | test/ 目录统计 |
| i18n 语言数 | 2（zh-CN / en-US） | i18n/ 目录 |
| Renderer HTML 入口 | 6 | electron.vite.config.ts:65-71 |
| 灵动岛基础尺寸 | 260×42 | shared/islandDimensions.ts:22-23 |
| 歌词源数量 | 8 | lrcs/index.ts:54 |
| 设置子页面数 | 11 | maxExpand/setting/components/ |
| MaxExpand 标签数 | 15 | store/types/index.ts:76 |
| Hover 标签数 | 6+自定义 | store/types/index.ts:44 |

---

*报告结束。所有标注"已查证"的结论均有对应源码文件和行号依据；标注"推断"的为基于代码结构的合理推测，未经运行时验证。*
