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
 * @file standaloneWindowAuth.test.ts
 * @description 单元测试 - standaloneWindowAuth.ts（仅保留 musicProvidersLogin / none 意图）
 * @author 鸡哥
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { setStateMock } = vi.hoisted(() => ({
  setStateMock: vi.fn(),
}));

vi.mock('../../../store/slices', () => ({
  default: { setState: setStateMock },
}));

// Dynamic import to avoid side effects at module level
let applyAuthIntent: (intent: unknown) => void;

describe('applyAuthIntent', () => {
  beforeEach(async () => {
    setStateMock.mockClear();
    vi.resetModules();
    vi.doMock('../../../store/slices', () => ({
      default: { setState: setStateMock },
    }));
    const mod = await import('../standaloneWindowAuth');
    applyAuthIntent = mod.applyAuthIntent;
  });

  it('should set state to "musicProvidersLogin" when intent is "musicProvidersLogin"', () => {
    applyAuthIntent('musicProvidersLogin');
    expect(setStateMock).toHaveBeenCalledWith({ state: 'musicProvidersLogin' });
    expect(setStateMock).toHaveBeenCalledTimes(1);
  });

  describe('none / reset intents', () => {
    it('should set state to "maxExpand" when intent is "none"', () => {
      applyAuthIntent('none');
      expect(setStateMock).toHaveBeenCalledWith({ state: 'maxExpand' });
      expect(setStateMock).toHaveBeenCalledTimes(1);
    });

    it('should set state to "maxExpand" when intent is null', () => {
      applyAuthIntent(null);
      expect(setStateMock).toHaveBeenCalledWith({ state: 'maxExpand' });
      expect(setStateMock).toHaveBeenCalledTimes(1);
    });

    it('should set state to "maxExpand" when intent is empty string', () => {
      applyAuthIntent('');
      expect(setStateMock).toHaveBeenCalledWith({ state: 'maxExpand' });
      expect(setStateMock).toHaveBeenCalledTimes(1);
    });

    it('should not call setState when intent is undefined', () => {
      applyAuthIntent(undefined);
      expect(setStateMock).not.toHaveBeenCalled();
    });
  });

  describe('unsupported intents (platform auth removed)', () => {
    it('ignores legacy login/register intents', () => {
      applyAuthIntent('login');
      applyAuthIntent('register');
      expect(setStateMock).not.toHaveBeenCalled();
    });

    it('ignores arbitrary non-none strings and non-string values', () => {
      applyAuthIntent('arbitrary');
      applyAuthIntent(42);
      applyAuthIntent({});
      applyAuthIntent(true);
      expect(setStateMock).not.toHaveBeenCalled();
    });
  });

  describe('branch isolation', () => {
    it('handles sequential calls independently', () => {
      applyAuthIntent('musicProvidersLogin');
      applyAuthIntent('register');
      applyAuthIntent('none');
      expect(setStateMock).toHaveBeenCalledTimes(2);
      expect(setStateMock).toHaveBeenNthCalledWith(1, { state: 'musicProvidersLogin' });
      expect(setStateMock).toHaveBeenNthCalledWith(2, { state: 'maxExpand' });
    });
  });
});
