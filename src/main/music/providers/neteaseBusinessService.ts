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

import { existsSync, readFileSync } from 'fs';
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
    if (!existsSync(sessionFile())) return '';
    const raw = readFileSync(sessionFile(), 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return '';
    return typeof data.cookie === 'string' ? data.cookie.trim() : '';
  } catch {
    return '';
  }
}

async function requestNetease<T>(path: string, body: string): Promise<T | null> {
  const cookie = readSessionCookie();
  if (!cookie) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(NETEASE_API_BASE + path, {
      method: 'POST',
      headers: {
        ...NETEASE_HEADERS,
        Cookie: cookie,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/** 歌曲是否已喜欢接口参数 */
interface NeteaseLikeResponse {
  code: number;
  data?: { liked?: boolean };
}

/**
 * 查询指定歌曲是否已喜欢
 * @param songId - 网易云歌曲 ID
 * @returns 是否已喜欢；未登录或查询失败返回 null
 */
export async function checkNeteaseLikeState(songId: string | number): Promise<boolean | null> {
  const id = Number(songId);
  if (!Number.isFinite(id) || id <= 0) return null;

  const json = await requestNetease<NeteaseLikeResponse>('/api/song/check/like', `id=${id}`);
  if (!json || json.code !== 200 || typeof json.data?.liked !== 'boolean') return null;
  return json.data.liked;
}

/**
 * 搜索歌曲并返回最匹配的条目
 * @param title - 歌名
 * @param artist - 歌手
 * @returns 匹配的歌曲信息；未登录或搜索失败返回 null
 */
export interface NeteaseTrack {
  id: number;
  name: string;
  artist: string;
}

export async function searchNeteaseTrack(title: string, artist: string): Promise<NeteaseTrack | null> {
  const query = `${title} ${artist}`.trim();
  const body = `s=${encodeURIComponent(query)}&type=1&limit=5&offset=0`;

  const json = await requestNetease<{ result?: { songs?: Array<{ id: number; name: string; artists?: Array<{ name?: string }> }> } }>(
    '/api/search/get/web',
    body,
  );

  const songs = json?.result?.songs;
  if (!Array.isArray(songs) || songs.length === 0) return null;

  const best = songs[0];
  const artistName = (best.artists ?? []).map((a) => a.name).filter(Boolean).join(' / ') || artist;
  return {
    id: best.id,
    name: best.name || title,
    artist: artistName,
  };
}

/** 判断当前是否有可用登录态 */
export function hasNeteaseSession(): boolean {
  return Boolean(readSessionCookie());
}
