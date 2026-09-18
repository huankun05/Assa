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
 * @file smtcWorker.ts
 * @description SMTC 媒体监听 Worker 线程，运行 SmtcMonitor 并将会话变更推送至主进程
 * @author 鸡哥
 */

import { parentPort } from 'worker_threads';
import { SmtcMonitor, type MediaProps, type PlaybackInfo, type TimelineProps } from '@assa/windows-smtc-helper';

if (!parentPort) throw new Error('smtcWorker must be run as a Worker thread');

/** Worker 本地会话缓存条目 */
interface CacheEntry {
  media: MediaProps | null;
  playback: PlaybackInfo | null;
  timeline: TimelineProps | null;
}

/** 会话本地缓存（以 sourceAppId 为键） */
const sessionCache = new Map<string, CacheEntry>();

/**
 * 序列化当前缓存中的会话并通过 parentPort 推送给主进程
 * @param sourceAppId - 应用会话 ID
 */
function postSessionUpdate(sourceAppId: string, includeThumbnail = true): void {
  const entry = sessionCache.get(sourceAppId);
  if (!entry) return;

  const { media, playback, timeline } = entry;
  const mediaPayload = media ? {
    title: media.title,
    artist: media.artist,
    albumTitle: media.albumTitle,
    ...(includeThumbnail ? { thumbnail: media.thumbnail } : {}),
  } : null;

  parentPort!.postMessage({
    type: 'session-update',
    sourceAppId,
    session: {
      media: mediaPayload,
      playback,
      timeline,
    },
  });
}

const smtc = new SmtcMonitor();

smtc.on('session-added', (sourceAppId: string, mediaProps: MediaProps) => {
  const entry: CacheEntry = { media: mediaProps, playback: null, timeline: null };

  /**
   * 刷新 playback / timeline，避免自动连播时缓存的播放状态过期（fix #41）
   * @docs https://github.com/JNTMTMTM/eIsland/issues/41
   */
  try {
    const sessions = smtc.getMediaSessions();
    const fresh = sessions.find((s) => s.sourceAppId === sourceAppId);
    if (fresh) {
      entry.playback = fresh.playback;
      entry.timeline = fresh.timeline;
    }
  } catch { /* 忽略 */ }
  sessionCache.set(sourceAppId, entry);
  postSessionUpdate(sourceAppId);
});

smtc.on('session-removed', (sourceAppId: string) => {
  sessionCache.delete(sourceAppId);
  parentPort!.postMessage({ type: 'session-removed', sourceAppId });
});

smtc.on('session-media-changed', (sourceAppId: string, mediaProps: MediaProps) => {
  const existing = sessionCache.get(sourceAppId) ?? { media: null, playback: null, timeline: null };
  const updated: CacheEntry = { ...existing, media: mediaProps };

  /**
   * 刷新 playback / timeline，避免自动连播时缓存的播放状态过期（fix #41）
   * @docs https://github.com/JNTMTMTM/eIsland/issues/41
   */
  try {
    const sessions = smtc.getMediaSessions();
    const fresh = sessions.find((s) => s.sourceAppId === sourceAppId);
    if (fresh) {
      updated.playback = fresh.playback;
      updated.timeline = fresh.timeline;
    }
  } catch { /* 忽略 */ }
  sessionCache.set(sourceAppId, updated);
  postSessionUpdate(sourceAppId);
});

smtc.on('session-playback-changed', (sourceAppId: string, playbackInfo: PlaybackInfo) => {
  const existing = sessionCache.get(sourceAppId) ?? { media: null, playback: null, timeline: null };
  sessionCache.set(sourceAppId, { ...existing, playback: playbackInfo });
  postSessionUpdate(sourceAppId, false);
});

smtc.on('session-timeline-changed', (sourceAppId: string, timelineProps: TimelineProps) => {
  const existing = sessionCache.get(sourceAppId) ?? { media: null, playback: null, timeline: null };
  sessionCache.set(sourceAppId, { ...existing, timeline: timelineProps });
  postSessionUpdate(sourceAppId, false);
});

/** 接收主进程请求：主动查询当前所有 SMTC 会话（用于播放源检测按钮） */
parentPort.on('message', (msg: { type: string }) => {
  if (msg.type === 'detect-sources') {
    try {
      const sessions = smtc.getMediaSessions();
      parentPort!.postMessage({
        type: 'detect-sources-result',
        sources: sessions.map((s) => ({
          sourceAppId: s.sourceAppId,
          isPlaying: (s.playback?.playbackStatus ?? 0) === 4,
          hasTitle: Boolean(s.media?.title),
          thumbnail: s.media?.thumbnail ?? null,
          media: s.media,
          playback: s.playback,
          timeline: s.timeline,
        })),
      });
    } catch {
      parentPort!.postMessage({ type: 'detect-sources-result', sources: [] });
    }
  }
});

/** 初始化：启动监控 */
smtc.start();

/**
 * 主动枚举当前已存在的 SMTC 会话并推送快照。
 * @description 原生 SmtcMonitor 仅在会话「变化」时触发事件，不会为应用启动前已在播放/暂停的会话
 *              发送 session-added；且 getMediaSessions() 在 smtc.start() 后需短暂异步初始化。
 *              采用「指数退避」在 Worker 线程内低频重试（不影响主进程），成功后即停，
 *              在避免频繁轮询的同时覆盖更新的原生初始化窗口。
 * @returns 是否成功广播了至少一个会话
 */
function emitInitialSessions(): boolean {
  try {
    const initialSessions = smtc.getMediaSessions();
    let emittedAny = false;
    initialSessions.forEach((s) => {
      if (sessionCache.has(s.sourceAppId)) return;
      sessionCache.set(s.sourceAppId, {
        media: s.media,
        playback: s.playback,
        timeline: s.timeline,
      });
      postSessionUpdate(s.sourceAppId);
      emittedAny = true;
    });
    return emittedAny;
  } catch {
    // 单次枚举失败忽略，等待下次按指数退避重试
    return false;
  }
}

/** 指数退避间隔（ms）：早期密集、后期稀疏，总时长覆盖约 20s+ 的原生初始化窗口 */
const BOOT_BACKOFF_MS = [300, 700, 1500, 3000, 6000, 12000];
let bootEmitted = false;

function scheduleBoot(index: number): void {
  if (bootEmitted) return;
  if (index >= BOOT_BACKOFF_MS.length) return;
  setTimeout(() => {
    if (emitInitialSessions()) bootEmitted = true;
    else scheduleBoot(index + 1);
  }, BOOT_BACKOFF_MS[index]);
}

// 先立即尝试一次，再按指数退避补足初始化延迟
try {
  if (emitInitialSessions()) bootEmitted = true;
} catch { /* 忽略 */ }
scheduleBoot(0);

/** 进程退出时清理 */
process.on('exit', () => {
  smtc.stop();
});
