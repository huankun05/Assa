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
 * @file mediaLike.ts
 * @description 「喜欢」能力模块
 * @description Windows SMTC 协议本身不提供点赞/收藏指令（原生模块只有
 *              play/pause/next/previous/seek/shuffle/repeat），因此本模块采用两段式方案：
 *              1) 本地收藏：按「歌名+歌手」持久化到 userData，跨会话保留并驱动 UI 高亮；
 *              2) 播放器同步：对网易云音乐 PC 客户端发送其默认全局快捷键 Ctrl+Alt+L
 *                 （设置 → 快捷键 → 喜欢单曲），由客户端自己写入「我喜欢的音乐」。
 *              快捷键可配置，用户若在网易云里改过，改成一致即可。
 * @author 鸡哥
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { sendHotkeyCombo } from '../system/mediaKey';

/** 本地收藏列表存储键名 */
export const LIKED_SONGS_STORE_KEY = 'liked-songs';

/** 「喜欢」快捷键存储键名 */
export const MUSIC_LIKE_HOTKEY_STORE_KEY = 'music-like-hotkey';

/** 「喜欢」快捷键默认值：网易云音乐 PC 端默认的「喜欢单曲」全局快捷键 */
export const DEFAULT_MUSIC_LIKE_HOTKEY = 'Ctrl+Alt+L';

/** 网易云音乐 SMTC 音源标识（sourceAppId 形如 cloudmusic.exe） */
const NETEASE_SOURCE_HINT = 'cloudmusic';

/** 修饰键 → 虚拟键码 */
const MODIFIER_VK: Record<string, number> = {
  ctrl: 0x11,
  control: 0x11,
  alt: 0x12,
  shift: 0x10,
  win: 0x5b,
};

/** 收藏列表最大条数，超出后丢弃最早的记录（数组尾部为最新） */
const MAX_LIKED_SONGS = 2000;

/**
 * 构造歌曲唯一键
 * @description 以「歌名 + 歌手」归一化（去空白、转小写）作为本地收藏的标识
 * @param title - 歌曲名
 * @param artist - 歌手名
 * @returns 归一化后的歌曲键；歌名为空时返回空串
 */
export function buildTrackKey(title: string, artist: string): string {
  const normalizedTitle = (title ?? '').trim().toLowerCase();
  if (!normalizedTitle) return '';
  const normalizedArtist = (artist ?? '').trim().toLowerCase();
  return `${normalizedTitle}||${normalizedArtist}`;
}

/**
 * 解析快捷键字符串为虚拟键码数组
 * @description 支持 Ctrl/Alt/Shift/Win 修饰键 + 单个字母、数字或 F1-F24，
 *              例如 "Ctrl+Alt+L"、"Ctrl+Shift+F2"
 * @param hotkey - 快捷键字符串
 * @returns 虚拟键码数组（修饰键在前）；解析失败或缺少主键时返回空数组
 */
export function parseHotkeyCombo(hotkey: string): number[] {
  const parts = String(hotkey ?? '')
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (parts.length < 2) return [];

  const vkCodes: number[] = [];
  let mainKey = 0;
  for (const part of parts) {
    const modifier = MODIFIER_VK[part];
    if (modifier !== undefined) {
      if (!vkCodes.includes(modifier)) vkCodes.push(modifier);
      continue;
    }
    if (mainKey !== 0) return [];
    const resolved = resolveMainKeyVk(part);
    if (resolved === 0) return [];
    mainKey = resolved;
  }

  if (mainKey === 0) return [];
  vkCodes.push(mainKey);
  return vkCodes;
}

/**
 * 解析主键为虚拟键码
 * @param token - 小写的主键片段
 * @returns 虚拟键码；无法识别时返回 0
 */
function resolveMainKeyVk(token: string): number {
  if (/^[a-z]$/.test(token)) return token.toUpperCase().charCodeAt(0);
  if (/^[0-9]$/.test(token)) return token.charCodeAt(0);
  const fnMatch = /^f(\d{1,2})$/.exec(token);
  if (fnMatch) {
    const index = Number(fnMatch[1]);
    if (index >= 1 && index <= 24) return 0x6f + index;
  }
  const arrowVk: Record<string, number> = {
    left: 0x25,
    up: 0x26,
    right: 0x27,
    down: 0x28,
  };
  return arrowVk[token] ?? 0;
}

/**
 * 读取本地收藏列表
 * @param storeDir - 存储目录
 * @returns 收藏歌曲键数组
 */
export function readLikedSongs(storeDir: string): string[] {
  try {
    const filePath = join(storeDir, `${LIKED_SONGS_STORE_KEY}.json`);
    if (!existsSync(filePath)) return [];
    const data: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
    if (!Array.isArray(data)) return [];
    return data.filter((item): item is string => typeof item === 'string' && item.length > 0);
  } catch {
    return [];
  }
}

/**
 * 写入本地收藏列表
 * @param storeDir - 存储目录
 * @param keys - 收藏歌曲键数组
 * @returns 是否写入成功
 */
export function writeLikedSongs(storeDir: string, keys: string[]): boolean {
  try {
    const filePath = join(storeDir, `${LIKED_SONGS_STORE_KEY}.json`);
    writeFileSync(filePath, JSON.stringify(keys.slice(-MAX_LIKED_SONGS), null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[MediaLike] persist error:', err);
    return false;
  }
}

/**
 * 读取「喜欢」快捷键配置
 * @param storeDir - 存储目录
 * @returns 快捷键字符串
 */
export function readMusicLikeHotkey(storeDir: string): string {
  try {
    const filePath = join(storeDir, `${MUSIC_LIKE_HOTKEY_STORE_KEY}.json`);
    if (!existsSync(filePath)) return DEFAULT_MUSIC_LIKE_HOTKEY;
    const data: unknown = JSON.parse(readFileSync(filePath, 'utf-8'));
    return typeof data === 'string' && parseHotkeyCombo(data).length > 0
      ? data
      : DEFAULT_MUSIC_LIKE_HOTKEY;
  } catch {
    return DEFAULT_MUSIC_LIKE_HOTKEY;
  }
}

/**
 * 写入「喜欢」快捷键配置
 * @param storeDir - 存储目录
 * @param hotkey - 快捷键字符串
 * @returns 是否写入成功
 */
export function writeMusicLikeHotkey(storeDir: string, hotkey: string): boolean {
  try {
    const filePath = join(storeDir, `${MUSIC_LIKE_HOTKEY_STORE_KEY}.json`);
    writeFileSync(filePath, JSON.stringify(hotkey, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('[MediaLike] hotkey persist error:', err);
    return false;
  }
}

/**
 * 判断当前 SMTC 音源是否为网易云音乐
 * @param deviceId - 当前音源标识
 * @returns 是否为网易云音乐
 */
export function isNeteaseSource(deviceId: string): boolean {
  return (deviceId ?? '').toLowerCase().includes(NETEASE_SOURCE_HINT);
}

/**
 * 向播放器发送「喜欢」全局快捷键
 * @description 仅对支持的播放器（当前为网易云音乐）发送，避免把快捷键误发给其他前台程序
 * @param hotkey - 快捷键字符串
 * @param deviceId - 当前音源标识
 * @returns 是否成功派发
 */
export function dispatchLikeHotkey(hotkey: string, deviceId: string): boolean {
  if (!isNeteaseSource(deviceId)) return false;
  const vkCodes = parseHotkeyCombo(hotkey);
  if (!vkCodes.length) return false;
  sendHotkeyCombo(vkCodes);
  return true;
}
