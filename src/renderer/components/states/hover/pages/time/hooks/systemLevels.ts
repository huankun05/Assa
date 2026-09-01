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
 *
 * 问题背景：早期版本在每次打开浮层时才 IPC 拉真值，导致 (1) 先以默认值 50 渲染再跳真值；
 * (2) 打开有延迟。初版修复用「启动预热 + 每 500ms 后台轮询」，但亮度走的是主进程
 * 同步 WMI 查询，每 500ms 阻塞主线程一次、且面板关闭后仍在跑 —— 造成鼠标移动卡顿。
 *
 * 本版改为：
 *  - 启动只预热【一次】真值（无循环），保证打开即真实值、无跳变；
 *  - 只在浮层【打开期间】才低频同步（默认 1500ms，且只查当前那一项），关闭即停；
 *  - 用引用计数管理定时器，多个面板同时打开也不会叠加多余轮询。
 * 这样背景零定时器、主线程零负担，鼠标不再卡。
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
let warmed = false;

/**
 * 仅在浮层打开时才进行的"低频后台同步"间隔。
 * 关闭后定时器被清除、主线程零负担；1500ms 足以贴近实时又几乎无感知开销。
 */
const OPEN_POLL_INTERVAL_MS = 1500;

/** 引用计数：有多少个已打开的面板在请求该项轮询 */
let brightnessPollers = 0;
let volumePollers = 0;
let brightnessTimer: ReturnType<typeof setInterval> | null = null;
let volumeTimer: ReturnType<typeof setInterval> | null = null;

/** 通知所有订阅者 */
function notify(): void {
  for (const cb of listeners) cb(state);
}

/** 拉取一次最新亮度，仅在真值变化时更新并通知，避免无谓重渲染 */
async function refreshBrightness(): Promise<void> {
  if (typeof window === 'undefined' || !window.api) return;
  let brightness: number | null;
  try {
    brightness = await window.api.getBrightness();
  } catch {
    brightness = null;
  }

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

  if (changed) {
    state = next;
    notify();
  }
}

/** 拉取一次最新音量，仅在真值变化时更新并通知 */
async function refreshVolume(): Promise<void> {
  if (typeof window === 'undefined' || !window.api) return;
  let volume: number | null;
  try {
    volume = await window.api.getVolume();
  } catch {
    volume = null;
  }

  let changed = false;
  const next: SystemLevels = { ...state };
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
}

/**
 * 启动预热：应用启动只拉取一次真值（不开启任何定时器）。幂等。
 * 同时供 startXxxPolling 在面板打开时复用，确保首次打开即拿到真实值。
 */
export function initSystemLevels(): void {
  if (warmed) return;
  if (typeof window === 'undefined' || !window.api) return;
  warmed = true;
  void refreshBrightness();
  void refreshVolume();
}

/** 打开亮度浮层时调用：开始低频同步亮度；引用计数，重复调用安全 */
export function startBrightnessPolling(): void {
  initSystemLevels();
  brightnessPollers += 1;
  if (brightnessTimer === null) {
    void refreshBrightness();
    brightnessTimer = setInterval(() => void refreshBrightness(), OPEN_POLL_INTERVAL_MS);
  }
}

/** 关闭亮度浮层时调用：引用计数归零即停止定时器 */
export function stopBrightnessPolling(): void {
  if (brightnessPollers > 0) brightnessPollers -= 1;
  if (brightnessPollers === 0 && brightnessTimer !== null) {
    clearInterval(brightnessTimer);
    brightnessTimer = null;
  }
}

/** 打开音量浮层时调用：开始低频同步音量；引用计数，重复调用安全 */
export function startVolumePolling(): void {
  initSystemLevels();
  volumePollers += 1;
  if (volumeTimer === null) {
    void refreshVolume();
    volumeTimer = setInterval(() => void refreshVolume(), OPEN_POLL_INTERVAL_MS);
  }
}

/** 关闭音量浮层时调用：引用计数归零即停止定时器 */
export function stopVolumePolling(): void {
  if (volumePollers > 0) volumePollers -= 1;
  if (volumePollers === 0 && volumeTimer !== null) {
    clearInterval(volumeTimer);
    volumeTimer = null;
  }
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

// 应用启动只预热一次（悬浮窗模块图在应用启动时被加载），
// 这样用户首次打开亮度/音量浮层时缓存早已就绪。注意：此处【不】开启任何轮询定时器。
initSystemLevels();
