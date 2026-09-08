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
 * @file controlCenterButtons.ts
 * @description 控制中心（time 页）按钮池的共享元数据与默认配置。
 * 按钮的点击行为在 TimeTab 内按 id 映射到具体动作；此处仅描述展示文案与默认顺序/显隐，
 * 供 TimeTab 渲染与设置「控制中心按钮」页面共用，避免两处各自维护。
 * @author 鸡哥
 */

import type { ControlCenterButtonConfig, ControlCenterButtonId } from '../../store/types';

/** 控制中心按钮元数据：仅展示文案与 i18n key（点击行为在 TimeTab 内按 id 映射） */
export const CONTROL_CENTER_BUTTON_META: Record<ControlCenterButtonId, { labelKey: string; defaultLabel: string }> = {
  hide: { labelKey: 'hover.actions.hideIsland', defaultLabel: '隐藏灵动岛' },
  quit: { labelKey: 'hover.actions.quitIsland', defaultLabel: '退出灵动岛' },
  brightness: { labelKey: 'hover.media.brightness', defaultLabel: '亮度' },
  volume: { labelKey: 'hover.media.volume', defaultLabel: '音量' },
  screenshot: { labelKey: 'hover.tools.screenshot', defaultLabel: '截图' },
  taskManager: { labelKey: 'hover.tools.taskManager', defaultLabel: '任务管理器' },
  toolbox: { labelKey: 'hover.tools.toolbox', defaultLabel: '工具箱' },
  calculator: { labelKey: 'hover.tools.calculator', defaultLabel: '计算器' },
  translate: { labelKey: 'hover.tools.translate', defaultLabel: '翻译' },
  managePages: { labelKey: 'hover.nav.managePages', defaultLabel: '管理页面' },
  settings: { labelKey: 'hover.nav.settings', defaultLabel: '设置' },
};

/** 控制中心按钮默认顺序与显隐（开箱全显示，按原计划书默认顺序） */
export const DEFAULT_CONTROL_CENTER_BUTTONS: ControlCenterButtonConfig[] = (
  ['hide', 'quit', 'brightness', 'volume', 'screenshot', 'taskManager', 'toolbox', 'calculator', 'translate', 'managePages', 'settings'] as ControlCenterButtonId[]
).map((id) => ({ id, visible: true }));
