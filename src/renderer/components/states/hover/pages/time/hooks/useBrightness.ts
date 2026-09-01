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
 * @file useBrightness.ts
 * @description 屏幕亮度状态与调节逻辑 Hook
 * @author 鸡哥
 */

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { BRIGHTNESS_UPDATE_DELAY_MS } from '../config/brightnessConfig';
import {
  getSystemLevels,
  setLocalBrightness,
  startBrightnessPolling,
  stopBrightnessPolling,
  subscribeSystemLevels,
} from './systemLevels';

/** useBrightness 返回值类型 */
interface UseBrightnessReturn {
  brightness: number;
  isAvailable: boolean;
  handleBrightnessChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * 屏幕亮度逻辑 Hook
 * @description 初始值直接来自已预热的实时缓存（无 IPC 往返、无 50% 闪跳），
 * 并订阅后台同步以保持与系统一致；滑动时乐观更新本地缓存并防抖写入主进程。
 * @returns 亮度状态与调节回调
 */
export function useBrightness(): UseBrightnessReturn {
  // 关键修复：初始值取自实时缓存，而非固定 50 —— 打开即真实值
  const initial = getSystemLevels();
  const [brightness, setBrightness] = useState<number>(initial.brightness ?? 50);
  const [isAvailable, setIsAvailable] = useState<boolean>(initial.brightnessAvailable);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 仅在本浮层挂载（即面板打开）期间才低频同步亮度；卸载即停止，避免后台轮询卡顿
    startBrightnessPolling();
    const unsubscribe = subscribeSystemLevels((next) => {
      if (next.brightness !== null) {
        setBrightness(next.brightness);
        setIsAvailable(true);
      } else {
        setIsAvailable(next.brightnessAvailable);
      }
    });
    return () => {
      unsubscribe();
      stopBrightnessPolling();
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
    };
  }, []);

  const handleBrightnessChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    const nextBrightness = Number(event.target.value);
    setBrightness(nextBrightness);
    // 立即写入缓存：再次打开时 instant，且其它订阅者（如有）同步
    setLocalBrightness(nextBrightness);

    if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
    updateTimerRef.current = setTimeout(() => {
      void window.api.setBrightness(nextBrightness);
    }, BRIGHTNESS_UPDATE_DELAY_MS);
  }, []);

  return { brightness, isAvailable, handleBrightnessChange };
}
