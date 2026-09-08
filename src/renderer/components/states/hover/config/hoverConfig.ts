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
 * @file hoverConfig.ts
 * @description Hover 状态配置
 * @author 鸡哥
 */

import type { CustomPageDef, HoverTab } from '../../../../store/types';

/**
 * Hover 导航布局配置（页面顺序 / 显隐可配置，原则 A 前半）。
 * 默认顺序：time / lyrics / weather / xiyue / pomodoro / expand
 * 其中 expand 为末位"进入大面板"动作点，始终可见，不计入可配置页面白名单。
 */

export interface HoverNavItem {
  id: HoverTab;
  visible: boolean;
}
export type HoverNavLayoutConfig = HoverNavItem[];

export const HOVER_NAV_LAYOUT_STORE_KEY = 'hover-nav-layout';
/** 用户自定义页面存储键（原则 A 后半） */
export const HOVER_CUSTOM_PAGES_STORE_KEY = 'hover-custom-pages';

/** 可配置页面白名单（expand 除外，它永远是末位动作点） */
export const HOVER_CONFIGURABLE_TABS: HoverTab[] = ['time', 'lyrics', 'weather', 'xiyue', 'pomodoro'];

/** 始终可见的导航点（动作入口，不可隐藏） */
export const HOVER_ALWAYS_VISIBLE_TABS = new Set<HoverTab>(['expand']);

export const HOVER_TAB_LABELS: Record<string, string> = {
  time: '工具',
  lyrics: '歌曲',
  weather: '天气',
  xiyue: '汐月',
  pomodoro: '番茄钟',
  expand: '展开',
};

export const DEFAULT_HOVER_NAV_LAYOUT: HoverNavLayoutConfig = HOVER_CONFIGURABLE_TABS.map((id) => ({ id, visible: true }));

/**
 * 归一化用户配置的 hover 导航布局：过滤非法 id、去重、补全缺失项。
 */
export function normalizeHoverNavLayoutConfig(raw: unknown): HoverNavLayoutConfig {
  if (!Array.isArray(raw)) return DEFAULT_HOVER_NAV_LAYOUT.map((x) => ({ ...x }));
  const seen = new Set<string>();
  const result: HoverNavLayoutConfig = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const id = (item as { id?: unknown }).id;
    if (typeof id !== 'string' || !HOVER_CONFIGURABLE_TABS.includes(id as HoverTab)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push({ id: id as HoverTab, visible: (item as { visible?: unknown }).visible !== false });
  }
  for (const id of HOVER_CONFIGURABLE_TABS) {
    if (!seen.has(id)) result.push({ id, visible: true });
  }
  return result;
}

/** 取可见页面 id 列表（不含 expand） */
export function getHoverVisiblePageTabs(config: HoverNavLayoutConfig): HoverTab[] {
  return config.filter((i) => i.visible).map((i) => i.id);
}

/**
 * 归一化用户自定义页面列表（原则 A 后半）。
 * 过滤非法项、去重，补全默认值；template 仅允许 'url' | 'blank'。
 */
export function normalizeCustomPages(raw: unknown): CustomPageDef[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const result: CustomPageDef[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const obj = item as { id?: unknown; title?: unknown; template?: unknown; url?: unknown };
    const id = obj.id;
    if (typeof id !== 'string' || !id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    const title = typeof obj.title === 'string' && obj.title ? obj.title : id;
    const template = obj.template === 'blank' ? 'blank' : 'url';
    const url = typeof obj.url === 'string' ? obj.url : undefined;
    result.push({ id, title, template, url });
  }
  return result;
}

/** 兼容旧的硬编码序列（默认顺序 + 末位 expand） */
export const NAV_DOTS: HoverTab[] = [...HOVER_CONFIGURABLE_TABS, 'expand'];

/* eslint-disable */
// 旧常量别名，仅供渐进迁移期间引用
export const DEFAULT_HOVER_NAV_DOTS = NAV_DOTS;

