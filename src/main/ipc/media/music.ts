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
 * @file music.ts
 * @description 音乐相关 IPC 处理模块
 * @description 处理播放器白名单、歌词设置和 SMTC 配置的 IPC 请求
 * @author 鸡哥
 */

import { ipcMain } from 'electron';
import { join } from 'path';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { broadcastSettingChange } from '../../utils/broadcast';
import {
  buildTrackKey,
  dispatchLikeHotkey,
  isNeteaseSource,
  parseHotkeyCombo,
  readLikedSongs,
  readMusicLikeHotkey,
  writeLikedSongs,
  writeMusicLikeHotkey,
} from '../../music/mediaLike';
import { checkNeteaseLikeState, searchNeteaseTrack } from '../../music/providers/neteaseBusinessService';

/**
 * 真实喜欢状态同步冷却：短时间内对同一首歌频繁发起会打到网易云搜索接口的频率上限（405「操作频繁」）。
 * 这里在主进程按「歌名||歌手」缓存最近一次真实状态结果，冷却窗口内直接返回缓存，避免重复打接口。
 * 放在主进程层，渲染进程组件如何重建都绕不过。
 */
const LIKE_SYNC_COOLDOWN_MS = 10000;
const likeSyncCache = new Map<string, { at: number; liked: boolean; source: string }>();

interface RegisterMusicIpcHandlersOptions {
  storeDir: string;
  whitelistStoreKey: string;
  lyricsSourceStoreKey: string;
  providerModeStoreKey: string;
  lyricsKaraokeStoreKey: string;
  lyricsClockStoreKey: string;
  lyricsCalibrateEnabledStoreKey: string;
  lyricsCalibrateDelayStoreKey: string;
  lyricsEnabledStoreKey: string;
  lyricsTranslationEnabledStoreKey: string;
  smtcUnsubscribeStoreKey: string;
  defaultLyricsKaraoke: boolean;
  defaultLyricsClock: boolean;
  defaultLyricsCalibrateEnabled: boolean;
  defaultLyricsCalibrateDelay: number;
  getWhitelist: () => string[];
  setWhitelist: (list: string[]) => void;
  readLyricsSourceConfig: () => string;
  getSmtcUnsubscribeMs: () => number;
  setSmtcUnsubscribeMs: (value: number) => void;
  sanitizeSmtcUnsubscribeMs: (value: unknown) => number;
  detectAllSources: () => Promise<Array<{ sourceAppId: string; isPlaying: boolean; hasTitle: boolean; thumbnail: string | null }>>;
  /** 当前 SMTC 音源标识，用于判断是否为网易云音乐 */
  getCurrentDeviceId: () => string;
}

/**
 * 注册音乐相关 IPC 处理器
 * @description 注册白名单、歌词源、歌词效果和 SMTC 设置的 IPC 事件处理器
 * @param options - 配置选项，包含存储目录、键名和配置管理函数
 */
export function registerMusicIpcHandlers(options: RegisterMusicIpcHandlersOptions): void {
  ipcMain.handle('music:whitelist:get', () => {
    return options.getWhitelist();
  });

  ipcMain.handle('music:whitelist:set', (event, list: string[]) => {
    try {
      options.setWhitelist(list);
      const filePath = join(options.storeDir, `${options.whitelistStoreKey}.json`);
      writeFileSync(filePath, JSON.stringify(list, null, 2), 'utf-8');
      broadcastSettingChange(event.sender.id, 'store:music-whitelist', list);
      return true;
    } catch (err) {
      console.error('[Whitelist] persist error:', err);
      return false;
    }
  });

  ipcMain.handle('music:lyrics-source:get', () => {
    return options.readLyricsSourceConfig();
  });

  ipcMain.handle('music:lyrics-source:set', (_event, source: string) => {
    try {
      const filePath = join(options.storeDir, `${options.lyricsSourceStoreKey}.json`);
      writeFileSync(filePath, JSON.stringify(source, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[LyricsSource] persist error:', err);
      return false;
    }
  });

  ipcMain.handle('music:provider-mode:get', () => {
    try {
      const filePath = join(options.storeDir, `${options.providerModeStoreKey}.json`);
      if (!existsSync(filePath)) return 'guest';
      const value = JSON.parse(readFileSync(filePath, 'utf-8'));
      return value === 'logged-in' ? 'logged-in' : 'guest';
    } catch {
      return 'guest';
    }
  });

  ipcMain.handle('music:provider-mode:set', (_event, mode: string) => {
    try {
      const filePath = join(options.storeDir, `${options.providerModeStoreKey}.json`);
      writeFileSync(filePath, JSON.stringify(mode === 'logged-in' ? 'logged-in' : 'guest', null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[MusicProviderMode] persist error:', err);
      return false;
    }
  });

  ipcMain.handle('music:lyrics-karaoke:get', () => {
    try {
      const filePath = join(options.storeDir, `${options.lyricsKaraokeStoreKey}.json`);
      if (!existsSync(filePath)) return options.defaultLyricsKaraoke;
      const raw = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      return typeof data === 'boolean' ? data : options.defaultLyricsKaraoke;
    } catch {
      return options.defaultLyricsKaraoke;
    }
  });

  ipcMain.handle('music:lyrics-karaoke:set', (event, enabled: boolean) => {
    try {
      const filePath = join(options.storeDir, `${options.lyricsKaraokeStoreKey}.json`);
      writeFileSync(filePath, JSON.stringify(enabled, null, 2), 'utf-8');
      broadcastSettingChange(event.sender.id, 'music:lyrics-karaoke', enabled);
      return true;
    } catch (err) {
      console.error('[LyricsKaraoke] persist error:', err);
      return false;
    }
  });

  ipcMain.handle('music:lyrics-clock:get', () => {
    try {
      const filePath = join(options.storeDir, `${options.lyricsClockStoreKey}.json`);
      if (!existsSync(filePath)) return options.defaultLyricsClock;
      const raw = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      return typeof data === 'boolean' ? data : options.defaultLyricsClock;
    } catch {
      return options.defaultLyricsClock;
    }
  });

  ipcMain.handle('music:lyrics-clock:set', (_event, enabled: boolean) => {
    try {
      const filePath = join(options.storeDir, `${options.lyricsClockStoreKey}.json`);
      writeFileSync(filePath, JSON.stringify(enabled, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[LyricsClock] persist error:', err);
      return false;
    }
  });

  ipcMain.handle('music:lyrics-calibrate-enabled:get', () => {
    try {
      const filePath = join(options.storeDir, `${options.lyricsCalibrateEnabledStoreKey}.json`);
      if (!existsSync(filePath)) return options.defaultLyricsCalibrateEnabled;
      const raw = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      return typeof data === 'boolean' ? data : options.defaultLyricsCalibrateEnabled;
    } catch {
      return options.defaultLyricsCalibrateEnabled;
    }
  });

  ipcMain.handle('music:lyrics-calibrate-enabled:set', (_event, enabled: boolean) => {
    try {
      const filePath = join(options.storeDir, `${options.lyricsCalibrateEnabledStoreKey}.json`);
      writeFileSync(filePath, JSON.stringify(enabled, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[LyricsCalibrateEnabled] persist error:', err);
      return false;
    }
  });

  ipcMain.handle('music:lyrics-enabled:get', () => {
    try {
      const filePath = join(options.storeDir, `${options.lyricsEnabledStoreKey}.json`);
      if (!existsSync(filePath)) return true;
      const raw = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      return typeof data === 'boolean' ? data : true;
    } catch {
      return true;
    }
  });

  ipcMain.handle('music:lyrics-enabled:set', (_event, enabled: boolean) => {
    try {
      const filePath = join(options.storeDir, `${options.lyricsEnabledStoreKey}.json`);
      writeFileSync(filePath, JSON.stringify(enabled, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[LyricsEnabled] persist error:', err);
      return false;
    }
  });

  ipcMain.handle('music:lyrics-translation-enabled:get', () => {
    try {
      const filePath = join(options.storeDir, `${options.lyricsTranslationEnabledStoreKey}.json`);
      if (!existsSync(filePath)) return true;
      const raw = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      return typeof data === 'boolean' ? data : true;
    } catch {
      return true;
    }
  });

  ipcMain.handle('music:lyrics-translation-enabled:set', (_event, enabled: boolean) => {
    try {
      const filePath = join(options.storeDir, `${options.lyricsTranslationEnabledStoreKey}.json`);
      writeFileSync(filePath, JSON.stringify(enabled, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[LyricsTranslationEnabled] persist error:', err);
      return false;
    }
  });

  ipcMain.handle('music:lyrics-calibrate-delay:get', () => {
    try {
      const filePath = join(options.storeDir, `${options.lyricsCalibrateDelayStoreKey}.json`);
      if (!existsSync(filePath)) return options.defaultLyricsCalibrateDelay;
      const raw = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      return typeof data === 'number' && data >= 0 ? data : options.defaultLyricsCalibrateDelay;
    } catch {
      return options.defaultLyricsCalibrateDelay;
    }
  });

  ipcMain.handle('music:lyrics-calibrate-delay:set', (_event, delaySec: number) => {
    try {
      const sanitized = typeof delaySec === 'number' && delaySec >= 0 ? Math.floor(delaySec) : options.defaultLyricsCalibrateDelay;
      const filePath = join(options.storeDir, `${options.lyricsCalibrateDelayStoreKey}.json`);
      writeFileSync(filePath, JSON.stringify(sanitized, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[LyricsCalibrateDelay] persist error:', err);
      return false;
    }
  });

  ipcMain.handle('music:smtc-unsubscribe-ms:get', () => {
    return options.getSmtcUnsubscribeMs();
  });

  ipcMain.handle('music:smtc-unsubscribe-ms:set', (_event, valueMs: number) => {
    try {
      const next = options.sanitizeSmtcUnsubscribeMs(valueMs);
      options.setSmtcUnsubscribeMs(next);
      const filePath = join(options.storeDir, `${options.smtcUnsubscribeStoreKey}.json`);
      writeFileSync(filePath, JSON.stringify(next, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[SMTCUnsubscribe] persist error:', err);
      return false;
    }
  });

  ipcMain.handle('music:detect-source-app-id', async () => {
    try {
      const sources = await options.detectAllSources();
      if (!sources.length) {
        return { ok: false, sources: [], message: '当前无播放程序' };
      }
      return { ok: true, sources, message: '' };
    } catch (error) {
      console.error('[Music] detect sources failed:', error);
      return { ok: false, sources: [], message: '读取会话异常' };
    }
  });

  // ===== 喜欢（收藏） =====

  ipcMain.handle('music:like:check', (_event, title: string, artist: string) => {
    const key = buildTrackKey(title, artist);
    if (!key) return false;
    return readLikedSongs(options.storeDir).includes(key);
  });

  ipcMain.handle('music:like:list', () => readLikedSongs(options.storeDir));

  ipcMain.handle('music:like:toggle', async (_event, title: string, artist: string) => {
    const key = buildTrackKey(title, artist);
    if (!key) return { liked: false, synced: false };

    const liked = readLikedSongs(options.storeDir);
    const wasLiked = liked.includes(key);
    const nextLiked = !wasLiked;
    const nextList = nextLiked ? [...liked, key] : liked.filter((item) => item !== key);
    writeLikedSongs(options.storeDir, nextList);

    const deviceId = options.getCurrentDeviceId();

    // 移除该曲目的冷却缓存，保证下一次 sync 读取到的是 toggle 之后的真实状态
    likeSyncCache.delete(key);

    const synced = dispatchLikeHotkey(
      readMusicLikeHotkey(options.storeDir),
      deviceId,
    );

    // 不再读本地文件做“自我修正”——它无法反映网易云真实状态。
    // 以本次本地预期作为最终状态回传，前端据此更新 UI。
    return { liked: nextLiked, synced };
  });

  ipcMain.handle('music:like:sync', async (_event, title: string, artist: string, album?: string) => {
    const key = buildTrackKey(title, artist);
    if (!key) return { liked: false, source: 'none' };

    const deviceId = options.getCurrentDeviceId();
    const isNetease = isNeteaseSource(deviceId);

    if (!isNetease) {
      const liked = readLikedSongs(options.storeDir);
      return { liked: liked.includes(key), source: 'local' };
    }

    // 冷却保护：同一首歌在冷却窗口内优先返回缓存结果，避免高频打网易云搜索接口被限流
    const cached = likeSyncCache.get(key);
    if (cached && Date.now() - cached.at < LIKE_SYNC_COOLDOWN_MS) {
      return { liked: cached.liked, source: cached.source };
    }

    let realLiked: boolean | null = null;
    let source: string = 'none';

    if (title && artist) {
      try {
        const track = await searchNeteaseTrack(title, artist, album);
        const titleOk = (track?.name ?? '').trim().toLowerCase() === title.trim().toLowerCase();
        const artistOk = (track?.artist ?? '').trim().toLowerCase() === artist.trim().toLowerCase();
        // 提供专辑时才校验专辑，避免网易云端与 SMTC 专辑命名差异造成误判
        const queryAlbum = (album ?? '').trim().toLowerCase();
        const albumOk = !queryAlbum || ((track?.album ?? '').trim().toLowerCase().includes(queryAlbum) || queryAlbum.includes((track?.album ?? '').trim().toLowerCase()));
        if (track && titleOk && artistOk && albumOk) {
          const liked = await checkNeteaseLikeState(track.id);
          if (liked !== null) {
            realLiked = liked;
            source = 'netease-api';
          } else {
            console.info('[LikeSync] api/like:null', JSON.stringify({ title, artist, trackId: track.id }));
          }
        } else {
          console.info('[LikeSync] api/search:nomatch', JSON.stringify({ title, artist, track }));
        }
      } catch (err) {
        console.info('[LikeSync] api/error', err);
      }
    }

    if (realLiked === null) {
      console.info('[LikeSync] api/unavailable', JSON.stringify({ title, artist, key }));
      const localLiked = readLikedSongs(options.storeDir);
      realLiked = localLiked.includes(key);
      source = 'local-fallback';
    }

    // 无论结果来自 API 还是本地兜底，都写入冷却缓存。
    // 之前仅在「API 成功」时缓存，接口被限流（405「操作频繁」）或搜索失败时
    // 每次 sync 都会重打网易云搜索接口，导致冷却保护的初衷失效。
    likeSyncCache.set(key, { at: Date.now(), liked: Boolean(realLiked), source });

    const liked = readLikedSongs(options.storeDir);
    const nextList = realLiked ? [...new Set([...liked, key])] : liked.filter((item) => item !== key);
    writeLikedSongs(options.storeDir, nextList);

    console.info('[LikeSync]', JSON.stringify({ title, artist, key, liked: Boolean(realLiked), source, deviceId }));

    return { liked: Boolean(realLiked), source };
  });

  ipcMain.handle('music:like:hotkey:get', () => readMusicLikeHotkey(options.storeDir));

  ipcMain.handle('music:like:hotkey:set', (event, hotkey: string) => {
    const value = String(hotkey ?? '');
    if (parseHotkeyCombo(value).length === 0) return false;
    const ok = writeMusicLikeHotkey(options.storeDir, value);
    if (ok) broadcastSettingChange(event.sender.id, 'store:music-like-hotkey', value);
    return ok;
  });

  ipcMain.handle('music:like:count', () => readLikedSongs(options.storeDir).length);
}
