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
 * @description 系统音量状态与调节逻辑 Hook（事件驱动版）
 * @author 鸡哥 / WorkBuddy
 */

import { type ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { VOLUME_UPDATE_DELAY_MS } from '../config/volumeConfig';
import {
  beginLocalAdjust,
  endLocalAdjust,
  ensureVolumeWarm,
  getSystemLevels,
  setLocalVolume,
  subscribeSystemLevels,
  throttleTrailing,
} from './systemLevels';

/** useVolume 返回值类型 */
interface UseVolumeReturn {
  volume: number;
  isAvailable: boolean;
  handleVolumeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  /** 指针按下：进入本地拖动抑制（抑制系统推送回跳） */
  handleVolumePointerDown: () => void;
  /** 指针抬起/取消：结束抑制并校准到系统真值 */
  handleVolumePointerUp: () => void;
}

/**
 * 系统音量逻辑 Hook
 * @description 初始值直接来自已预热的实时缓存（无 IPC 往返、无 50% 闪跳）；
 * 系统音量变化由主进程事件驱动推送更新（零轮询）；拖动时本地乐观更新、
 * 节流写回主进程，并临时抑制推送回跳，停止后自动校准到系统真值。
 * @returns 音量状态与调节回调
 */
export function useVolume(): UseVolumeReturn {
  // 关键修复：初始值取自实时缓存，而非固定 50 —— 打开即真实值
  const initial = getSystemLevels();
  const [volume, setVolume] = useState<number>(initial.volume ?? 50);
  const [isAvailable, setIsAvailable] = useState<boolean>(initial.volumeAvailable);
  const throttledSetRef = useRef<((value: number) => void) | null>(null);

  useEffect(() => {
    // 推送链路尚未就绪时兜底拉取一次真值
    ensureVolumeWarm();
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
      // 拖动中面板被关闭（pointerup 未触发）时，兜底释放抑制引用计数
      endLocalAdjust();
    };
  }, []);

  const handleVolumeChange = useCallback((event: ChangeEvent<HTMLInputElement>): void => {
    const nextVolume = Number(event.target.value);
    setVolume(nextVolume);
    // 立即写入缓存：再次打开时 instant，且其它订阅者（如有）同步
    setLocalVolume(nextVolume);

    // 节流写回主进程（异步队列，不阻塞；trailing 保证最后值落定）
    if (!throttledSetRef.current) {
      throttledSetRef.current = throttleTrailing((value: number) => {
        void window.api.setVolume(value);
      }, VOLUME_UPDATE_DELAY_MS);
    }
    throttledSetRef.current(nextVolume);
  }, []);

  // 指针驱动抑制：down 进入抑制（引用计数），up/cancel 退出并校准
  const handleVolumePointerDown = useCallback((): void => {
    beginLocalAdjust();
  }, []);

  const handleVolumePointerUp = useCallback((): void => {
    endLocalAdjust();
  }, []);

  return {
    volume,
    isAvailable,
    handleVolumeChange,
    handleVolumePointerDown,
    handleVolumePointerUp,
  };
}
