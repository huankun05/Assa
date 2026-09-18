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
 * @file standaloneWindowTabs.ts
 * @description 独立窗口标签页配置。
 * @author 鸡哥
 */

import type { WindowTab } from './standaloneWindowTypes';

export const VALID_TABS = new Set<WindowTab>(['todo', 'countdown', 'urlFavorites', 'mail', 'localFileSearch', 'clipboardHistory', 'memo', 'alarm', 'toolbox', 'chat', 'translate', 'customPages']);

export const TAB_LIST: { key: WindowTab; labelKey: string }[] = [
  { key: 'todo', labelKey: 'standalone.tabs.todo' },
  { key: 'countdown', labelKey: 'standalone.tabs.countdown' },
  { key: 'urlFavorites', labelKey: 'standalone.tabs.urlFavorites' },
  { key: 'mail', labelKey: 'standalone.tabs.mail' },
  { key: 'localFileSearch', labelKey: 'standalone.tabs.localFileSearch' },
  { key: 'clipboardHistory', labelKey: 'standalone.tabs.clipboardHistory' },
  { key: 'memo', labelKey: 'standalone.tabs.memo' },
  { key: 'alarm', labelKey: 'standalone.tabs.alarm' },
  { key: 'toolbox', labelKey: 'standalone.tabs.toolbox' },
  { key: 'chat', labelKey: 'standalone.tabs.chat' },
  { key: 'translate', labelKey: 'standalone.tabs.translate' },
  { key: 'customPages', labelKey: 'standalone.tabs.customPages' },
];
