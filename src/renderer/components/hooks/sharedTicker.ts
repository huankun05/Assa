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
 * @file sharedTicker.ts
 * @description 共享心跳调度器：单例 setInterval，多个订阅者共用，减少并发定时器。
 * @author 鸡哥
 */

type TickerListener = () => void;

const listeners = new Set<TickerListener>();
let intervalId: ReturnType<typeof setInterval> | null = null;
let currentInterval = 1000;

function ensureRunning(intervalMs: number): void {
  if (intervalId !== null && currentInterval === intervalMs) return;
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
  currentInterval = intervalMs;
  intervalId = setInterval(() => {
    for (const fn of listeners) {
      try { fn(); } catch { /* noop */ }
    }
  }, intervalMs);
}

export function subscribeTicker(fn: TickerListener, intervalMs = 1000): () => void {
  listeners.add(fn);
  ensureRunning(intervalMs);
  return () => {
    listeners.delete(fn);
    if (listeners.size === 0 && intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };
}
