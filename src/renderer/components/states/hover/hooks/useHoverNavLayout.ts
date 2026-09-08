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
 * but WITHOUT ANY WARRANTY, without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file useHoverNavLayout.ts
 * @description Hover 导航布局配置加载与监听 Hook（页面顺序 / 显隐可配置，原则 A 前半）
 * @author 鸡哥
 */

import { useEffect, useState } from 'react';
import {
  HOVER_NAV_LAYOUT_STORE_KEY,
  HOVER_CUSTOM_PAGES_STORE_KEY,
  normalizeHoverNavLayoutConfig,
  normalizeCustomPages,
  getHoverVisiblePageTabs,
  NAV_DOTS,
  type HoverNavLayoutConfig,
} from '../config/hoverConfig';
import type { HoverTab } from '../../../../store/types';

/**
 * 加载并监听 Hover 导航布局配置，返回完整导航点序列（可见页面 + 自定义页 + 末位 expand 动作点）。
 * 自定义页面持久化于独立存储键 hover-custom-pages，此处合并进导航序列。
 * @returns 有序 HoverTab 序列。
 */
export function useHoverNavLayout(): HoverTab[] {
  const [tabs, setTabs] = useState<HoverTab[]>(NAV_DOTS);

  useEffect(() => {
    let cancelled = false;
    const apply = (config: HoverNavLayoutConfig, pages: ReturnType<typeof normalizeCustomPages>): void => {
      if (cancelled) return;
      const customTabs = pages.map((p) => `custom:${p.id}` as HoverTab);
      setTabs([...getHoverVisiblePageTabs(config), ...customTabs, 'expand']);
    };
    const load = (): void => {
      if (cancelled) return;
      window.api.storeRead(HOVER_NAV_LAYOUT_STORE_KEY).then((navData: unknown) => {
        const config = normalizeHoverNavLayoutConfig(navData);
        window.api.storeRead(HOVER_CUSTOM_PAGES_STORE_KEY).then((pagesData: unknown) => {
          apply(config, normalizeCustomPages(pagesData));
        }).catch(() => {
          apply(config, []);
        });
      }).catch(() => {});
    };
    load();
    const unsub = window.api.onSettingsChanged((channel: string) => {
      if (channel === `store:${HOVER_NAV_LAYOUT_STORE_KEY}` || channel === `store:${HOVER_CUSTOM_PAGES_STORE_KEY}`) {
        load();
      }
    });
    return () => { cancelled = true; unsub(); };
  }, []);

  return tabs;
}
