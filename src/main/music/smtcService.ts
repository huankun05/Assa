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
 * @file smtcService.ts
 * @description SMTC (System Media Transport Controls) 服务模块
 * @description 管理 Windows 系统媒体会话，处理播放状态和音源切换
 * @author 鸡哥
 */

import { BrowserWindow } from 'electron';
import { Worker } from 'worker_threads';
import { join } from 'path';
import type { SourceSwitchRequestData } from '../../preload/types/media';
import { readNeteaseWatcherPosition, subscribeNeteaseWatcherPosition } from './neteaseWatcher';
import { searchNeteaseTrack } from './providers/neteaseBusinessService';
import { isBrowserSource } from '../../shared/browserSource';

interface DetectedSourceEntry {
  isPlaying: boolean;
  hasTitle: boolean;
  updatedAt: number;
}

interface SmtcSessionRuntimeEntry {
  payload: {
    title: string;
    artist: string;
    album: string;
    duration_ms: number;
    position_ms: number;
    isPlaying: boolean;
    thumbnail: string | null;
    canFastForward: boolean;
    canSkip: boolean;
    canLike: boolean;
    canChangeVolume: boolean;
    canSetOutput: boolean;
    deviceId: string;
  };
  hasTitle: boolean;
  isPlaying: boolean;
  playStartedAt: number;
  updatedAt: number;
}

interface CreateSmtcServiceOptions {
  getMainWindow: () => BrowserWindow | null;
  getWhitelist: () => string[];
  getSmtcUnsubscribeMs: () => number;
  unsubscribeNeverValue: number;
  cleanupIntervalMs: number;
}

interface PublicSessionRuntimeEntry {
  payload: unknown;
  hasTitle: boolean;
}

interface SmtcService {
  initWorker: () => void;
  cleanupWorker: () => void;
  isWhitelisted: () => boolean;
  pickDetectedSourceAppId: () => Promise<string>;
  detectAllSources: () => Promise<Array<{ sourceAppId: string; isPlaying: boolean; hasTitle: boolean; thumbnail: string | null }>>;
  getPendingSourceSwitchId: () => string;
  setPendingSourceSwitchId: (id: string) => void;
  getPendingSourceSwitchEntry: () => unknown;
  clearPendingSourceSwitchEntry: () => void;
  getCurrentDeviceId: () => string;
  setCurrentDeviceId: (id: string) => void;
  getSmtcSessionRuntime: () => Map<string, PublicSessionRuntimeEntry> | null;
}

/**
 * 创建 SMTC 服务实例
 * @description 初始化 SMTC 监控服务，管理媒体会话和音源切换
 * @param options - 服务配置选项，包含窗口获取和白名单配置
 * @returns SMTC 服务对象，包含初始化和清理方法
 */
export function createSmtcService(options: CreateSmtcServiceOptions): SmtcService {
  let smtcWorker: Worker | null = null;
  let currentDeviceId = options.getWhitelist()[0] || '';
  const detectedSourceRuntime = new Map<string, DetectedSourceEntry>();
  let smtcSessionRuntime: Map<string, SmtcSessionRuntimeEntry> | null = null;
  let pendingSourceSwitchId = '';
  let pendingSourceSwitchEntry: SmtcSessionRuntimeEntry | null = null;
  let lastSmtcCleanupAt = 0;
  let pendingDetectResolve: ((sources: Array<{ sourceAppId: string; isPlaying: boolean; hasTitle: boolean; thumbnail: string | null }>) => void) | null = null;
  let watchdogTimer: ReturnType<typeof setInterval> | null = null;
  let timelineLessReadTimer: ReturnType<typeof setInterval> | null = null;
  let timelineLessUnsubscribe: (() => void) | null = null;
  let lastEventTime = 0;
  const WATCHDOG_TIMEOUT_MS = 5000;
  const WATCHDOG_CHECK_INTERVAL_MS = 2000;

  /**
   * 无时间轴会话的真实进度修正。
   * SMTC 对网易云只提供歌名/歌手（无 timeline），此处用 netease-watcher 读到的真实进度作基准，
   * 进度 = 真实基准 + (now - 读取时刻)，保证「中途接入」也能立刻跳到正确位置并被 RAF 持续推进。
   */
  const timelineLessPos = new Map<string, { offsetMs: number; readAt: number; durationMs: number }>();
  /** WS 断线时低频 HTTP 直接读取的兜底轮询间隔（高于它则依赖 WS 事件推送，几乎零轮询） */
  const WS_BACKUP_POLL_MS = 5000;
  /** WS 推送最近一次识别到的网易云歌曲 ID，用于切歌瞬间的一致性校验 */
  let currentWatcherSongId: number | undefined;

  /** 无真实进度时的墙钟估算：position = offsetMs + (now - at)；切歌复位、暂停冻结 */
  const estimatePos = new Map<string, { offsetMs: number; at: number }>();

  /** 判断 SMTC 会话是否属于网易云（无时间轴，需用 UIA 真实进度修正） */
  function isNeteaseDeviceId(deviceId: string): boolean {
    return (deviceId ?? '').toLowerCase().includes('cloudmusic');
  }

  /**
   * 推进墙钟估算：
   * - 暂停：把当前估算值冻结（offsetMs 固化，at=now 使暂停期间不再增加）
   * - 切歌/新开始：从 0 起算
   * - 播放中续播：不落地，靠 offsetMs + (now - at) 实时推进
   */
  function tickEstimatePos(
    deviceId: string,
    isPlaying: boolean,
    prevIsPlaying: boolean,
    trackChanged: boolean,
    now: number,
  ): void {
    const e = estimatePos.get(deviceId);
    if (!isPlaying) {
      if (e) {
        e.offsetMs = Math.max(0, e.offsetMs + (now - e.at));
        e.at = now;
      }
      return;
    }
    if (trackChanged || !prevIsPlaying || !e) {
      estimatePos.set(deviceId, { offsetMs: 0, at: now });
    }
  }

  /**
   * 计算无时间轴会话（网易云）的真实进度。
   * 优先级：UIA 真实基准 > 墙钟估算 > 历史值。
   * @returns 解析出的 { position_ms, duration_ms }；无任何可参考值时返回 null
   */
  function resolveTimelineLess(
    deviceId: string,
    prev: { position_ms: number; duration_ms: number } | undefined,
    isPlaying: boolean,
    now: number,
  ): { position_ms: number; duration_ms: number } | null {
    const base = timelineLessPos.get(deviceId);
    if (base) {
      let pos = base.offsetMs;
      if (isPlaying) pos = base.offsetMs + (now - base.readAt);
      const dur = base.durationMs > 0 ? base.durationMs : (prev?.duration_ms ?? 0);
      if (dur > 0) pos = Math.min(pos, dur);
      return { position_ms: Math.max(0, pos), duration_ms: dur };
    }
    const e = estimatePos.get(deviceId);
    if (e) {
      const pos = isPlaying ? e.offsetMs + (now - e.at) : e.offsetMs;
      return { position_ms: Math.max(0, pos), duration_ms: prev?.duration_ms ?? 0 };
    }
    return prev ? { position_ms: prev.position_ms, duration_ms: prev.duration_ms } : null;
  }

  function isWhitelisted(): boolean {
    const id = currentDeviceId.toLowerCase();
    return options.getWhitelist().some((name) => id.includes(name.toLowerCase()));
  }

  function pickDetectedSourceAppId(): string {
    let bestPlaying = '';
    let bestPlayingAt = 0;
    let bestTitled = '';
    let bestTitledAt = 0;

    detectedSourceRuntime.forEach((entry, sourceAppId) => {
      if (entry.isPlaying && entry.updatedAt >= bestPlayingAt) {
        bestPlaying = sourceAppId;
        bestPlayingAt = entry.updatedAt;
      }
      if (entry.hasTitle && entry.updatedAt >= bestTitledAt) {
        bestTitled = sourceAppId;
        bestTitledAt = entry.updatedAt;
      }
    });

    return bestPlaying || bestTitled;
  }

  function cleanupStaleSmtcRuntime(sessionRuntime: Map<string, SmtcSessionRuntimeEntry>): void {
    const now = Date.now();
    const ttlMs = options.getSmtcUnsubscribeMs();
    if (ttlMs === options.unsubscribeNeverValue) return;

    detectedSourceRuntime.forEach((entry, sourceAppId) => {
      if (now - entry.updatedAt > ttlMs) {
        detectedSourceRuntime.delete(sourceAppId);
      }
    });

    sessionRuntime.forEach((entry, sourceAppId) => {
      if (now - entry.updatedAt > ttlMs) {
        sessionRuntime.delete(sourceAppId);
        if (sourceAppId === pendingSourceSwitchId) {
          pendingSourceSwitchId = '';
          pendingSourceSwitchEntry = null;
        }
        if (sourceAppId === currentDeviceId) {
          currentDeviceId = '';
        }
      }
    });
  }

  function initWorker(): void {
    try {
      const sessionRuntime = new Map<string, SmtcSessionRuntimeEntry>();
      smtcSessionRuntime = sessionRuntime;

      // 网易云 songId 缓存：主进程统一搜出的 songId 随 nowplaying:info 下发，
      // 让渲染端歌词与喜欢状态基于「同一首歌」（避免主进程/渲染端两套独立搜索选到不同版本）。
      // 仅在已登录（有 cookie）时 searchNeteaseTrack 才有结果；未登录时恒为 null，渲染端回退自搜。
      const neteaseSongIdCache = new Map<string, number | null>();
      const neteaseTrackKey = (title: string, artist: string): string => `${title}||${artist}`;

      const emitCurrentSession = (includeThumbnail = false): void => {
        const currentEntry = currentDeviceId ? sessionRuntime.get(currentDeviceId) : undefined;
        let payload = currentEntry?.hasTitle ? currentEntry.payload : null;
        let resolvedSongId: number | null = null;
        // 无时间轴会话（网易云）：用 UIA 基准 + 播放经时实时推算，避免进度被锁死在 0
        if (payload && currentEntry && isNeteaseDeviceId(payload.deviceId)) {
          scheduleNeteaseSongId(payload.deviceId, payload.title, payload.artist, payload.album);
          resolvedSongId = neteaseSongIdCache.get(neteaseTrackKey(payload.title, payload.artist)) ?? null;
          const live = resolveTimelineLess(
            payload.deviceId,
            { position_ms: payload.position_ms, duration_ms: payload.duration_ms },
            currentEntry.isPlaying,
            Date.now(),
          );
          if (live) {
            payload = { ...payload, position_ms: live.position_ms, duration_ms: live.duration_ms };
          }
        }
        // 仅在已解析出 songId（网易云已登录且搜索命中）时才把它附到下发载荷上，
        // 未解析（非网易云 / 未登录 / 搜索中）保持与改动前完全一致的载荷结构，避免破坏既有消费方与精确匹配断言。
        const outboundPayload = payload
          ? (() => {
            const basePayload = includeThumbnail
              ? payload
              : {
                title: payload.title,
                artist: payload.artist,
                album: payload.album,
                duration_ms: payload.duration_ms,
                position_ms: payload.position_ms,
                isPlaying: payload.isPlaying,
                canFastForward: payload.canFastForward,
                canSkip: payload.canSkip,
                canLike: payload.canLike,
                canChangeVolume: payload.canChangeVolume,
                canSetOutput: payload.canSetOutput,
                deviceId: payload.deviceId,
              };
            return resolvedSongId !== null
              ? { ...basePayload, songId: resolvedSongId }
              : basePayload;
          })()
          : payload;
        BrowserWindow.getAllWindows().forEach((win) => {
          if (!win.isDestroyed()) {
            win.webContents.send('nowplaying:info', outboundPayload);
          }
        });
      };

      /**
       * 网易云已登录时，用主进程 searchNeteaseTrack 解析当前曲目的 songId，
       * 缓存后重新推送一次 nowplaying:info，使渲染端歌词与喜欢状态基于同一首歌。
       * 未登录（无 cookie）时 searchNeteaseTrack 返回 null，songId 保持 null，渲染端回退自搜。
       */
      function scheduleNeteaseSongId(deviceId: string, title: string, artist: string, album: string): void {
        if (!title || !artist) return;
        const key = neteaseTrackKey(title, artist);
        if (neteaseSongIdCache.has(key)) return; // 已解析（含明确 null），避免重复触发
        neteaseSongIdCache.set(key, null); // 占位，防止并发重复搜索
        if (neteaseSongIdCache.size > 300) neteaseSongIdCache.clear(); // 防无界增长
        void searchNeteaseTrack(title, artist, album)
          .then((track) => {
            neteaseSongIdCache.set(key, track ? track.id : null);
            // 仍在同一曲目时重推一次带 songId 的 nowplaying:info
            const entry = sessionRuntime.get(deviceId);
            if (entry?.hasTitle && entry.payload.title === title && entry.payload.artist === artist) {
              emitCurrentSession();
            }
          })
          .catch(() => {
            neteaseSongIdCache.set(key, null);
          });
      }

      const emitSourceSwitchRequest = (sourceAppId: string, title: string, artist: string): void => {
        const mainWindow = options.getMainWindow();
        if (!mainWindow || mainWindow.isDestroyed()) return;
        const payload: SourceSwitchRequestData = { sourceAppId, title, artist };
        mainWindow.webContents.send('media:source-switch-request', payload);
      };

      /**
       * 兜底读取网易云真实进度并写入基准。
       * 日常由 WS 订阅（subscribeNeteaseWatcherPosition）推送；此函数为 WS 极端断线时的低频兜底，
       * 直接走 netease-watcher 本地 HTTP 接口读取真实进度（其自带失败退避，请求很轻）。
       * （曾用于界面 UIA 读取的旧兜底已移除——CEF 无障碍树为空读不到，且 15s 节流空转。）
       */
      const refreshTimelineLessBase = async (deviceId: string): Promise<void> => {
        try {
          const watcher = await readNeteaseWatcherPosition();
          if (!watcher) return;
          timelineLessPos.set(deviceId, {
            offsetMs: Math.max(0, watcher.position_ms ?? 0),
            readAt: Date.now(),
            durationMs: watcher.duration_ms && watcher.duration_ms > 0 ? watcher.duration_ms : 0,
          });
          if (currentDeviceId === deviceId) emitCurrentSession();
        } catch {
          /* 读取异常忽略，等待下一轮兜底或 WS 推送 */
        }
      };

      const workerPath = join(__dirname, 'smtcWorker.js');
      smtcWorker = new Worker(workerPath);

      smtcWorker.on('message', (msg: {
        type: string;
        sourceAppId?: string;
        session?: {
          media: { title: string; artist: string; albumTitle: string; thumbnail?: string | null } | null;
          playback: { playbackStatus: number; playbackType: number } | null;
          timeline: { position: number; duration: number } | null;
        };
        sources?: Array<{
          sourceAppId: string;
          isPlaying: boolean;
          hasTitle: boolean;
          thumbnail: string | null;
          media?: { title: string; artist: string; albumTitle: string; thumbnail?: string | null } | null;
          playback?: { playbackStatus: number; playbackType: number } | null;
          timeline?: { position: number; duration: number } | null;
        }>;
      }) => {
        if (msg.type === 'detect-sources-result') {
          lastEventTime = Date.now();
          const now = Date.now();
          const simplifiedSources: Array<{ sourceAppId: string; isPlaying: boolean; hasTitle: boolean; thumbnail: string | null }> = [];
          (msg.sources ?? []).forEach((s) => {
            if (s.media || s.playback || s.timeline) {
              const entry = sessionRuntime.get(s.sourceAppId);
              const prevPayload = entry?.payload;
              const sameTrack = Boolean(
                prevPayload
                && prevPayload.title === (s.media?.title ?? '')
                && prevPayload.artist === (s.media?.artist ?? ''),
              );
              const durationMs = s.timeline
                ? Math.round((s.timeline.duration ?? 0) * 1000)
                : sameTrack ? prevPayload!.duration_ms : 0;
              const positionMs = s.timeline
                ? Math.round((s.timeline.position ?? 0) * 1000)
                : sameTrack ? prevPayload!.position_ms : 0;
              const nextThumbnail = s.thumbnail ?? prevPayload?.thumbnail ?? null;
              const payload = {
                title: s.media?.title ?? '',
                artist: s.media?.artist ?? '',
                album: s.media?.albumTitle ?? '',
                duration_ms: durationMs,
                position_ms: positionMs,
                isPlaying: s.isPlaying,
                thumbnail: nextThumbnail,
                canFastForward: false,
                canSkip: false,
                canLike: false,
                canChangeVolume: false,
                canSetOutput: false,
                deviceId: s.sourceAppId,
              };
              sessionRuntime.set(s.sourceAppId, {
                payload,
                hasTitle: s.hasTitle,
                isPlaying: s.isPlaying,
                playStartedAt: s.isPlaying ? (entry?.isPlaying ? entry.playStartedAt : now) : 0,
                updatedAt: now,
              });
              simplifiedSources.push({
                sourceAppId: s.sourceAppId,
                isPlaying: s.isPlaying,
                hasTitle: s.hasTitle,
                thumbnail: nextThumbnail,
              });
            }
          });

          if (pendingDetectResolve) {
            pendingDetectResolve(simplifiedSources);
            pendingDetectResolve = null;
          }

          if (currentDeviceId) {
            const currentEntry = sessionRuntime.get(currentDeviceId);
            if (currentEntry?.hasTitle) {
              const prev = smtcSessionRuntime?.get(currentDeviceId);
              const changed = !prev
                || prev.payload.title !== currentEntry.payload.title
                || prev.payload.artist !== currentEntry.payload.artist
                || prev.payload.isPlaying !== currentEntry.payload.isPlaying
                || prev.payload.duration_ms !== currentEntry.payload.duration_ms
                || prev.payload.position_ms !== currentEntry.payload.position_ms;
              if (changed) {
                emitCurrentSession(true);
              }
            }
          }
          return;
        }

        const mainWindow = options.getMainWindow();
        if (!mainWindow || mainWindow.isDestroyed()) return;

        if (msg.type === 'session-removed') {
          lastEventTime = Date.now();
          if (msg.sourceAppId) {
            detectedSourceRuntime.delete(msg.sourceAppId);
            sessionRuntime.delete(msg.sourceAppId);
            if (msg.sourceAppId === pendingSourceSwitchId) {
              pendingSourceSwitchId = '';
              pendingSourceSwitchEntry = null;
            }
          }
          if (msg.sourceAppId === currentDeviceId) {
            currentDeviceId = '';
            emitCurrentSession();
          }
          return;
        }

        if (msg.type !== 'session-update') return;

        lastEventTime = Date.now();
        const { sourceAppId = '', session } = msg;
        const { media, playback, timeline } = session ?? {};
        const now = Date.now();

        if (now - lastSmtcCleanupAt >= options.cleanupIntervalMs) {
          cleanupStaleSmtcRuntime(sessionRuntime);
          lastSmtcCleanupAt = now;
        }

        // 浏览器网页播放不在本地播放器识别范畴：整条会话直接忽略，
        // 否则脏标题（如「抖音 - 记录美好生活」）会进入 detectedSourceRuntime，
        // 被 pickDetectedSourceAppId / detectAllSources 选中后退化成全 provider 轮询，匹配错乱。
        // 即使在白名单里手动加入了浏览器 AUMID 也同样拦截。
        if (sourceAppId && isBrowserSource(sourceAppId)) return;

        if (sourceAppId) {
          detectedSourceRuntime.set(sourceAppId, {
            isPlaying: (playback?.playbackStatus ?? 0) === 4,
            hasTitle: Boolean(media?.title),
            updatedAt: now,
          });
        }

        const sourceAppIdLower = sourceAppId.toLowerCase();
        if (!options.getWhitelist().some((name) => sourceAppIdLower.includes(name.toLowerCase()))) return;

        const hasTitle = Boolean(media?.title);
        const isPlaying = (playback?.playbackStatus ?? 0) === 4;

        const prevEntry = sessionRuntime.get(sourceAppId);
        const prevPayload = prevEntry?.payload;
        const hasThumbnailUpdate = Boolean(media && Object.prototype.hasOwnProperty.call(media, 'thumbnail'));
        const nextThumbnail = hasThumbnailUpdate
          ? media?.thumbnail ?? null
          : prevPayload?.thumbnail ?? null;
        const sameTrack = Boolean(
          prevPayload
          && prevPayload.title === (media?.title ?? '')
          && prevPayload.artist === (media?.artist ?? ''),
        );
        // 无时间轴会话（网易云）：维护墙钟估算，使进度能实时推进、暂停不再回 0
        if (isNeteaseDeviceId(sourceAppId)) {
          tickEstimatePos(sourceAppId, isPlaying, Boolean(prevEntry?.isPlaying), !sameTrack, now);
        }
        const shouldEmitThumbnail = hasThumbnailUpdate && (!sameTrack || nextThumbnail !== (prevPayload?.thumbnail ?? null));
        const durationMs = timeline
          ? Math.round((timeline.duration ?? 0) * 1000)
          : sameTrack ? prevPayload!.duration_ms : 0;
        const positionMs = timeline
          ? Math.round((timeline.position ?? 0) * 1000)
          : sameTrack ? prevPayload!.position_ms : 0;

        const payload = {
          title: media?.title ?? '',
          artist: media?.artist ?? '',
          album: media?.albumTitle ?? '',
          duration_ms: durationMs,
          position_ms: positionMs,
          isPlaying,
          thumbnail: nextThumbnail,
          canFastForward: false,
          canSkip: false,
          canLike: false,
          canChangeVolume: false,
          canSetOutput: false,
          deviceId: sourceAppId,
        };

        let playStartedAt = prevEntry?.playStartedAt ?? 0;
        if (isPlaying) {
          if (!prevEntry?.isPlaying || playStartedAt <= 0) {
            playStartedAt = Date.now();
          }
        } else {
          playStartedAt = 0;
        }

        sessionRuntime.set(sourceAppId, {
          payload,
          hasTitle,
          isPlaying,
          playStartedAt,
          updatedAt: now,
        });

        if (!currentDeviceId) {
          const bestId = pickDetectedSourceAppId();
          const bestEntry = bestId ? sessionRuntime.get(bestId) : undefined;
          if (bestEntry?.hasTitle) {
            currentDeviceId = bestId;
            emitCurrentSession(true);
            if (isNeteaseDeviceId(bestId)) void refreshTimelineLessBase(bestId);
          }
          return;
        }

        if (sourceAppId === currentDeviceId) {
          const resumingFromPause = isPlaying && !prevEntry?.isPlaying;
          emitCurrentSession(shouldEmitThumbnail || resumingFromPause);
          if (!isPlaying && !hasTitle) {
            currentDeviceId = '';
          }
          return;
        }

        if (isPlaying && hasTitle) {
          const lockedEntry = sessionRuntime.get(currentDeviceId);
          if (lockedEntry?.isPlaying) {
            if (pendingSourceSwitchId === sourceAppId) {
              pendingSourceSwitchEntry = sessionRuntime.get(sourceAppId) ?? null;
              return;
            }
            pendingSourceSwitchId = sourceAppId;
            pendingSourceSwitchEntry = sessionRuntime.get(sourceAppId) ?? null;
            emitSourceSwitchRequest(sourceAppId, payload.title, payload.artist);
          } else {
            currentDeviceId = sourceAppId;
            emitCurrentSession(true);
            if (isNeteaseDeviceId(sourceAppId)) void refreshTimelineLessBase(sourceAppId);
          }
        }
      });

      smtcWorker.on('error', (err) => {
        console.error('[SMTC] Worker error:', err);
      });

      smtcWorker.on('exit', (code) => {
        if (code !== 0) console.error('[SMTC] Worker exited with code:', code);
      });

      const checkWatchdog = () => {
        if (!currentDeviceId || !smtcWorker) return;
        if (lastEventTime === 0) {
          lastEventTime = Date.now();
          return;
        }
        if (Date.now() - lastEventTime >= WATCHDOG_TIMEOUT_MS) {
          smtcWorker.postMessage({ type: 'detect-sources' });
        }
      };

      watchdogTimer = setInterval(checkWatchdog, WATCHDOG_CHECK_INTERVAL_MS);

      // 无时间轴会话（网易云）播放期间定期读取真实进度，纠正“从头开始”的推算漂移。
      // 日常：netease-watcher 的 WebSocket 推送（事件驱动、切歌/进度变化才下发，零轮询资源损耗）；
      // 联调/缺推送的分支：UIA 兜底在 refreshTimelineLessBase 内自带 15s 节流。
      // WS 订阅全局只要一个，收到推送即更新对应网易云会话的实时进度基准并重广播。
      const wsUpdate = (snap: import('./neteaseWatcher').NeteaseWatcherSnapshot): void => {
        const id = currentDeviceId;
        if (!id) return;
        const entry = sessionRuntime.get(id);
        if (!entry?.hasTitle) return;
        if (!isNeteaseDeviceId(id)) return;
        // 推送附带歌曲 ID 时，与上一首做一致性校验：切歌瞬间避免把旧歌进度写到新歌上
        if (snap.id && currentWatcherSongId !== undefined && currentWatcherSongId !== snap.id) return;
        if (snap.id) currentWatcherSongId = snap.id;
        if (snap.duration_ms <= 0 && snap.id === undefined) return;
        timelineLessPos.set(id, {
          offsetMs: Math.max(0, snap.position_ms),
          readAt: Date.now(),
          durationMs: snap.duration_ms > 0 ? snap.duration_ms : (timelineLessPos.get(id)?.durationMs ?? 0),
        });
        if (currentDeviceId === id) emitCurrentSession();
      };
      timelineLessUnsubscribe = subscribeNeteaseWatcherPosition(wsUpdate);

      // 保留低频直接读取作为兜底：若 WS 因故未建立（如 watcher 高负载），仍能在播放期间修正漂移。
      // 此定时器仅触发 refreshTimelineLessBase；其内部 watcher HTTP 读取优先，UIA 兜底自带 15s 节流。
      timelineLessReadTimer = setInterval(() => {
        const id = currentDeviceId;
        if (!id) return;
        const entry = sessionRuntime.get(id);
        if (!entry?.hasTitle || !entry.isPlaying) return;
        if (!isNeteaseDeviceId(id)) return;
        void refreshTimelineLessBase(id);
      }, WS_BACKUP_POLL_MS);

      /** 启动时探测一次当前 SMTC 会话，补发启动前已存在播放信息（Worker 已用指数退避兜底） */
      const bootstrapCurrentSession = (): void => {
        if (!smtcWorker) return;
        const handler = (msg: { type: string; sources?: Array<{ sourceAppId: string; isPlaying: boolean; hasTitle: boolean; thumbnail: string | null }> }) => {
          if (msg.type !== 'detect-sources-result') return;
          smtcWorker!.off('message', handler);
          const now = Date.now();
          (msg.sources ?? []).forEach((s) => {
            detectedSourceRuntime.set(s.sourceAppId, {
              isPlaying: s.isPlaying,
              hasTitle: s.hasTitle,
              updatedAt: now,
            });
          });
          const bestId = pickDetectedSourceAppId();
          const bestEntry = bestId ? sessionRuntime.get(bestId) : undefined;
          if (bestEntry?.hasTitle) {
            currentDeviceId = bestId;
            if (isNeteaseDeviceId(bestId) && !estimatePos.has(bestId)) {
              estimatePos.set(bestId, { offsetMs: 0, at: now });
            }
            emitCurrentSession(true);
            if (isNeteaseDeviceId(bestId)) void refreshTimelineLessBase(bestId);
          }
        };
        smtcWorker.on('message', handler);
        smtcWorker.postMessage({ type: 'detect-sources' });
        setTimeout(() => smtcWorker?.off('message', handler), 4000);
      };

      bootstrapCurrentSession();
    } catch (err) {
      console.error('[SMTC] Worker init error:', err);
    }
  }

  function requestFreshSources(): Promise<Array<{ sourceAppId: string; isPlaying: boolean; hasTitle: boolean; thumbnail: string | null }>> {
    if (!smtcWorker) return Promise.resolve([]);

    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        pendingDetectResolve = null;
        resolve([]);
      }, 3000);

      pendingDetectResolve = (sources) => {
        clearTimeout(timeout);
        const now = Date.now();
        sources.forEach((s) => {
          detectedSourceRuntime.set(s.sourceAppId, {
            isPlaying: s.isPlaying,
            hasTitle: s.hasTitle,
            updatedAt: now,
          });
        });
        resolve(sources);
      };

      smtcWorker!.postMessage({ type: 'detect-sources' });
    });
  }

  function pickDetectedSourceAppIdAsync(): Promise<string> {
    const syncResult = pickDetectedSourceAppId();
    if (syncResult) return Promise.resolve(syncResult);
    return requestFreshSources().then(() => pickDetectedSourceAppId());
  }

  function detectAllSources(): Promise<Array<{ sourceAppId: string; isPlaying: boolean; hasTitle: boolean; thumbnail: string | null }>> {
    return requestFreshSources();
  }

  function cleanupWorker(): void {
    if (pendingDetectResolve) {
      pendingDetectResolve([]);
      pendingDetectResolve = null;
    }
    if (watchdogTimer) {
      clearInterval(watchdogTimer);
      watchdogTimer = null;
    }
    if (timelineLessReadTimer) {
      clearInterval(timelineLessReadTimer);
      timelineLessReadTimer = null;
    }
    if (timelineLessUnsubscribe) {
      timelineLessUnsubscribe();
      timelineLessUnsubscribe = null;
    }
    if (smtcWorker) {
      smtcWorker.terminate();
      smtcWorker = null;
    }
    detectedSourceRuntime.clear();
    smtcSessionRuntime?.clear();
    smtcSessionRuntime = null;
    pendingSourceSwitchId = '';
    pendingSourceSwitchEntry = null;
    currentDeviceId = '';
    lastSmtcCleanupAt = 0;
    lastEventTime = 0;
  }

  return {
    initWorker,
    cleanupWorker,
    isWhitelisted,
    pickDetectedSourceAppId: pickDetectedSourceAppIdAsync,
    detectAllSources,
    getPendingSourceSwitchId: () => pendingSourceSwitchId,
    setPendingSourceSwitchId: (id) => {
      pendingSourceSwitchId = id;
    },
    getPendingSourceSwitchEntry: () => pendingSourceSwitchEntry,
    clearPendingSourceSwitchEntry: () => {
      pendingSourceSwitchEntry = null;
    },
    getCurrentDeviceId: () => currentDeviceId,
    setCurrentDeviceId: (id) => {
      currentDeviceId = id;
    },
    getSmtcSessionRuntime: () => smtcSessionRuntime,
  };
}
