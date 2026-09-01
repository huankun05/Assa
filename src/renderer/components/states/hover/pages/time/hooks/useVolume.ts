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
 * @file useVolume.ts
 * @description 系统音量状态与调节逻辑 Hook
 * @author 鸡哥
 */

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { VOLUME_UPDATE_DELAY_MS } from '../config/volumeConfig';
import {
  getSystemLevels,
  setLocalVolume,
  startVolumePolling,
  stopVolumePolling,
  subscribeSystemLevels,
} from './systemLevels';

/** useVolume 返回值类型 */
interface UseVolumeReturn {
  volume: number;
  isAvailable: boolean;
  handleVolumeChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

/**
 * 系统音量逻辑 Hook
 * @description 初始值直接来自已预热的实时缓存（无 IPC 往返、无 50% 闪跳），
 * 并订阅后台同步以保持与系统一致；滑动时乐观更新本地缓存并防抖写入主进程。
 * @returns 音量状态与调节回调
 */
export function useVolume(): UseVolumeReturn {
  // 关键修复：初始值取自实时缓存，而非固定 50 —— 打开即真实值
  const initial = getSystemLevels();
  const [volume, setVolume] = useState<number>(initial.volume ?? 50);
  const [isAvailable, setIsAvailable] = useState<boolean>(initial.volumeAvailable);
  const updateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // 仅在本浮层挂载（即面板打开）期间才低频同步音量；卸载即停止，避免后台轮询卡顿
    startVolumePolling();
    const unsubscribe = subscribeSystemLevels((next) => {
      if (next.volume !== null) {
        setVolume(next.volume);
        setIsAvailable(true);
      } else {
        setIsAvailable(next.volumeAvailable);
      }
    });
    return () => {
      unsubscribe();
      stopVolumePolling();
      if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
    };
  }, []);

  const handleVolumeChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    // 立即写入缓存：再次打开时 instant，且其它订阅者（如有）同步
    setLocalVolume(nextVolume);

    if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
    updateTimerRef.current = setTimeout(() => {
      void window.api.setVolume(nextVolume);
    }, VOLUME_UPDATE_DELAY_MS);
  }, []);

  return { volume, isAvailable, handleVolumeChange };
}
