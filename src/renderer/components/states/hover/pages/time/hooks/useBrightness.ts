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
 * @description 屏幕亮度状态与调节逻辑 Hook（事件驱动版）
 * @author 鸡哥 / WorkBuddy
 */

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { BRIGHTNESS_UPDATE_DELAY_MS } from '../config/brightnessConfig';
import {
  beginLocalAdjust,
  endLocalAdjust,
  ensureBrightnessWarm,
  getSystemLevels,
  setLocalBrightness,
  subscribeSystemLevels,
  throttleTrailing,
} from './systemLevels';

/** useBrightness 返回值类型 */
interface UseBrightnessReturn {
  brightness: number;
  isAvailable: boolean;
  handleBrightnessChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/** 拖动停止多久后恢复外部推送校准（ms） */
const ADJUST_END_DELAY_MS = 300;

/**
 * 屏幕亮度逻辑 Hook
 * @description 初始值直接来自已预热的实时缓存（无 IPC 往返、无 50% 闪跳）；
 * 系统亮度变化由主进程事件驱动推送更新（零轮询）；拖动时本地乐观更新、
 * 节流写回主进程，并临时抑制推送回跳，停止后自动校准到系统真值。
 * @returns 亮度状态与调节回调
 */
export function useBrightness(): UseBrightnessReturn {
  // 关键修复：初始值取自实时缓存，而非固定 50 —— 打开即真实值
  const initial = getSystemLevels();
  const [brightness, setBrightness] = useState<number>(initial.brightness ?? 50);
  const [isAvailable, setIsAvailable] = useState<boolean>(initial.brightnessAvailable);
  const adjustActiveRef = useRef(false);
  const endAdjustTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const throttledSetRef = useRef<((value: number) => void) | null>(null);

  useEffect(() => {
    // 推送链路尚未就绪时兜底拉取一次真值
    ensureBrightnessWarm();
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
      if (endAdjustTimerRef.current) clearTimeout(endAdjustTimerRef.current);
      if (adjustActiveRef.current) {
        adjustActiveRef.current = false;
        endLocalAdjust();
      }
    };
  }, []);

  const handleBrightnessChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    const nextBrightness = Number(event.target.value);
    setBrightness(nextBrightness);
    // 立即写入缓存：再次打开时 instant，且其它订阅者（如有）同步
    setLocalBrightness(nextBrightness);

    // 拖动期间抑制外部推送回跳；停止 300ms 后恢复推送校准
    if (!adjustActiveRef.current) {
      adjustActiveRef.current = true;
      beginLocalAdjust();
    }
    if (endAdjustTimerRef.current) clearTimeout(endAdjustTimerRef.current);
    endAdjustTimerRef.current = setTimeout(() => {
      endAdjustTimerRef.current = null;
      adjustActiveRef.current = false;
      endLocalAdjust();
    }, ADJUST_END_DELAY_MS);

    // 节流写回主进程（异步队列，不阻塞；trailing 保证最后值落定）
    if (!throttledSetRef.current) {
      throttledSetRef.current = throttleTrailing((value: number) => {
        void window.api.setBrightness(value);
      }, BRIGHTNESS_UPDATE_DELAY_MS);
    }
    throttledSetRef.current(nextBrightness);
  }, []);

  return { brightness, isAvailable, handleBrightnessChange };
}
