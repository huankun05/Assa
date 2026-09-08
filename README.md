<div align="center">
  <h1><img src="assets/eisland.svg" alt="eIsland Logo" height="32" style="vertical-align: middle;" />&nbsp;汐月 Xiyue</h1>
  <p><strong>本地常驻 AI 管家 · Dynamic Island 风格（基于 eIsland 衍生）</strong></p>
  <p>Built with Electron + React + TypeScript</p>
  <p>Supports real-time weather, synced lyrics, timers, and quick system utility actions</p>
  <p>NetEase Cloud Music login integration for accurate like status and precise lyrics matching</p>

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL--3.0-blue.svg)](LICENSE)
[![Electron](https://img.shields.io/badge/Electron-35-47848F?logo=electron\&logoColor=white)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react\&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript\&logoColor=white)](https://www.typescriptlang.org/)

</div>

***

> License note: This project is open-sourced under GPLv3 with additional clauses and supplements (see `LICENSE` for details).

## UI Preview

<div align="center">

### Overview Screen

<p>At-a-glance view of date, weather, countdowns, and quick launch tools</p>

<img src="assets/1.png" alt="Overview Screen" width="680" />

### Weather Screen

<p>Live weather and forecast with both auto-location and manual configuration</p>

<img src="assets/2.png" alt="Weather Screen" width="680" />

### Lyrics Screen

<p>Real-time synced lyrics with automatic matching from multiple lyric sources</p>

<img src="assets/3.png" alt="Lyrics Screen" width="680" />

### Settings Screen

<p>Comprehensive customization for appearance, interaction behavior, and network configuration</p>

<img src="assets/4.png" alt="Settings Screen" width="680" />

### Agent Screen

<p>Built-in AI agent workspace for intelligent assistance and streamlined productivity workflows</p>

<img src="assets/5.png" alt="Agent Screen" width="680" />

### Toolbox Screen

<p>Practical utility panel with quick-access tools and common software actions</p>

<img src="assets/6.png" alt="Toolbox Screen" width="680" />

</div>

***

## Icon Credits

All icons used in this project are sourced from [iconfont](https://www.iconfont.cn/).

## Image Credits

The following images used in this project are from the Artemis II mission:

| Wallpaper Name         | File Name                | Capture Device    | Original Link                                                    |
| ---------------------- | ------------------------ | ----------------- | ---------------------------------------------------------------- |
| Spaceship Earth        | `art002e008487~orig.jpg` | iPhone 17 Pro Max | [images.nasa.gov](https://images.nasa.gov/details/art002e008487) |
| A Crescent Earth       | `art002e004441~orig.jpg` | NIKON Z9 35mm f/2 | [images.nasa.gov](https://images.nasa.gov/details/art002e004441) |
| Thinking of You, Earth | `art002e008486~orig.jpg` | iPhone 17 Pro Max | [images.nasa.gov](https://images.nasa.gov/details/art002e008486) |

> All images are sourced from [NASA](https://www.nasa.gov/) (National Aeronautics and Space Administration)
>
> All NASA images in this repository are used under NASA's image usage policy and do not imply NASA endorsement of this project.

More Artemis II images are available at:

- <https://images.nasa.gov/>

- <https://www.nasa.gov/artemis-ii-mobile-wallpapers/>

## License & Legal

- Terms of Service: `LEGAL/TERMS_OF_SERVICE.md`

- Privacy Policy: `LEGAL/PRIVACY_POLICY.md`

- Billing & Refund Policy: `LEGAL/BILLING_REFUND_POLICY.md`

## License

This project is released under **GNU General Public License v3.0 (GPLv3)** or later (`GPL-3.0-or-later`).

Under GPLv3 Section 7(b), limited additional terms apply: the following author attributions must be retained in all copies, modified versions, and any Appropriate Legal Notices displayed by the program:

- Copyright (C) 2026-present JNTMTMTM (<https://github.com/JNTMTMTM>)

- Copyright (C) 2026-present pyisland.com (<https://pyisland.com>)

### Platform Restriction

**This software is developed exclusively for Windows. Any porting, adaptation, or redistribution targeting Apple macOS or any Apple operating system is strictly prohibited by the original author.**

This prohibition applies to all forks, derivative works, and redistributions. Any such work must retain this restriction notice in full. Violations will be subject to legal action.

For full terms (including the standard GPLv3 text and additional clauses), see the `LICENSE` file in the repository root.

***

## 汐月 Xiyue —— 衍生版说明

本仓库是 **eIsland**（[JNTMTMTM/eIsland](https://github.com/JNTMTMTM/eIsland)，GPL-3.0-or-later + 附加条款）的衍生版本，用于「汐月」本地常驻 AI 管家：

- **保留**：eIsland 全部功能（灵动岛形态、音乐/SMTC、天气、截图、OCR 等）与 13 个原生插件。

- **已完成（汐月换芯）**：

  1. **原生 Agent 换芯**：`useAgentRunner` 与 `useChatSend`（岛内紧凑条 + 完整对话页）只跑汐月 Hermes，移除 mihtnelis 云平台（含登录）、Ollama 直连、自定义 API 三路由；
  2. **Python 侧车**：`agent/server.py`（HTTP 127.0.0.1:8765）由 Electron `child_process` 拉起，`/health` `/chat` `/voice` `/transcribe` 四端点，走本地 Ollama（`qwen3-4b-32k`）+ faster-whisper + kokoro TTS，数据不出本机；
  3. **语音全本地化**：语音输入球录音 → PCM → 侧车 `/transcribe`（faster-whisper），腾讯实时 STT 已移除；回答自动 TTS 朗读（base64 直放）；
  4. **入口**：hover 灵动岛 →「汐月」导航点 → 原生 Agent 面板。

- **网易云真实进度（汐月收敛）**：网易云注册的 SMTC 无时间轴、界面 UIA 无障碍树为空，均无法提供实时播放进度。改为内置 **netease-watcher**（Rust 钩子，随应用自启自停）通过本地 **WebSocket** **`/ws`** **推送**获取真实进度/歌曲 ID，用于歌词精确对齐与喜欢状态判定；已移除窗口标题 2s 轮询（titleFallback）与 UIA 进度兜底等旧方案，避免空转轮询导致的卡顿。

- **环境**：Python 3.12 venv（`.venv/`，含全部依赖）；whisper 模型在 `data/models/faster-whisper-base/`（gitignored，需自行放入或从备份复制）；4 个 node-gyp 插件需本机 `npm run plugins:build` 编译（fullscreen/processes/toast/perfmon）。

- **合规**：保留全部上游署名（JNTMTMTM / pyisland.com）与 Windows-only 限制声明，见 `LICENSE`。

