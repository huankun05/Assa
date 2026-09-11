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
 * @file islandSlice.ts
 * @description 灵动岛 UI 状态相关逻辑
 * @author 鸡哥
 */

import type { StateCreator } from 'zustand';
import type { ControlCenterButtonConfig, CustomPageDef, IslandSlice } from '../types';
import { DEFAULT_CONTROL_CENTER_BUTTONS } from '../../components/config/controlCenterButtons';
import { emptyNotification } from '../constants/defaults';
import { getIslandWindowShrinkDelay } from '../constants/islandTransition';
import { playNotificationSoundOnce } from '../../utils/audio/notificationSound';

const CUSTOM_PAGES_STORE_KEY = 'hover-custom-pages';

/** 持久化自定义页面配置到本地存储 */
function persistCustomPages(defs: CustomPageDef[]): void {
  window.api?.storeWrite(CUSTOM_PAGES_STORE_KEY, defs).catch(() => {});
}

const CONTROL_CENTER_BUTTONS_STORE_KEY = 'hover-control-center-buttons';

/** 持久化控制中心按钮池配置到本地存储 */
function persistControlCenterButtons(config: ControlCenterButtonConfig[]): void {
  window.api?.storeWrite(CONTROL_CENTER_BUTTONS_STORE_KEY, config).catch(() => {});
}

function readCliProvider(): 'claude' | 'codex' {
  try {
    return window.localStorage.getItem('eisland-cli-provider') === 'codex' ? 'codex' : 'claude';
  } catch {
    return 'claude';
  }
}

export const createIslandSlice: StateCreator<
  IslandSlice,
  [],
  [],
  IslandSlice
> = (set, get) => ({
  state: 'idle',
  uiStateLocked: false,
  musicProviderLogin: 'qishui',
  hoverTab: 'time',
  customPages: [],
  controlCenterButtons: DEFAULT_CONTROL_CENTER_BUTTONS,
  expandTab: 'tools',
  maxExpandTab: 'todo',
  cliProvider: readCliProvider(),
  notification: emptyNotification,
  sttText: '',
  agentPrompt: '',
  agentMood: 'happy' as const,
  springAnimation: true,
  animationSpeed: 'medium' as const,
  shapeMode: 'notch' as const,

  setIdle: (force?: boolean) => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'idle') return prev;
    if (!force && (prev.state === 'expanded' || prev.state === 'maxExpand' || prev.state === 'guide' || prev.state === 'announcement')) return prev;
    window.api?.collapseWindow(getIslandWindowShrinkDelay(prev.state, 'idle', prev.animationSpeed));
    window.api?.enableMousePassthrough();
    return { state: 'idle' as const };
  }),

  setHover: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'hover') return prev;
    window.api?.expandWindow(getIslandWindowShrinkDelay(prev.state, 'hover', prev.animationSpeed));
    window.api?.disableMousePassthrough();
    return { state: 'hover' };
  }),

  setExpanded: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'expanded') return prev;
    window.api?.expandWindowFull(getIslandWindowShrinkDelay(prev.state, 'expanded', prev.animationSpeed));
    window.api?.disableMousePassthrough();
    return { state: 'expanded' };
  }),

  setMaxExpand: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'maxExpand') return prev;
    window.api?.expandWindowSettings();
    window.api?.disableMousePassthrough();
    return { state: 'maxExpand' };
  }),

  setLyrics: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'lyrics') return prev;
    window.api?.expandWindowLyrics(getIslandWindowShrinkDelay(prev.state, 'lyrics', prev.animationSpeed));
    window.api?.enableMousePassthrough();
    return { state: 'lyrics' };
  }),

  setLyricsTranslation: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'lyricsTranslation') return prev;
    window.api?.expandWindowLyricsTranslation(getIslandWindowShrinkDelay(prev.state, 'lyricsTranslation', prev.animationSpeed));
    window.api?.enableMousePassthrough();
    return { state: 'lyricsTranslation' };
  }),

  setNotification: (data) => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'notification') return prev;
    window.api?.expandWindowNotification(getIslandWindowShrinkDelay(prev.state, 'notification', prev.animationSpeed));
    if (data.type !== 'cli-session-detected') playNotificationSoundOnce();
    return { state: 'notification', notification: data };
  }),

  setGuide: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'guide') return prev;
    window.api?.expandWindowSettings();
    window.api?.disableMousePassthrough();
    return { state: 'guide' as const };
  }),

  setAnnouncement: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'announcement') return prev;
    window.api?.expandWindowSettings();
    window.api?.disableMousePassthrough();
    return { state: 'announcement' as const };
  }),

  setAgentVoiceInput: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'agentVoiceInput') return prev;
    window.api?.expandWindowLyrics(getIslandWindowShrinkDelay(prev.state, 'agentVoiceInput', prev.animationSpeed));
    window.api?.enableMousePassthrough();
    return { state: 'agentVoiceInput' as const };
  }),

  setStt: (text?: string) => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'stt') return prev;
    window.api?.expandWindowNotification(getIslandWindowShrinkDelay(prev.state, 'stt', prev.animationSpeed));
    window.api?.disableMousePassthrough();
    return { state: 'stt' as const, sttText: text ?? '' };
  }),

  setAgent: (prompt?: string) => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'agent') return prev;
    window.api?.expandWindowNotification(getIslandWindowShrinkDelay(prev.state, 'agent', prev.animationSpeed));
    window.api?.disableMousePassthrough();
    return { state: 'agent' as const, agentPrompt: prompt ?? prev.sttText ?? '', agentMood: 'thinking' as const };
  }),

  setAgentMood: (mood) => set({ agentMood: mood }),

  setCli: () => set((prev) => {
    if (prev.uiStateLocked && prev.state !== 'cli') return prev;
    window.api?.expandWindowNotification(getIslandWindowShrinkDelay(prev.state, 'cli', prev.animationSpeed));
    window.api?.disableMousePassthrough();
    return { state: 'cli' as const };
  }),

  toggleUiStateLock: () => {
    const next = !get().uiStateLocked;
    set({ uiStateLocked: next });
    return next;
  },

  setHoverTab: (tab) => set({ hoverTab: tab }),
  addCustomPage: (def) => {
    set((s) => ({ customPages: [...s.customPages, def] }));
    persistCustomPages(get().customPages);
  },
  removeCustomPage: (id) => {
    set((s) => ({ customPages: s.customPages.filter((p) => p.id !== id) }));
    persistCustomPages(get().customPages);
  },
  updateCustomPage: (id, patch) => {
    set((s) => ({ customPages: s.customPages.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
    persistCustomPages(get().customPages);
  },
  setCustomPages: (defs) => set({ customPages: defs }),
  setControlCenterButtons: (config) => {
    set({ controlCenterButtons: config });
    persistControlCenterButtons(config);
  },
  setExpandTab: (tab) => set({ expandTab: tab }),
  setMaxExpandTab: (tab) => set({ maxExpandTab: tab }),
  setCliProvider: (provider) => {
    try {
      window.localStorage.setItem('eisland-cli-provider', provider);
    } catch {
      // 无持久化能力时仍保留当前渲染进程内的选择。
    }
    set({ cliProvider: provider });
  },
  setSpringAnimation: (enabled) => set({ springAnimation: enabled }),
  setAnimationSpeed: (speed) => set({ animationSpeed: speed }),
  setShapeMode: (mode) => set({ shapeMode: mode }),
});
