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
 * @file windowHandlers.test.ts
 * @description 单元测试文件
 * @author 鸡哥
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { handleMock, onMock } = vi.hoisted(() => ({
  handleMock: vi.fn(),
  onMock: vi.fn(),
}));

const { broadcastSettingChangeMock } = vi.hoisted(() => ({
  broadcastSettingChangeMock: vi.fn(),
}));

vi.mock('electron', () => ({
  ipcMain: {
    handle: handleMock,
    on: onMock,
  },
  screen: {
    getCursorScreenPoint: vi.fn(() => ({ x: 10, y: 20 })),
    getPrimaryDisplay: vi.fn(() => ({ id: 1, workArea: { y: 0, width: 1920, height: 1080 } })),
    getAllDisplays: vi.fn(() => [{ id: 1, workArea: { width: 1920, height: 1080 } }]),
  },
  BrowserWindow: class {},
}));

vi.mock('../../../utils/broadcast', () => ({
  broadcastSettingChange: broadcastSettingChangeMock,
}));

vi.mock('../../../config/storeConfig', () => ({
  readIslandShapeModeConfig: () => 'notch',
  PILL_ISLAND_HEIGHT: 52,
  PILL_EXPANDED_HEIGHT: 72,
  PILL_NOTIFICATION_HEIGHT: 100,
  PILL_LYRICS_HEIGHT: 52,
  PILL_LYRICS_TRANSLATION_HEIGHT: 72,
  PILL_EXPANDED_FULL_HEIGHT: 164,
  PILL_SETTINGS_HEIGHT: 416,
}));

import { registerWindowIpcHandlers, toggleMousePassthroughLock } from '../window';

describe('window ipc handlers', () => {
  const handleHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const onHandlers = new Map<string, (...args: unknown[]) => unknown>();
  const win = {
    isDestroyed: vi.fn(() => false),
    setIgnoreMouseEvents: vi.fn(),
    getBounds: vi.fn(() => ({ x: 100, y: 200, width: 300, height: 100 })),
    setBounds: vi.fn(),
    setShape: vi.fn(),
    hide: vi.fn(),
    webContents: { send: vi.fn(), invalidate: vi.fn() },
  };

  beforeEach(() => {
    handleHandlers.clear();
    onHandlers.clear();
    handleMock.mockReset();
    onMock.mockReset();
    broadcastSettingChangeMock.mockReset();
    win.isDestroyed.mockReset();
    win.isDestroyed.mockReturnValue(false);
    win.setIgnoreMouseEvents.mockReset();
    win.getBounds.mockReset();
    win.getBounds.mockReturnValue({ x: 100, y: 200, width: 300, height: 100 });
    win.setBounds.mockReset();
    win.setShape.mockReset();
    win.hide.mockReset();
    win.webContents.send.mockReset();
    win.webContents.invalidate.mockReset();

    handleMock.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
      handleHandlers.set(channel, handler);
    });
    onMock.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
      onHandlers.set(channel, handler);
    });
  });

  it('toggles passthrough lock state', () => {
    toggleMousePassthroughLock(() => win as never);
    expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });

    toggleMousePassthroughLock(() => win as never);
    expect(win.setIgnoreMouseEvents).toHaveBeenLastCalledWith(false);
  });

  it('registers handlers and resizes window on expand/collapse', () => {
    registerWindowIpcHandlers({
      getMainWindow: () => win as never,
      getInitialCenterX: () => 500,
      setHiddenByAutoHideProcess: vi.fn(),
      getIslandPositionOffset: () => ({ x: 1, y: 2 }),
      getIslandDisplaySelection: () => 'primary',
      sanitizeIslandDisplaySelection: () => 'primary',
      setIslandDisplaySelection: vi.fn(),
      sanitizeIslandPositionOffset: () => ({ x: 3, y: 4 }),
      applyIslandPositionOffset: vi.fn(),
      writeIslandPositionOffsetConfig: vi.fn(() => true),
      writeIslandDisplaySelectionConfig: vi.fn(() => true),
      sizes: {
        expandedWidth: 600,
        expandedHeight: 200,
        notificationWidth: 500,
        notificationHeight: 200,
        lyricsWidth: 700,
        lyricsHeight: 240,
        lyricsTranslationHeight: 300,
        expandedFullWidth: 900,
        expandedFullHeight: 400,
        settingsWidth: 1000,
        settingsHeight: 600,
        islandWidth: 300,
        islandHeight: 100,
      },
    });

    onHandlers.get('window:expand')?.();
    onHandlers.get('window:collapse')?.();
    expect(win.setBounds).toHaveBeenCalledTimes(2);

    vi.useFakeTimers();
    win.getBounds.mockReturnValue({ x: 100, y: 200, width: 1000, height: 600 });
    onHandlers.get('window:expand')?.({}, 700);
    expect(win.setBounds).toHaveBeenCalledTimes(3);
    expect(win.setShape).toHaveBeenLastCalledWith([{ x: 200, y: 0, width: 600, height: 200 }]);
    vi.advanceTimersByTime(699);
    expect(win.setBounds).toHaveBeenCalledTimes(3);
    vi.advanceTimersByTime(1);
    expect(win.setBounds).toHaveBeenCalledTimes(4);
    expect(win.setShape).toHaveBeenLastCalledWith([{ x: 200, y: 0, width: 600, height: 200 }]);
    expect(win.webContents.invalidate).toHaveBeenCalledTimes(4);
    vi.useRealTimers();

    win.getBounds.mockReturnValue({ x: 0, y: 0, width: 1000, height: 200 });
    expect(handleHandlers.get('window:get-mouse-position')?.()).toEqual({ x: 10, y: 20 });
    expect(handleHandlers.get('window:get-mouse-window-state')?.()).toEqual({
      mousePosition: { x: 10, y: 20 },
      bounds: { x: 200, y: 0, width: 600, height: 200 },
    });
    expect(handleHandlers.get('window:get-bounds')?.()).toEqual({ x: 200, y: 0, width: 600, height: 200 });
    expect(handleHandlers.get('window:island-displays:list')?.()).toEqual([{ id: '1', width: 1920, height: 1080, isPrimary: true }]);
  });

  it('applies shape when collapsing to a state of the same height', () => {
    // 歌词条 500x42 与 idle 260x42 高度相同：两段式 resize 的第二阶段
    // 只有可见区（shape）变化、原生边界四项全等，必须靠 sameVisible 判定放行
    registerWindowIpcHandlers({
      getMainWindow: () => win as never,
      getInitialCenterX: () => 500,
      setHiddenByAutoHideProcess: vi.fn(),
      getIslandPositionOffset: () => ({ x: 0, y: 0 }),
      getIslandDisplaySelection: () => 'primary',
      sanitizeIslandDisplaySelection: () => 'primary',
      setIslandDisplaySelection: vi.fn(),
      sanitizeIslandPositionOffset: () => ({ x: 0, y: 0 }),
      applyIslandPositionOffset: vi.fn(),
      writeIslandPositionOffsetConfig: vi.fn(() => true),
      writeIslandDisplaySelectionConfig: vi.fn(() => true),
      sizes: {
        expandedWidth: 860,
        expandedHeight: 150,
        notificationWidth: 500,
        notificationHeight: 88,
        lyricsWidth: 500,
        lyricsHeight: 42,
        lyricsTranslationHeight: 60,
        expandedFullWidth: 860,
        expandedFullHeight: 400,
        settingsWidth: 860,
        settingsHeight: 400,
        islandWidth: 260,
        islandHeight: 42,
      },
    });

    // 初始为 idle：260x42
    win.getBounds.mockReturnValue({ x: 370, y: 0, width: 260, height: 42 });

    // 1) 展开到歌词条 500x42（delay=0，一步到位）
    onHandlers.get('window:expand-lyrics')?.();
    expect(win.setBounds).toHaveBeenCalledTimes(1);
    expect(win.setShape).toHaveBeenLastCalledWith([{ x: 0, y: 0, width: 500, height: 42 }]);

    // 模拟原生 setBounds 生效
    win.getBounds.mockReturnValue({ x: 250, y: 0, width: 500, height: 42 });

    vi.useFakeTimers();
    // 2) 收起回 idle（两段式，阶段二延迟 700ms）
    onHandlers.get('window:collapse')?.({}, 700);

    // 阶段一：撑住旧画布，边界不变 -> 应被正确去重
    expect(win.setBounds).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(700);

    // 阶段二：可见区 500x42 -> 260x42，边界不变、仅 shape 变化。
    // 此处若被误判为「无需更新」，setShape/invalidate 会被跳过，
    // 原生裁剪区停留在 500 宽，与 React 侧已切回 idle 的 CSS 尺寸失配
    expect(win.setBounds).toHaveBeenCalledTimes(2);
    expect(win.setShape).toHaveBeenLastCalledWith([{ x: 120, y: 0, width: 260, height: 42 }]);
    expect(win.webContents.invalidate).toHaveBeenCalledTimes(2);

    // 3) 同尺寸重复调用仍应被去重，保留「避免每帧原生几何变更」的优化
    onHandlers.get('window:collapse')?.();
    expect(win.setBounds).toHaveBeenCalledTimes(2);
    expect(win.webContents.invalidate).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('broadcasts island display and position updates', () => {
    const setIslandDisplaySelection = vi.fn();
    const applyIslandPositionOffset = vi.fn();

    registerWindowIpcHandlers({
      getMainWindow: () => win as never,
      getInitialCenterX: () => 500,
      setHiddenByAutoHideProcess: vi.fn(),
      getIslandPositionOffset: () => ({ x: 1, y: 2 }),
      getIslandDisplaySelection: () => 'primary',
      sanitizeIslandDisplaySelection: () => 'display-2',
      setIslandDisplaySelection,
      sanitizeIslandPositionOffset: () => ({ x: 8, y: 9 }),
      applyIslandPositionOffset,
      writeIslandPositionOffsetConfig: vi.fn(() => true),
      writeIslandDisplaySelectionConfig: vi.fn(() => true),
      sizes: {
        expandedWidth: 600,
        expandedHeight: 200,
        notificationWidth: 500,
        notificationHeight: 200,
        lyricsWidth: 700,
        lyricsHeight: 240,
        lyricsTranslationHeight: 300,
        expandedFullWidth: 900,
        expandedFullHeight: 400,
        settingsWidth: 1000,
        settingsHeight: 600,
        islandWidth: 300,
        islandHeight: 100,
      },
    });

    const setDisplay = handleHandlers.get('window:island-display:set');
    const setPosition = handleHandlers.get('window:island-position:set');

    expect(setDisplay?.({ sender: { id: 1 } }, 'x')).toBe(true);
    expect(setPosition?.({ sender: { id: 2 } }, { x: 1 })).toBe(true);

    expect(setIslandDisplaySelection).toHaveBeenCalledWith('display-2');
    expect(applyIslandPositionOffset).toHaveBeenCalledWith({ x: 8, y: 9 });
    expect(broadcastSettingChangeMock).toHaveBeenCalledWith(1, 'island:display', 'display-2');
    expect(broadcastSettingChangeMock).toHaveBeenCalledWith(2, 'island:position', { x: 8, y: 9 });
  });
});
