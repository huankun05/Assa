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
 * @file useHover.ts
 * @description Hover 状态交互逻辑 Hook
 * @author 鸡哥
 */

import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../store/slices';
import type { HoverTab } from '../../../../store/types';
import { HOVER_TAB_LABELS } from '../config/hoverConfig';
import { useHoverNavLayout } from './useHoverNavLayout';
import type { HoverContentProps } from '../types';

/** Hover 状态交互逻辑 Hook */
export function useHover(props: HoverContentProps) {
  const { t } = useTranslation();
  const { hoverTab, setHoverTab, setExpanded, customPages } = useIslandStore();
  const contentRef = useRef<HTMLDivElement>(null);
  const navTabs = useHoverNavLayout();
  const navTabsRef = useRef<HoverTab[]>(navTabs);
  navTabsRef.current = navTabs;

  const getDotLabel = (tab: HoverTab): string => {
    if (tab.startsWith('custom:')) {
      const id = tab.slice('custom:'.length);
      const def = customPages.find((p) => p.id === id);
      if (def) return def.title;
    }
    return t(`hover.nav.${tab}`, { defaultValue: HOVER_TAB_LABELS[tab] ?? tab });
  };

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent): void => {
      const target = e.target as HTMLElement;
      if (hoverTab === 'time' && target.closest('.timer-inputs')) return;
      e.preventDefault();
      const tabs = navTabsRef.current;
      const currentIndex = tabs.findIndex(d => d === hoverTab);
      if (currentIndex < 0) return;
      let nextTab: HoverTab;
      if (e.deltaY > 0) {
        nextTab = tabs[(currentIndex + 1) % tabs.length];
      } else {
        nextTab = tabs[(currentIndex - 1 + tabs.length) % tabs.length];
      }
      if (nextTab === 'expand') {
        setExpanded();
        return;
      }
      setHoverTab(nextTab);
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [hoverTab, setHoverTab]);

  // 阶段3：鼠标拖拽翻页（pointer 横向拖拽）
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    let startX = 0;
    let dragging = false;
    let lastTab = '';

    const onPointerDown = (e: PointerEvent): void => {
      const target = e.target as HTMLElement;
      if (target.closest('.hover-nav-dots') || target.closest('.hover-toolbar') || target.closest('.control-center-popover')) return;
      dragging = true;
      startX = e.clientX;
      lastTab = hoverTab;
    };
    const onPointerUp = (e: PointerEvent): void => {
      if (!dragging) return;
      dragging = false;
      const dx = e.clientX - startX;
      if (Math.abs(dx) < 40) return;
      const tabs = navTabsRef.current;
      const idx = tabs.findIndex(d => d === lastTab);
      if (idx < 0) return;
      const nextTab = dx < 0 ? tabs[(idx + 1) % tabs.length] : tabs[(idx - 1 + tabs.length) % tabs.length];
      if (nextTab === 'expand') { setExpanded(); return; }
      setHoverTab(nextTab);
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
    return () => { el.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('pointerup', onPointerUp); };
  }, [hoverTab, setHoverTab, setExpanded]);

  return {
    ...props,
    t,
    hoverTab,
    setHoverTab,
    setExpanded,
    contentRef,
    getDotLabel,
    navTabs,
  };
}

