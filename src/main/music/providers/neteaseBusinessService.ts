/*
 * eIsland - A sleek, Apple Dynamic Island inspired floating widget for Windows, built with Electron.
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @file neteaseBusinessService.ts
 * @description 网易云音乐业务接口
 * @description 使用本地登录态查询歌曲是否在「我喜欢的音乐」中。
 * @author 鸡哥
 */

import { existsSync, readFileSync, writeFileSync, deleteFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

const NETEASE_API_BASE = 'https://music.163.com';
const NETEASE_HEADERS = {
  Referer: 'https://music.163.com',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

function sessionFile(): string {
  return join(app.getPath('userData'), 'music-providers', 'netease.json');
}

function readSessionCookie(): string {
  try {
    if (!existsSync(sessionFile())) {
      console.info('[NeteaseAPI] cookie:missing', sessionFile());
      return '';
    }
    const raw = readFileSync(sessionFile(), 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') {
      console.info('[NeteaseAPI] cookie:invalid-json');
      return '';
    }
    const cookie = typeof data.cookie === 'string' ? data.cookie.trim() : '';
    console.info('[NeteaseAPI] cookie:loaded', JSON.stringify({ len: cookie.length, hasMusicU: cookie.includes('MUSIC_U') }));
    return cookie;
  } catch (err) {
    console.info('[NeteaseAPI] cookie:error', err);
    return '';
  }
}

async function requestNetease<T>(path: string, body: string): Promise<T | null> {
  return _requestNetease<T>(path, body, 'POST');
}

async function requestNeteaseGet<T>(path: string): Promise<T | null> {
  return _requestNetease<T>(path, '', 'GET');
}

async function _requestNetease<T>(path: string, body: string, method: 'POST' | 'GET'): Promise<T | null> {
  const cookie = readSessionCookie();
  if (!cookie) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(NETEASE_API_BASE + path, {
      method,
      headers: {
        ...NETEASE_HEADERS,
        Cookie: cookie,
        ...(method === 'POST' ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      },
      body: method === 'POST' ? body : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    const status = response.status;
    let text = '';
    try {
      text = await response.text();
    } catch {
      text = '';
    }
    console.info('[NeteaseAPI]', JSON.stringify({ path, method, status, cookieLen: cookie.length, bodyLen: body.length, textHead: text.slice(0, 200) }));
    if (!response.ok) return null;
    try {
      return JSON.parse(text) as T;
    } catch {
      return null;
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.info('[NeteaseAPI] error', err);
    return null;
  }
}

/**
 * 获取当前登录用户 uid
 * @description 通过网易云 /api/w/nuser/account/get 获取真实登录态 uid。
 *              此接口实测返回 200 且含 account.id（/api/user/account 已废弃返回 404）；
 *              兼容传统 cookie 解析作为兜底（MUSIC_U 为纯数字时的场景）。
 */
async function fetchUidFromAccount(): Promise<number | null> {
  try {
    const accountJson = await requestNeteaseGet<{ account?: { id?: number } }>('/api/w/nuser/account/get');
    const id = accountJson?.account?.id;
    if (typeof id === 'number' && id > 0) return id;
  } catch {
    // 请求失败时忽略，走兜底
  }
  return null;
}

export interface NeteaseTrack {
  id: number;
  name: string;
  artist: string;
  /** 专辑名（用于加权判定“同一首”，可能为空） */
  album: string;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const searchCache = new Map<string, CacheEntry<NeteaseTrack | null>>();
const likeCache = new Map<number, CacheEntry<boolean | null>>();
const SEARCH_TTL_MS = 5 * 60 * 1000;
const LIKE_TTL_MS = 2 * 60 * 1000;

function getCached<T>(map: Map<string | number, CacheEntry<T>>, key: string | number): T | undefined {
  const entry = map.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    map.delete(key);
    return undefined;
  }
  return entry.value;
}

function setCache<T>(map: Map<string | number, CacheEntry<T>>, key: string | number, value: T, ttlMs: number): void {
  map.set(key, { value, expiresAt: Date.now() + ttlMs });
}

interface NeteasePlaylist {
  id: number;
  name: string;
  trackCount: number;
}

interface NeteasePlaylistDetail {
  code: number;
  playlist?: {
    trackIds: Array<{ id: number }>;
  };
}

interface NeteaseAccount {
  account?: { id: number };
}

let cachedLikedPlaylistId: number | null = null;

/** 「我喜欢的音乐」全集 trackIds 快照结构（持久化到磁盘） */
interface LikedPlaylistCacheFile {
  version: number;
  trackIds: number[];
  fetchedAt: number;
}

/** 全集缓存 TTL：切歌/启动秒用，到点才后台刷新重拉 v6 大包 */
const LIKED_TRACK_IDS_TTL_MS = 30 * 60 * 1000;
let cachedLikedTrackIds: number[] | null = null;
let cachedLikedTrackIdsExpiresAt = 0;

function likedCacheFile(): string {
  return join(app.getPath('userData'), 'music-providers', 'netease-liked.json');
}

function readLikedCacheFromDisk(): LikedPlaylistCacheFile | null {
  try {
    if (!existsSync(likedCacheFile())) return null;
    const raw = readFileSync(likedCacheFile(), 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw) as Partial<LikedPlaylistCacheFile>;
    if (data && Array.isArray(data.trackIds) && typeof data.fetchedAt === 'number') {
      return data as LikedPlaylistCacheFile;
    }
  } catch (err) {
    console.info('[NeteaseAPI] liked/cache:read-error', err);
  }
  return null;
}

function writeLikedCacheToDisk(trackIds: number[]): void {
  try {
    writeFileSync(likedCacheFile(), JSON.stringify({ version: 1, trackIds, fetchedAt: Date.now() }), 'utf8');
  } catch (err) {
    console.info('[NeteaseAPI] liked/cache:write-error', err);
  }
}

async function getLikedPlaylistId(): Promise<number | null> {
  if (cachedLikedPlaylistId !== null) return cachedLikedPlaylistId;
  const cookie = readSessionCookie();
  if (!cookie) return null;

  // 1) 首选通过账号接口获取真实 uid（/api/w/nuser/account/get 实测有效）
  const uid = await fetchUidFromAccount();

  if (!uid) {
    console.info('[NeteaseAPI] liked/playlist:no-uid');
    return null;
  }

  try {
    const playlistsJson = await requestNetease<{ playlist: NeteasePlaylist[] }>('/api/user/playlist', `uid=${uid}&limit=1000`);
    // 网易云将「我喜欢的音乐」命名为「{昵称}喜欢的音乐」，按模糊匹配提升兼容性
    const liked = playlistsJson?.playlist?.find((p) => (p.name ?? '').includes('喜欢的音乐'));
    if (liked) {
      cachedLikedPlaylistId = liked.id;
      console.info('[NeteaseAPI] liked/playlist:found', JSON.stringify({ id: liked.id, name: liked.name, trackCount: liked.trackCount }));
      return liked.id;
    }
  } catch (err) {
    console.info('[NeteaseAPI] liked/playlist:error', err);
  }
  return null;
}

/**
 * 获取「我喜欢的音乐」完整 trackIds 全集
 * @description 用 /api/v6/playlist/detail 且 n=100000 返回完整 playlist.trackIds，
 *              而非「前 1000 首」；喜欢数 >1000 的歌单也全量命中。
 *              内存 + 磁盘双缓存：启动/切歌秒用，TTL 到点后台刷新，网络失败回退旧值，
 *              避免逐歌或每次启动都重拉 v6 大包。
 */
async function getLikedTrackIds(): Promise<number[] | null> {
  // 1) 内存命中
  if (cachedLikedTrackIds && Date.now() < cachedLikedTrackIdsExpiresAt) return cachedLikedTrackIds;

  // 2) 读盘载入（含启动秒用与网络失败时的离线兜底）
  if (!cachedLikedTrackIds) {
    const disk = readLikedCacheFromDisk();
    if (disk) {
      cachedLikedTrackIds = disk.trackIds;
      cachedLikedTrackIdsExpiresAt = disk.fetchedAt + LIKED_TRACK_IDS_TTL_MS;
      console.info('[NeteaseAPI] liked/trackids:from-disk', JSON.stringify({ total: disk.trackIds.length, fetchedAt: disk.fetchedAt }));
    }
  }

  if (cachedLikedTrackIds && Date.now() < cachedLikedTrackIdsExpiresAt) return cachedLikedTrackIds;

  // 3) 过期或无缓存 → 网络刷新
  const playlistId = await getLikedPlaylistId();
  if (playlistId) {
    try {
      const detailJson = await requestNetease<NeteasePlaylistDetail>('/api/v6/playlist/detail', `id=${playlistId}&n=100000&s=8`);
      const fresh = (detailJson?.playlist?.trackIds ?? []).map((t) => t.id);
      if (fresh.length > 0) {
        cachedLikedTrackIds = fresh;
        cachedLikedTrackIdsExpiresAt = Date.now() + LIKED_TRACK_IDS_TTL_MS;
        writeLikedCacheToDisk(fresh);
        return fresh;
      }
    } catch (err) {
      console.info('[NeteaseAPI] liked/trackids:error', err);
    }
  }

  // 4) 刷新失败 → 回退磁盘/内存旧值（即便过期），避免喜欢状态整体失效
  if (cachedLikedTrackIds) return cachedLikedTrackIds;
  return null;
}

async function checkLikedPlaylistContains(songId: number): Promise<boolean | null> {
  const trackIds = await getLikedTrackIds();
  if (!trackIds) return null;
  console.info('[NeteaseAPI] liked/check:playlist', JSON.stringify({ songId, matched: trackIds.includes(songId), total: trackIds.length }));
  return trackIds.includes(songId);
}

/**
 * 归一化字符串：去空白、转小写，用于匹配比较
 */
function norm(s: string): string {
  return (s ?? '').trim().toLowerCase();
}

/** 专辑名软匹配：相等或互相包含即视为命中（兼顾网易云端与 SMTC 的命名差异） */
function albumMatched(candidateAlbum: string, expectAlbum: string): boolean {
  const a = norm(candidateAlbum);
  const b = norm(expectAlbum);
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** 网易云搜索接口单曲条目 */
interface NeteaseSearchSong {
  id: number;
  name: string;
  artists?: Array<{ name?: string }>;
  album?: { name?: string };
}

/** 调用网易云单曲搜索接口，失败（网络/风控/空结果）返回 null */
async function searchSongs(query: string): Promise<NeteaseSearchSong[] | null> {
  const json = await requestNetease<{ result?: { songs?: NeteaseSearchSong[] } }>(
    '/api/search/get/web',
    `s=${encodeURIComponent(query)}&type=1&limit=20&offset=0`,
  );
  const songs = json?.result?.songs;
  return Array.isArray(songs) && songs.length > 0 ? songs : null;
}

/** 按「歌名+歌手+专辑」加权找出最匹配条目（不存在时返回 undefined） */
function pickBestMatch(
  songs: NeteaseSearchSong[],
  title: string,
  artist: string,
  album?: string,
): NeteaseSearchSong | undefined {
  const normalizedTitle = norm(title);
  const normalizedArtist = norm(artist);
  const normalizedAlbum = norm(album);

  const nameOk = (s: NeteaseSearchSong) => norm(s.name) === normalizedTitle;
  const artistOk = (s: NeteaseSearchSong) =>
    (s.artists ?? []).some((a) => norm(a.name) === normalizedArtist);

  /**
   * 加权匹配优先级：
   * 1) 歌名+歌手+专辑 全命中（提供专辑时）
   * 2) 歌名+歌手 命中
   * 3) 仅歌名命中
   */
  if (normalizedAlbum) {
    const hit = songs.find((s) => nameOk(s) && artistOk(s) && albumMatched(s.album?.name ?? '', normalizedAlbum));
    if (hit) return hit;
  }
  return (
    songs.find((s) => nameOk(s) && artistOk(s))
    || songs.find((s) => nameOk(s))
    || undefined
  );
}

/**
 * 搜索歌曲并返回最匹配的条目
 * @param title - 歌名
 * @param artist - 歌手
 * @param album - 专辑名（可选）。提供时用于“加权”判定，优先命中同名同歌手且专辑一致的版本
 * @returns 匹配的歌曲信息；未登录或搜索失败返回 null
 * @description 失败时不写入缓存（避免一次偶发失败污染后续结果）；
 *              主次两轮搜索：先「歌名+歌手+专辑」，失败再退化为「仅歌名」重试。
 */
export async function searchNeteaseTrack(title: string, artist: string, album?: string): Promise<NeteaseTrack | null> {
  const cacheKey = `${title.trim()}|||${artist.trim()}|||${(album ?? '').trim()}`;
  const cached = getCached(searchCache, cacheKey);
  if (cached !== undefined) return cached;

  // 第一轮：歌名 + 歌手 + 专辑（如提供），提升对专辑/现场版的排序偏向
  const primaryQuery = [title, artist, album].filter((s) => s && s.trim()).join(' ').trim();
  let songs = await searchSongs(primaryQuery);
  let best = songs ? pickBestMatch(songs, title, artist, album) : undefined;

  // 第二轮（降级）：仅歌名再试，规避偶发失败 / 组合词命中不佳
  if (!best) {
    songs = await searchSongs(title.trim());
    best = songs ? pickBestMatch(songs, title, artist, album) : undefined;
  }

  if (!best) {
    console.info('[NeteaseAPI] search:no-match', JSON.stringify({ title, artist, album }));
    return null;
  }

  const artistName = (best.artists ?? []).map((a) => a.name).filter(Boolean).join(' / ') || artist;
  const result: NeteaseTrack = {
    id: best.id,
    name: best.name || title,
    artist: artistName,
    album: (best.album?.name ?? '').trim(),
  };
  setCache(searchCache, cacheKey, result, SEARCH_TTL_MS);
  return result;
}

/**
 * 查询指定歌曲是否已喜欢
 * @description /api/song/check/like 已废弃（返回 404），故直接读取「我喜欢的音乐」
 *              歌单并判断歌曲 ID 是否在其中，以获取真实喜欢状态。
 * @param songId - 网易云歌曲 ID
 * @returns 是否已喜欢；未登录或查询失败返回 null
 */
export async function checkNeteaseLikeState(songId: string | number): Promise<boolean | null> {
  const id = Number(songId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const cached = getCached(likeCache, id);
  if (cached !== undefined) return cached;

  const cookie = readSessionCookie();
  if (!cookie) return null;

  const result = await checkLikedPlaylistContains(id);
  setCache(likeCache, id, result, LIKE_TTL_MS);
  return result;
}

export function clearNeteaseApiCache(): void {
  searchCache.clear();
  likeCache.clear();
  cachedLikedPlaylistId = null;
  cachedLikedTrackIds = null;
  cachedLikedTrackIdsExpiresAt = 0;
  try {
    deleteFileSync(likedCacheFile());
  } catch {
    // 盘缓存不存在时忽略
  }
}

/** 判断当前是否有可用登录态 */
export function hasNeteaseSession(): boolean {
  return Boolean(readSessionCookie());
}
