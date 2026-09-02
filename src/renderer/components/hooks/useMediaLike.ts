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
 * @file useMediaLike.ts
 * @description 「喜欢」按钮状态 Hook
 * @description 读取当前歌曲的本地收藏状态，并提供切换能力。切换时主进程会：
 *              1) 持久化本地收藏；2) 若音源为网易云音乐，发送其「喜欢单曲」全局快捷键。
 * @author 鸡哥
 */

import { useCallback, useEffect, useState } from 'react';

interface UseMediaLikeResult {
  /** 当前歌曲是否已收藏 */
  liked: boolean;
  /** 切换请求进行中，用于避免连点重复派发快捷键 */
  pending: boolean;
  /** 切换收藏状态 */
  toggle: () => void;
}

/**
 * 管理当前歌曲的收藏状态。
 * @description 以「歌名 + 歌手」作为身份标识，切歌时自动重新查询。
 * @param title - 歌曲名
 * @param artist - 歌手名
 * @returns 收藏状态与切换函数
 */
export function useMediaLike(title: string, artist: string): UseMediaLikeResult {
  const [liked, setLiked] = useState(false);
  const [pending, setPending] = useState(false);

  /** 切歌时重新拉取收藏状态 */
  useEffect(() => {
    if (!title) {
      setLiked(false);
      return;
    }
    let cancelled = false;
    window.api?.musicLikeCheck(title, artist)
      .then((value) => {
        if (!cancelled) setLiked(Boolean(value));
      })
      .catch(() => {
        if (!cancelled) setLiked(false);
      });

    // 深度同步：切歌时主动读取网易云真实喜欢状态，以播放器为准
    window.api?.musicLikeSync(title, artist)
      .then((result) => {
        if (!cancelled && result && typeof result.liked === 'boolean') {
          setLiked(result.liked);
        }
      })
      .catch(() => {
        // 同步失败不影响基础状态
      });

    return () => {
      cancelled = true;
    };
  }, [title, artist]);

  const toggle = useCallback((): void => {
    if (pending || !title) return;
    const nextLiked = !liked;
    setLiked(nextLiked);
    setPending(true);
    window.api?.musicLikeToggle(title, artist)
      .then((result) => {
        if (result && typeof result.liked === 'boolean') {
          setLiked(result.liked);
        }
      })
      .catch(() => {
        setLiked(!nextLiked);
      })
      .finally(async () => {
        // 深度同步：回读网易云真实状态校准 UI
        try {
          const syncResult = await window.api?.musicLikeSync(title, artist);
          if (syncResult && typeof syncResult.liked === 'boolean') {
            setLiked(syncResult.liked);
          }
        } catch {
          // 同步失败保持当前状态
        }
        setPending(false);
      });
  }, [pending, liked, title, artist]);

  return { liked, pending, toggle };
}
