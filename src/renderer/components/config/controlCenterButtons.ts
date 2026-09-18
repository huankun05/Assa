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
import { SvgIcon } from '../../utils/SvgIcon';

/** 控制中心按钮元数据：展示文案 + 图标（点击行为在 TimeTab 内按 id 映射） */
export const CONTROL_CENTER_BUTTON_META: Record<ControlCenterButtonId, { labelKey: string; defaultLabel: string; icon: string }> = {
  hide: { labelKey: 'hover.actions.hideIsland', defaultLabel: '隐藏灵动岛', icon: SvgIcon.HIDE },
  quit: { labelKey: 'hover.actions.quitIsland', defaultLabel: '退出灵动岛', icon: SvgIcon.POWER_OFF },
  brightness: { labelKey: 'hover.media.brightness', defaultLabel: '亮度', icon: SvgIcon.BRIGHTNESS },
  volume: { labelKey: 'hover.media.volume', defaultLabel: '音量', icon: SvgIcon.VOLUME },
  screenshot: { labelKey: 'hover.tools.screenshot', defaultLabel: '截图', icon: SvgIcon.SCREENSHOT },
  taskManager: { labelKey: 'hover.tools.taskManager', defaultLabel: '任务管理器', icon: SvgIcon.TASK_MANAGER },
  toolbox: { labelKey: 'hover.tools.toolbox', defaultLabel: '工具箱', icon: SvgIcon.PLUGIN },
  calculator: { labelKey: 'hover.tools.calculator', defaultLabel: '计算器', icon: SvgIcon.CALCULATOR },
  translate: { labelKey: 'hover.tools.translate', defaultLabel: '翻译', icon: SvgIcon.LANGUAGE },
  fileSearch: { labelKey: 'hover.tools.fileSearch', defaultLabel: '文件查找', icon: SvgIcon.SEARCH },
  managePages: { labelKey: 'hover.nav.managePages', defaultLabel: '管理页面', icon: SvgIcon.MANAGE_PAGES },
  settings: { labelKey: 'hover.nav.settings', defaultLabel: '设置', icon: SvgIcon.SETTING },
};

/** 控制中心条最大同时显示数（防溢出） */
export const CONTROL_CENTER_MAX_VISIBLE = 11;

/** 必须始终显示的入口（不可隐藏）：页面管理、设置 */
export const CONTROL_CENTER_ALWAYS_VISIBLE: readonly ControlCenterButtonId[] = [
  'managePages',
  'settings',
];

/** 控制中心按钮默认顺序与显隐（开箱全显示，按原计划书默认顺序） */
export const DEFAULT_CONTROL_CENTER_BUTTONS: ControlCenterButtonConfig[] = (
  ['hide', 'quit', 'brightness', 'volume', 'screenshot', 'taskManager', 'toolbox', 'calculator', 'translate', 'fileSearch', 'managePages', 'settings'] as ControlCenterButtonId[]
).map((id) => ({ id, visible: true }));

/**
 * 合并已存配置与默认池：老配置缺失的新按钮自动补在末尾（visible=true）。
 * 常驻入口强制 visible。
 */
export function mergeControlCenterButtons(
  stored?: ControlCenterButtonConfig[] | null,
): ControlCenterButtonConfig[] {
  const base = Array.isArray(stored) && stored.length > 0 ? stored : DEFAULT_CONTROL_CENTER_BUTTONS;
  const seen = new Set(base.map((item) => item.id));
  const missing = DEFAULT_CONTROL_CENTER_BUTTONS.filter((item) => !seen.has(item.id));
  return [...base, ...missing].map((item) => (
    CONTROL_CENTER_ALWAYS_VISIBLE.includes(item.id)
      ? { ...item, visible: true }
      : item
  ));
}

/**
 * 取条上实际渲染的可见按钮。
 * 顺序 = 页面管理列表顺序（存储顺序）；
 * 超过上限时优先保留常驻项（设置/页面管理），从其余可见项末尾裁剪。
 */
export function getVisibleControlCenterButtons(
  stored?: ControlCenterButtonConfig[] | null,
): ControlCenterButtonConfig[] {
  const visible = mergeControlCenterButtons(stored).filter((item) => item.visible);
  if (visible.length <= CONTROL_CENTER_MAX_VISIBLE) return visible;

  const always = visible.filter((item) => CONTROL_CENTER_ALWAYS_VISIBLE.includes(item.id));
  const rest = visible.filter((item) => !CONTROL_CENTER_ALWAYS_VISIBLE.includes(item.id));
  const room = Math.max(0, CONTROL_CENTER_MAX_VISIBLE - always.length);
  const keep = new Set([
    ...always.map((item) => item.id),
    ...rest.slice(0, room).map((item) => item.id),
  ]);
  return visible.filter((item) => keep.has(item.id));
}
