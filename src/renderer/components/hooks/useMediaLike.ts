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

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 喜欢状态同步冷却：短时间内频繁触发（如窗口焦点/可见事件）会打到网易云搜索接口
 * 的频率上限（405「操作频繁」）。这里限制同一首歌的真实状态查询频率，保护接口并降低开销。
 */
const LIKE_SYNC_COOLDOWN_MS = 10000;

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
 * @description 以「歌名 + 歌手」作为身份标识，切歌时自动重新查询；
 *              提供专辑可提升网易云「认准同一首」的匹配精度。
 * @param title - 歌曲名
 * @param artist - 歌手名
 * @param album - 专辑名（可选，用于精确匹配）
 * @returns 收藏状态与切换函数
 */
export function useMediaLike(title: string, artist: string, album?: string): UseMediaLikeResult {
  const [liked, setLiked] = useState(false);
  const [pending, setPending] = useState(false);
  /** 最近一次真实状态同步时间，用于冷却保护（避免频繁触发网易云搜索频率上限） */
  const lastSyncAtRef = useRef(0);

  /** 以网易云播放器真实喜欢状态为准刷新一次（写本地收藏 + 更新 UI） */
  useEffect(() => {
    if (!title) {
      setLiked(false);
      lastSyncAtRef.current = 0;
      return;
    }
    let cancelled = false;

    const syncNow = (): void => {
      if (cancelled) return;
      // 同首歌冷却保护：落在冷却窗口内则跳过，避免「一触就刷」触发接口频率上限
      const now = Date.now();
      if (now - lastSyncAtRef.current < LIKE_SYNC_COOLDOWN_MS) return;
      lastSyncAtRef.current = now;

      window.api?.musicLikeSync(title, artist, album)
        .then((result) => {
          if (!cancelled && result && typeof result.liked === 'boolean') {
            setLiked(result.liked);
          }
        })
        .catch(() => {
          // 单次同步失败忽略，等待下次触发
        });
    };

    // 切歌时重置冷却，确保新歌能立即同步一次
    lastSyncAtRef.current = 0;

    // 切歌 / 首次进入歌词页即同步一次
    syncNow();

    // 本地收藏快速兜底（不依赖网络即可获得基础状态，避免红心闪一下再修正）
    window.api?.musicLikeCheck(title, artist)
      .then((value) => {
        if (!cancelled) setLiked(Boolean(value));
      })
      .catch(() => {
        if (!cancelled) setLiked(false);
      });

    // 事件驱动同步（零轮询）：窗口重新获得焦点或重新可见时，
    // 以播放器真实喜欢状态为准刷新，覆盖「用户在网易云手动改红心、切回灵动岛查看」的场景
    const onFocus = () => syncNow();
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncNow();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [title, artist, album]);

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
        // toggle 后不再立刻同步，避免 hotkey 未生效时被覆盖导致红心闪烁
        // 真实状态以切歌时的 musicLikeSync 为准，或用户手动刷新
        setPending(false);
      });
  }, [pending, liked, title, artist]);

  return { liked, pending, toggle };
}
