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
 * @file store.ts
 * @description 通用存储 IPC 处理模块
 * @description 处理通用键值存储的读取和写入操作
 * @author 鸡哥
 */

import { ipcMain } from 'electron';
import { existsSync, readFileSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { broadcastSettingChange } from '../../utils/broadcast';
import type { RegisterStoreIpcHandlersOptions } from './types';

/** 合法的 store key：不含路径分隔符和 traversal 片段 */
function isValidStoreKey(key: unknown): key is string {
  return typeof key === 'string' && key.length > 0 && !/[\\/]/.test(key) && !key.includes('..');
}

/**
 * 进程内读缓存：mtime+size 未变则不重复 readFileSync+JSON.parse。
 * store 配置是高频小 JSON 读；同步磁盘 IO 在启动/设置交互时会卡主进程。
 */
interface StoreCacheEntry {
  mtimeMs: number;
  size: number;
  value: unknown;
}
const storeReadCache = new Map<string, StoreCacheEntry>();

function readStoreCached(filePath: string): unknown | null {
  const st = statSync(filePath);
  const cached = storeReadCache.get(filePath);
  if (cached && cached.mtimeMs === st.mtimeMs && cached.size === st.size) {
    return cached.value;
  }
  const raw = readFileSync(filePath, 'utf-8');
  const value = JSON.parse(raw);
  storeReadCache.set(filePath, { mtimeMs: st.mtimeMs, size: st.size, value });
  return value;
}

/**
 * 注册通用存储 IPC 处理器
 * @description 注册通用键值存储读写 IPC 事件处理器
 * @param options - 配置选项，包含存储目录
 */
export function registerStoreIpcHandlers(options: RegisterStoreIpcHandlersOptions): void {
  ipcMain.handle('store:read', (_event, key: string) => {
    try {
      if (!isValidStoreKey(key)) return null;
      const filePath = join(options.storeDir, `${key}.json`);
      if (!existsSync(filePath)) return null;
      return readStoreCached(filePath);
    } catch (err) {
      console.error(`[Store] read '${key}' error:`, err);
      return null;
    }
  });

  ipcMain.handle('store:write', (event, key: string, data: unknown) => {
    try {
      if (!isValidStoreKey(key)) return false;
      const filePath = join(options.storeDir, `${key}.json`);
      writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      storeReadCache.delete(filePath);
      broadcastSettingChange(event.sender.id, `store:${key}`, data);
      return true;
    } catch (err) {
      console.error(`[Store] write '${key}' error:`, err);
      return false;
    }
  });
}
