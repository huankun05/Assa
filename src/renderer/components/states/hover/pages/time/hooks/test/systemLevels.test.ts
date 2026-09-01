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
 * @file systemLevels.test.ts
 * @description systemLevels 事件驱动缓存核心行为测试：
 *  - throttleTrailing 节流（首帧立即、trailing 落定最后值）
 *  - beginLocalAdjust / endLocalAdjust 的本地调节抑制与恢复校准
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginLocalAdjust,
  endLocalAdjust,
  setLocalBrightness,
  subscribeSystemLevels,
  throttleTrailing,
} from '../systemLevels';

describe('systemLevels', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('throttleTrailing', () => {
    it('首帧立即执行，窗口内合并为最后一次', () => {
      const calls: number[] = [];
      const throttled = throttleTrailing((value: number) => calls.push(value), 80);

      throttled(10);
      expect(calls).toEqual([10]);

      // 80ms 窗口内连续输入，只保留最后一次
      throttled(20);
      throttled(30);
      throttled(40);
      expect(calls).toEqual([10]);

      vi.advanceTimersByTime(80);
      expect(calls).toEqual([10, 40]);
    });

    it('窗口结束后再次输入立即执行', () => {
      const calls: number[] = [];
      const throttled = throttleTrailing((value: number) => calls.push(value), 80);

      throttled(1);
      vi.advanceTimersByTime(80);
      throttled(2);
      expect(calls).toEqual([1, 2]);
    });

    it('trailing 计时器触发后不重复执行过期值', () => {
      const calls: number[] = [];
      const throttled = throttleTrailing((value: number) => calls.push(value), 80);

      throttled(1);
      throttled(2); // 排入 trailing
      vi.advanceTimersByTime(80); // 触发 trailing → 2
      vi.advanceTimersByTime(100); // 不再有 pending
      expect(calls).toEqual([1, 2]);
    });
  });

  describe('beginLocalAdjust / endLocalAdjust', () => {
    it('endLocalAdjust 计数归零后立即回推校准通知', () => {
      const seen: number[] = [];
      const unsubscribe = subscribeSystemLevels((next) => {
        if (next.brightness !== null) seen.push(next.brightness);
      });
      // 先让缓存有真实值（模拟打开面板时的本地值）
      setLocalBrightness(42);

      beginLocalAdjust();
      beginLocalAdjust(); // 引用计数：嵌套调用安全
      endLocalAdjust();
      expect(seen).toEqual([42]); // 计数未归零，不校准（无新增通知）
      endLocalAdjust(); // 归零 → 立即回推当前缓存
      expect(seen).toEqual([42, 42]);

      unsubscribe();
    });

    it('成对调用后缓存状态保持可用', () => {
      beginLocalAdjust();
      endLocalAdjust();
      beginLocalAdjust();
      endLocalAdjust();
      // 不抛错、可重复成对调用
      expect(true).toBe(true);
    });
  });
});
