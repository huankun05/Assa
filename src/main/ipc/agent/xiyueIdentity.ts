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
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file xiyueIdentity.ts
 * @description 汐月身份查询 IPC：从侧车或本地配置读取程序化身份信息。
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';

export interface XiyueIdentity {
  name: string;
  visibleName: string;
  englishName: string;
  role: string;
  modelDefault: string;
  systemIdentifier: string;
  greeting: string;
  languageDefault: string;
  localFirst: boolean;
  cloudFallbackDefaultOff: boolean;
  dataNeverLeaveMachine: boolean;
  emotionEnabled: boolean;
  emotionDefaultState: string;
  memoryEnabled: boolean;
  maxHistoryTurns: number;
  toolsEnabled: boolean;
  maxToolRounds: number;
}

let cachedIdentity: XiyueIdentity | null = null;
let cacheExpiresAt = 0;
const CACHE_TTL_MS = 30_000;

async function fetchIdentityFromSidecar(): Promise<XiyueIdentity | null> {
  try {
    const port = await getXiyueAgentPortSafe();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(`http://127.0.0.1:${port}/identity`, { signal: controller.signal as any });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as XiyueIdentity;
  } catch {
    return null;
  }
}

function getCachedIdentity(): XiyueIdentity | null {
  if (cachedIdentity && Date.now() < cacheExpiresAt) {
    return cachedIdentity;
  }
  return null;
}

function setCachedIdentity(data: XiyueIdentity | null): void {
  cachedIdentity = data;
  cacheExpiresAt = Date.now() + CACHE_TTL_MS;
}

export function invalidateIdentityCache(): void {
  cachedIdentity = null;
  cacheExpiresAt = 0;
}

async function getXiyueAgentPortSafe(): Promise<number> {
  try {
    const { getXiyueAgentPort } = await import('../../services/xiyueAgentService');
    return getXiyueAgentPort();
  } catch {
    return 8765;
  }
}

export function registerXiyueIdentityIpcHandlers(): void {
  ipcMain.handle('xiyue:identity', async (): Promise<XiyueIdentity> => {
    const cached = getCachedIdentity();
    if (cached) return cached;

    const fromSidecar = await fetchIdentityFromSidecar();
    if (fromSidecar) {
      setCachedIdentity(fromSidecar);
      return fromSidecar;
    }

    const fallback: XiyueIdentity = {
      name: '汐月',
      visibleName: '汐月',
      englishName: 'Xiyue',
      role: '本地常驻 AI 管家',
      modelDefault: 'qwen3-4b-32k',
      systemIdentifier: 'xiyue-local-agent',
      greeting: '我在，怎么了？',
      languageDefault: 'zh-CN',
      localFirst: true,
      cloudFallbackDefaultOff: true,
      dataNeverLeaveMachine: true,
      emotionEnabled: true,
      emotionDefaultState: 'calm',
      memoryEnabled: true,
      maxHistoryTurns: 10,
      toolsEnabled: true,
      maxToolRounds: 8,
    };
    setCachedIdentity(fallback);
    return fallback;
  });
}
