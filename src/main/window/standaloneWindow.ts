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
 * @file standaloneWindow.ts
 * @description 倒数日/TODOs/设置 独立窗口服务模块
 * @author 鸡哥
 */

import { app, BrowserWindow, shell } from 'electron';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { broadcastSettingChange } from '../utils/broadcast';

let standaloneWindow: BrowserWindow | null = null;
/** 窗口创建时是否允许在 ready-to-show 自动显示（预创建隐藏窗口时设为 false） */
let standaloneWindowAutoShow = false;

/** 独立窗口「设置」标签页键 */
const SETTINGS_TAB = 'settings';

/** 独立窗口活动标签页存储键，需与 renderer 侧 ACTIVE_TAB_STORE_KEY 保持一致 */
const ACTIVE_TAB_STORE_KEY = 'standalone-window-active-tab';

/**
 * 打开独立窗口（若已打开则聚焦）
 */
/**
 * 创建独立窗口
 * @param autoShow - ready-to-show 时是否自动显示（预创建隐藏窗口时传 false）
 */
function createStandaloneWindow(autoShow: boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: 1155,
    height: 640,
    minWidth: 1155,
    minHeight: 640,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#000000',
    resizable: true,
    icon: is.dev
      ? join(__dirname, '../../resources/icon/eisland_256x256.ico')
      : join(process.resourcesPath, 'icon/eisland_256x256.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  standaloneWindowAutoShow = autoShow;

  win.on('ready-to-show', () => {
    if (standaloneWindowAutoShow) win.show();
  });

  // 关闭即隐藏而非销毁：拦截 'close' 事件（含窗口 X 按钮、Alt+F4、closeStandaloneWindow），
  // 保留渲染进程常驻，下次打开无需重建窗口与重新 loadURL，实现秒开。
  // 内存代价仅在「首次打开过」之后产生（常驻一个窗口），启动阶段零额外占用。
  win.on('close', (event) => {
    event.preventDefault();
    win.hide();
  });

  win.on('closed', () => {
    standaloneWindow = null;
  });

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/DynamicIslandStandalone.html');
  } else {
    win.loadFile(join(__dirname, '../renderer/DynamicIslandStandalone.html'));
  }

  return win;
}

/**
 * 打开独立窗口（若已打开则直接显示，否则创建并自动显示）
 */
function openStandaloneWindow(): void {
  if (standaloneWindow && !standaloneWindow.isDestroyed()) {
    // 保活模式：窗口仍驻留（只是被隐藏），直接重新显示即可，无需重建 → 秒开、省去 loadURL 开销
    if (standaloneWindow.isVisible()) {
      standaloneWindow.focus();
    } else {
      standaloneWindow.show();
      standaloneWindow.focus();
    }
    return;
  }
  standaloneWindow = createStandaloneWindow(true);
}

/**
 * 启动空闲后预创建隐藏窗口：把「首次打开」的建窗 + loadURL + 首屏渲染成本前移，
 * 使第一次打开也秒开。仅创建一个窗口（所有 tab 共用），代价是启动即常驻一个窗口内存（~50–150MB）。
 */
export function precreateStandaloneWindow(): void {
  if (standaloneWindow && !standaloneWindow.isDestroyed()) return;
  standaloneWindow = createStandaloneWindow(false);
}

/**
 * 打开独立设置窗口
 * @description 先把活动标签持久化为「设置」再拉起/聚焦独立窗口，窗口（无论是否已存在）
 *   都会停在全量设置页，可统一控制所有页面与功能的启停。不依赖倒计时窗口模式。
 * @returns 是否成功发起打开
 */
function openStandaloneSettingsWindow(): boolean {
  try {
    const storeDir = join(app.getPath('userData'), 'eIsland_store');
    if (!existsSync(storeDir)) mkdirSync(storeDir, { recursive: true });
    writeFileSync(
      join(storeDir, `${ACTIVE_TAB_STORE_KEY}.json`),
      JSON.stringify(SETTINGS_TAB, null, 2),
      'utf-8',
    );
  } catch (err) {
    console.error('[StandaloneWindow] persist settings tab error:', err);
  }

  openStandaloneWindow();
  broadcastSettingChange(-1, `store:${ACTIVE_TAB_STORE_KEY}`, SETTINGS_TAB);
  return true;
}

/**
 * 关闭独立窗口
 */
function closeStandaloneWindow(): void {
  if (standaloneWindow && !standaloneWindow.isDestroyed()) {
    standaloneWindow.close();
  }
}

/**
 * 获取独立窗口实例
 */
function getStandaloneWindow(): BrowserWindow | null {
  return standaloneWindow;
}

export {
  openStandaloneWindow,
  openStandaloneSettingsWindow,
  closeStandaloneWindow,
  getStandaloneWindow,
  precreateStandaloneWindow,
};
