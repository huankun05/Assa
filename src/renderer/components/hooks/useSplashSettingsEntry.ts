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
 * @file useSplashSettingsEntry.ts
 * @description 启动画面设置入口 Hook：判断是否首次启动、控制按钮延迟出现、发起打开设置
 * @author 鸡哥
 */

import { useCallback, useEffect, useState } from 'react';

/** 首次启动标记存储键（文件不存在即为首次启动） */
const FIRST_LAUNCH_STORE_KEY = 'first-launch';

/** 设置按钮延迟出现时间（毫秒），避开开场动画最初的标识展示 */
const SETTINGS_BUTTON_DELAY_MS = 900;

interface UseSplashSettingsEntryResult {
  /** 是否为首次启动（仅首次启动才展示设置入口） */
  isFirstLaunch: boolean;
  /** 按钮是否已到淡入时机 */
  buttonVisible: boolean;
  /** 通知主进程打开独立设置窗口 */
  openSettings: () => void;
}

/** 启动画面设置入口 Hook */
export function useSplashSettingsEntry(): UseSplashSettingsEntryResult {
  const [isFirstLaunch, setIsFirstLaunch] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;

    window.api
      .storeRead(FIRST_LAUNCH_STORE_KEY)
      .then((value) => {
        if (cancelled) return;
        /** 存储文件不存在（null）表示尚未完成首次引导 */
        setIsFirstLaunch(value === null || value === undefined || value === true);
      })
      .catch(() => {
        if (!cancelled) setIsFirstLaunch(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isFirstLaunch) return;
    const timer = setTimeout(() => {
      setButtonVisible(true);
    }, SETTINGS_BUTTON_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [isFirstLaunch]);

  /** 通知主进程：打开独立设置窗口并收起启动画面 */
  const openSettings = useCallback((): void => {
    window.electron?.ipcRenderer?.send('splash:open-settings');
  }, []);

  return { isFirstLaunch, buttonVisible, openSettings };
}
