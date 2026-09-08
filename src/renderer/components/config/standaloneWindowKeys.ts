/*
 * eIsland - A sleek, Apple Dynamic Island inspired floating widget for Windows, built with Electron.
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM[](https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file standaloneWindowKeys.ts
 * @description 独立窗口配置存储键常量定义。
 * @author 鸡哥
 */

export const ACTIVE_TAB_STORE_KEY = 'standalone-window-active-tab';
export const LEGACY_ACTIVE_TAB_STORE_KEY = 'countdown-window-active-tab';
export const AUTH_INTENT_STORE_KEY = 'standalone-window-auth-intent';
export const ISLAND_BG_OPACITY_STORE_KEY = 'island-bg-opacity';
export const ISLAND_BG_BLUR_STORE_KEY = 'island-bg-blur';
export const STANDALONE_WINDOW_MAC_CONTROLS_STORE_KEY = 'standalone-window-mac-controls';

import type { WindowTab } from './standaloneWindowTypes';
import { prefetchStandaloneTab } from '../components/StandaloneWindowViewport';

/**
 * 打开指定标签页的独立窗口（复用 StandaloneWindow 架构）。
 * 把目标标签传给主进程（主进程先切标签再显示窗口），关闭窗口即返回原上下文。
 * 同时并行预热目标标签的懒加载 chunk，减少窗口显示后的首开占位等待。
 * @param tab - 目标独立窗口标签页。
 */
export function openStandaloneTab(tab: WindowTab): void {
  prefetchStandaloneTab(tab);
  void window.api.openStandaloneWindow(tab).catch(() => {});
}
