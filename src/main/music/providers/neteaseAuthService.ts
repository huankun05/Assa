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
 * @file neteaseAuthService.ts
 * @description 网易云音乐登录态管理
 * @description 通过内置浏览器完成登录后，提取 MUSIC_U Cookie 持久化到本地。
 * @author 鸡哥
 */

import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { BrowserWindow } from 'electron';

/** 登录态存储文件路径 */
function sessionFile(): string {
  return join(app.getPath('userData'), 'music-providers', 'netease.json');
}

/** 读取已保存的登录态 */
export function readNeteaseSession(): { cookie?: string; musicU?: string } {
  try {
    const file = sessionFile();
    if (!existsSync(file)) return {};
    const raw = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return {};
    const cookie = typeof data.cookie === 'string' ? data.cookie.trim() : '';
    const musicU = typeof data.musicU === 'string' ? data.musicU.trim() : '';
    return { cookie, musicU };
  } catch {
    return {};
  }
}

/** 写入登录态 */
export function writeNeteaseSession(session: { cookie?: string; musicU?: string }): void {
  try {
    const dir = join(app.getPath('userData'), 'music-providers');
    const file = sessionFile();
    const merged = { ...readNeteaseSession(), ...session };
    writeFileSync(file, JSON.stringify(merged, null, 2), 'utf-8');
  } catch (err) {
    console.error('[NeteaseAuth] persist error:', err);
  }
}

/** 清除登录态 */
export function clearNeteaseSession(): void {
  try {
    const file = sessionFile();
    if (existsSync(file)) writeFileSync(file, JSON.stringify({}, null, 2), 'utf-8');
  } catch (err) {
    console.error('[NeteaseAuth] clear error:', err);
  }
}

/** 从完整 Cookie 字符串中提取 MUSIC_U */
export function extractMusicU(cookie: string): string | undefined {
  const match = cookie.match(/(?:^|;\s*)MUSIC_U=([^;]+)/);
  return match?.[1]?.trim();
}

/** 判断登录态是否有效 */
export function isNeteaseLoggedIn(): boolean {
  const { musicU, cookie } = readNeteaseSession();
  return Boolean(musicU || (cookie && /MUSIC_U=/.test(cookie)));
}

/** 打开内置浏览器完成网易云登录 */
export async function openNeteaseLoginWindow(): Promise<{ success: boolean; message: string }> {
  return new Promise((resolve) => {
    const loginUrl = 'https://music.163.com';
    const win = new BrowserWindow({
      width: 1000,
      height: 700,
      show: true,
      alwaysOnTop: true,
      frame: true,
      title: '网易云音乐登录',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    let timeout: ReturnType<typeof setTimeout> | null = null;
    let navigationFinished = false;

    const finish = (result: { success: boolean; message: string }) => {
      if (timeout) clearTimeout(timeout);
      if (!navigationFinished) {
        navigationFinished = true;
        win.close();
        resolve(result);
      }
    };

    timeout = setTimeout(() => finish({ success: false, message: '登录超时，请重试' }), 5 * 60 * 1000);

    /** 轮询检查 Cookie 是否出现（降低频率避免卡顿） */
    const pollForLogin = async (): Promise<void> => {
      for (let i = 0; i < 30; i++) {
        try {
          const cookies = await win.webContents.session.cookies.get({ domain: '.music.163.com' });
          const cookieStr = cookies.map((c) => `${c.name}=${c.value}`).join('; ');
          const musicU = extractMusicU(cookieStr);
          if (musicU) {
            writeNeteaseSession({ cookie: cookieStr, musicU });
            finish({ success: true, message: '登录成功' });
            return;
          }
        } catch {
          // 忽略解析错误，继续轮询
        }
        await new Promise((r) => setTimeout(r, 2000));
      }
    };

    win.loadURL(loginUrl);

    win.webContents.on('did-finish-load', () => {
      pollForLogin();
    });

    win.on('closed', () => {
      if (!navigationFinished) {
        navigationFinished = true;
        resolve({ success: false, message: '登录窗口已关闭' });
      }
    });
  });
}
