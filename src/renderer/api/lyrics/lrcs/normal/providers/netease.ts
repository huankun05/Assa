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
 * @file netease.ts
 * @description 网易云音乐歌词拉取 — 搜索歌曲（评分匹配）→ v1 歌词接口，优先 YRC 逐字歌词，回退 LRC 逐行歌词
 * @author 鸡哥
 */

import type { LyricsFetchResult, LyricLine } from '../types';
import { cleanArtist, cleanTitle, parseSyncedLrc, parseYrc } from '../helpers';
import { parseTranslationLyrics } from '../translation';
import { requestJsonWithLog } from '../request';
import { searchWithScoring } from '../matcher';
import type { SearchCandidate } from '../searchTypes';

const NETEASE_HEADERS = {
  Referer: 'https://music.163.com',
  'User-Agent': 'Mozilla/5.0',
  'Content-Type': 'application/x-www-form-urlencoded',
};

/** 网易云 web 搜索接口返回的歌曲条目 */
interface NeteaseSearchSong {
  id: number | string;
  name?: string;
  artists?: Array<{ name?: string }>;
  album?: { name?: string };
  duration?: number;
}

/**
 * 网易云对无歌词/纯音乐歌曲返回的占位文案（如「[00:05.00]纯音乐，请欣赏」）。
 * 命中占位时视为无歌词，返回 null 让上层回退到其他歌词源。
 */
const PLACEHOLDER_TEXT_RE = /^(?:纯音乐\s*[，,]?\s*请欣赏|纯音乐|请欣赏|instrumental(?:\s*only)?|伴奏(?:版)?)$/i;

/** 判断解析后的歌词是否全部为纯音乐占位行 */
function isPlaceholderLyrics(lines: LyricLine[]): boolean {
  return lines.length > 0 && lines.every((line) => PLACEHOLDER_TEXT_RE.test(line.text.trim()));
}

/** 将网易云搜索结果转换为通用搜索候选 */
function toSearchCandidates(songs: NeteaseSearchSong[]): SearchCandidate[] {
  return songs
    .filter((song) => song && song.id !== undefined)
    .map((song) => ({
      id: String(song.id),
      title: song.name ?? '',
      artists: (song.artists ?? []).map((a) => a.name ?? '').filter(Boolean),
      album: song.album?.name ?? '',
      durationMs: typeof song.duration === 'number' && song.duration > 0 ? song.duration : undefined,
    }));
}

/** 通过歌曲 ID 拉取歌词（YRC 优先，LRC 回退），纯音乐占位歌词视为无歌词 */
async function fetchLyricBySongId(songId: string): Promise<LyricsFetchResult | null> {
  const lrcJson = await requestJsonWithLog<Record<string, unknown>>(
    'https://interface3.music.163.com/api/song/lyric/v1',
    {
      method: 'POST',
      headers: NETEASE_HEADERS,
      body: `id=${songId}&lv=-1&kv=-1&tv=-1&rv=-1&yv=-1&ytv=-1&yrv=-1`,
    },
  );
  if (!lrcJson) return null;

  const translationObj = lrcJson.tlyric as Record<string, unknown> | undefined;
  const translation = parseTranslationLyrics(
    typeof translationObj?.lyric === 'string' ? translationObj.lyric : null,
  );

  const yrcObj = lrcJson.yrc as Record<string, unknown> | undefined;
  const yrcText = typeof yrcObj?.lyric === 'string' ? yrcObj.lyric : null;
  if (yrcText && yrcText.length > 0) {
    const yrcLines = parseYrc(yrcText);
    if (yrcLines.length > 0 && !isPlaceholderLyrics(yrcLines)) return { lyrics: yrcLines, translation };
  }

  const lrcObj = lrcJson.lrc as Record<string, unknown> | undefined;
  const lrcText = typeof lrcObj?.lyric === 'string' ? lrcObj.lyric : null;
  if (lrcText && lrcText.length > 0) {
    const lines = parseSyncedLrc(lrcText);
    if (lines.length > 0 && !isPlaceholderLyrics(lines)) return { lyrics: lines, translation };
  }

  return null;
}

/** 精确匹配模式：直接用 title+artist 搜索，取第一条结果，跳过复杂评分 */
async function fetchLyricByExactMatch(title: string, artist: string): Promise<LyricsFetchResult | null> {
  const query = `${title} ${artist}`.trim();
  if (!query) return null;

  const searchJson = await requestJsonWithLog<Record<string, unknown>>(
    'https://music.163.com/api/search/get/web',
    {
      method: 'POST',
      headers: NETEASE_HEADERS,
      body: `s=${encodeURIComponent(query)}&type=1&limit=1&offset=0`,
    },
  );
  if (!searchJson) return null;

  const result = searchJson.result as Record<string, unknown> | undefined;
  const songs = result?.songs as NeteaseSearchSong[] | undefined;
  const first = songs?.[0];
  if (!first || first.id === undefined) return null;

  return await fetchLyricBySongId(String(first.id));
}

/**
 * 搜索网易云歌曲并评分匹配后拉取歌词
 * @description 不直接取搜索结果第一条：窗口标题解析出的歌名/歌手可能匹配到
 *              翻唱/伴奏/Live 版本，需用 matcher 评分选出与播放曲目最相符的结果
 */
async function searchNetease(
  title: string,
  artist: string,
  durationMs?: number,
): Promise<LyricsFetchResult | null> {
  try {
    const matched = await searchWithScoring(
      {
        title,
        artist,
        durationMs: durationMs && durationMs > 0 ? durationMs : undefined,
      },
      async (query: string) => {
        const searchJson = await requestJsonWithLog<Record<string, unknown>>(
          'https://music.163.com/api/search/get/web',
          {
            method: 'POST',
            headers: NETEASE_HEADERS,
            body: `s=${encodeURIComponent(query)}&type=1&limit=20&offset=0`,
          },
        );
        if (!searchJson) return [];
        const result = searchJson.result as Record<string, unknown> | undefined;
        const songs = result?.songs as NeteaseSearchSong[] | undefined;
        if (!songs || songs.length === 0) return [];
        return toSearchCandidates(songs);
      },
    );
    if (!matched) return null;
    return await fetchLyricBySongId(matched.id);
  } catch {
    return null;
  }
}

export async function fetchLyricsWithTranslationFromNetease(
  title: string,
  artist: string,
): Promise<LyricsFetchResult | null> {
  // 优先走精确匹配：更快，且当 SMTC 标题准确时命中率更高
  const direct = await fetchLyricByExactMatch(title, artist);
  if (direct) return direct;

  // 精确匹配失败时回退到评分匹配：处理标题清洗/歧义场景
  const raw = await searchNetease(title, artist);
  if (raw) return raw;

  const cleanedTitle = cleanTitle(title);
  const cleanedArtist = cleanArtist(artist);
  if (cleanedTitle !== title || cleanedArtist !== artist) {
    const cleanedDirect = await fetchLyricByExactMatch(cleanedTitle, cleanedArtist);
    if (cleanedDirect) return cleanedDirect;
    return searchNetease(cleanedTitle, cleanedArtist);
  }
  return null;
}

export async function fetchLyricsFromNeteaseDirect(
  title: string,
  artist: string,
): Promise<LyricsFetchResult | null> {
  const raw = await fetchLyricByExactMatch(title, artist);
  if (raw) return raw;

  const cleanedTitle = cleanTitle(title);
  const cleanedArtist = cleanArtist(artist);
  if (cleanedTitle !== title || cleanedArtist !== artist) {
    return fetchLyricByExactMatch(cleanedTitle, cleanedArtist);
  }
  return null;
}

export async function fetchLyricsFromNetease(title: string, artist: string): Promise<LyricLine[] | null> {
  const result = await fetchLyricsWithTranslationFromNetease(title, artist);
  return result?.lyrics ?? null;
}
