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
 * @file systemLevels.ts
 * @description 屏幕亮度 / 系统音量的"实时值缓存"。
 * 问题背景：原 useBrightness/useVolume 在每次打开浮层时才通过 IPC 拉取真值，
 * 导致 (1) 先以默认值 50 渲染再跳到真值；(2) 打开有明显延迟。
 * 本模块在应用启动即预热，并低频轮询保持与系统同步；浮层打开时直接读缓存，
 * 不再有 IPC 往返，达到 Windows 面板那种即时感。
 * @author WorkBuddy
 */

/** 当前系统亮度 / 音量快照 */
export interface SystemLevels {
  /** 当前亮度百分比 0-100；尚未取得时为 null */
  brightness: number | null;
  /** 当前音量百分比 0-100；尚未取得时为 null */
  volume: number | null;
  /** 亮度是否可用（设备不支持时为 false） */
  brightnessAvailable: boolean;
  /** 音量是否可用 */
  volumeAvailable: boolean;
}

const EMPTY_LEVELS: SystemLevels = {
  brightness: null,
  volume: null,
  brightnessAvailable: false,
  volumeAvailable: false,
};

let state: SystemLevels = { ...EMPTY_LEVELS };
const listeners = new Set<(next: SystemLevels) => void>();
let started = false;
let timer: ReturnType<typeof setInterval> | null = null;

/** 轮询间隔：500ms 足够"近实时"，又不会给系统带来压力 */
const POLL_INTERVAL_MS = 500;

/** 通知所有订阅者 */
function notify(): void {
  for (const cb of listeners) cb(state);
}

/** 拉取一次最新值，仅在"真值发生变化"时更新并通知，避免无谓重渲染 */
async function refreshLevels(): Promise<void> {
  try {
    const [brightness, volume] = await Promise.all([
      window.api.getBrightness().catch(() => null),
      window.api.getVolume().catch(() => null),
    ]);

    let changed = false;
    const next: SystemLevels = { ...state };

    if (brightness !== null) {
      if (next.brightness !== brightness || !next.brightnessAvailable) {
        next.brightness = brightness;
        next.brightnessAvailable = true;
        changed = true;
      }
    } else if (next.brightnessAvailable) {
      next.brightnessAvailable = false;
      changed = true;
    }

    if (volume !== null) {
      if (next.volume !== volume || !next.volumeAvailable) {
        next.volume = volume;
        next.volumeAvailable = true;
        changed = true;
      }
    } else if (next.volumeAvailable) {
      next.volumeAvailable = false;
      changed = true;
    }

    if (changed) {
      state = next;
      notify();
    }
  } catch {
    /* 单次刷新失败（如设备不支持）忽略，下一个周期再试 */
  }
}

/**
 * 启动后台预热：立即拉取一次，之后每 POLL_INTERVAL_MS 刷新。
 * 幂等：多次调用安全，只启动一个轮询循环。
 */
export function initSystemLevels(): void {
  if (started) return;
  if (typeof window === 'undefined' || !window.api) return;
  started = true;
  void refreshLevels();
  timer = setInterval(() => void refreshLevels(), POLL_INTERVAL_MS);
}

/** 读取当前缓存快照（打开浮层时直接用它作为初始值，零延迟） */
export function getSystemLevels(): SystemLevels {
  return state;
}

/**
 * 订阅实时值变化。
 * @returns 取消订阅函数
 */
export function subscribeSystemLevels(cb: (next: SystemLevels) => void): () => void {
  listeners.add(cb);
  // 立即回推当前值，避免订阅者首帧拿到空值
  cb(state);
  return () => {
    listeners.delete(cb);
  };
}

/** 用户拖动亮度滑块时立即写入缓存，保证再次打开 instant 且外部订阅同步 */
export function setLocalBrightness(value: number): void {
  const next: SystemLevels = { ...state, brightness: value, brightnessAvailable: true };
  state = next;
  notify();
}

/** 用户拖动音量滑块时立即写入缓存 */
export function setLocalVolume(value: number): void {
  const next: SystemLevels = { ...state, volume: value, volumeAvailable: true };
  state = next;
  notify();
}

// 模块加载即开始预热（悬浮窗模块图在应用启动时被加载），
// 这样用户首次打开亮度/音量浮层时缓存早已就绪。
initSystemLevels();
