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
 * @description 屏幕亮度 / 系统音量的"实时值缓存"（事件驱动版）。
 *
 * 演进历史：
 *  - v1（500ms 后台轮询）：亮度走主进程同步 WMI，每 500ms 阻塞主线程 → 鼠标卡顿；
 *  - v2（打开时 1500ms 低频轮询）：面板关闭后零定时器，但拖动时轮询会拉回尚未生效的旧值 → 滑条回跳；
 *  - v3（本版，事件驱动推送）：主进程常驻 BrightnessMonitor / VolumeMonitor 子进程，
 *    系统亮度/音量一变即 IPC 推送到渲染进程（零轮询、零定时器、不阻塞主线程）。
 *
 * 本模块职责：
 *  - 模块加载即订阅主进程推送，实时更新缓存并通知订阅者；
 *  - 启动预热一次真值（推送链路尚未就绪或外部未变化时兜底）；
 *  - 拖动期间通过 beginLocalAdjust/endLocalAdjust 抑制推送回跳（本地乐观值优先），
 *    停止拖动后自动校准到系统真值。
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

/** 用户正在本地拖动调节（引用计数）：期间外部推送只更新缓存、不 notify，避免滑条回跳 */
let localAdjustActive = 0;

/** 通知所有订阅者 */
function notify(): void {
  for (const cb of listeners) cb(state);
}

/** 拉取一次最新亮度（仅启动预热/推送链路未就绪时兜底），仅在真值变化时更新并通知 */
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
    if (localAdjustActive === 0) notify();
  }
}

/** 拉取一次最新音量（同上） */
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
    if (localAdjustActive === 0) notify();
  }
}

/** 应用外部推送/兜底拉取的真实值到缓存 */
function applyExternal(kind: 'brightness' | 'volume', value: number): void {
  const next: SystemLevels = { ...state };
  if (kind === 'brightness') {
    next.brightness = value;
    next.brightnessAvailable = true;
  } else {
    next.volume = value;
    next.volumeAvailable = true;
  }
  state = next;
  // 本地拖动期间不打扰 UI，停止后由 endLocalAdjust 统一校准
  if (localAdjustActive === 0) notify();
}

/**
 * 启动预热：应用启动只拉取一次真值（推送链路建立前的兜底）。幂等。
 * 推送链路（主进程 monitor）建立后，亮度/音量变化全部走事件推送，不再依赖本函数。
 */
export function initSystemLevels(): void {
  if (warmed) return;
  if (typeof window === 'undefined' || !window.api) return;
  warmed = true;
  void refreshBrightness();
  void refreshVolume();
}

/**
 * 订阅主进程事件驱动推送（模块加载时注册一次）。
 * 收到首帧推送即代表推送链路可用；值变化即更新缓存并通知。
 */
function subscribePushes(): void {
  if (typeof window === 'undefined' || !window.api) return;
  const unsubBrightness = window.api.onBrightnessChanged((value) => {
    applyExternal('brightness', value);
  });
  const unsubVolume = window.api.onVolumeChanged((value) => {
    applyExternal('volume', value);
  });
  // 订阅生命周期跟随模块（渲染进程常驻），无需主动退订
  void unsubBrightness;
  void unsubVolume;
}

/**
 * 本地拖动开始：抑制外部推送回跳。可重复调用（引用计数），
 * 必须与 endLocalAdjust 成对调用。
 */
export function beginLocalAdjust(): void {
  localAdjustActive += 1;
}

/**
 * 本地拖动结束：恢复推送应用，并用缓存中的最新系统值校准 UI。
 */
export function endLocalAdjust(): void {
  if (localAdjustActive > 0) localAdjustActive -= 1;
  if (localAdjustActive === 0) notify();
}

/**
 * 确保亮度缓存有值（推送尚未就绪时由 hooks 挂载兜底拉取一次）。
 */
export function ensureBrightnessWarm(): void {
  if (state.brightness === null) void refreshBrightness();
}

/**
 * 确保音量缓存有值（同上）。
 */
export function ensureVolumeWarm(): void {
  if (state.volume === null) void refreshVolume();
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
  state = { ...state, brightness: value, brightnessAvailable: true };
  notify();
}

/** 用户拖动音量滑块时立即写入缓存 */
export function setLocalVolume(value: number): void {
  state = { ...state, volume: value, volumeAvailable: true };
  notify();
}

/**
 * 节流（trailing 保证最后值落定）：拖动高频 change 时限制写回主进程的频率。
 * 主进程侧另有"最新值合并队列"，渲染端只需防止 IPC 洪泛即可。
 */
export function throttleTrailing(fn: (value: number) => void, ms: number): (value: number) => void {
  let last = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: number | null = null;
  return (value: number): void => {
    pending = value;
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      const next = pending;
      pending = null;
      if (next !== null) fn(next);
      return;
    }
    if (timer === null) {
      const remaining = ms - (now - last);
      timer = setTimeout(() => {
        timer = null;
        last = Date.now();
        const next = pending;
        pending = null;
        if (next !== null) fn(next);
      }, remaining);
    }
  };
}

// 模块加载即订阅推送 + 预热一次真值
subscribePushes();
initSystemLevels();
