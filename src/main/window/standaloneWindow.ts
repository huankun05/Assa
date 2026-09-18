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

/** 独立窗口活动标签页存储键，需与 renderer 侧 ACTIVE_TAB_STORE_KEY 保持一致 */
const ACTIVE_TAB_STORE_KEY = 'standalone-window-active-tab';

const WINDOW_DEFAULT = {
  width: 1120,
  height: 700,
  minWidth: 720,
  minHeight: 480,
} as const;

/**
 * 创建独立窗口
 * @param autoShow - ready-to-show 时是否自动显示（预创建隐藏窗口时传 false）
 */
function createStandaloneWindow(autoShow: boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: WINDOW_DEFAULT.width,
    height: WINDOW_DEFAULT.height,
    minWidth: WINDOW_DEFAULT.minWidth,
    minHeight: WINDOW_DEFAULT.minHeight,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#f4f6fa',
    resizable: true,
    maximizable: true,
    minimizable: true,
    fullscreenable: true,
    thickFrame: true,
    icon: is.dev
      ? join(__dirname, '../../resources/icon/assa_256x256.ico')
      : join(process.resourcesPath, 'icon/assa_256x256.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  // 无边框窗在部分 Windows 配置下 resizable 会被重置，创建后强制再设一次
  try {
    win.setResizable(true);
    win.setMinimumSize(WINDOW_DEFAULT.minWidth, WINDOW_DEFAULT.minHeight);
  } catch {
    // ignore
  }

  standaloneWindowAutoShow = autoShow;

  win.on('ready-to-show', () => {
    try {
      win.setResizable(true);
      win.setMinimumSize(WINDOW_DEFAULT.minWidth, WINDOW_DEFAULT.minHeight);
    } catch {
      // ignore
    }
    if (standaloneWindowAutoShow) win.show();
  });

  // 关闭即隐藏而非销毁：拦截 'close'（含窗口 X、Alt+F4），保留渲染进程，下次打开秒开。
  win.on('close', (event) => {
    event.preventDefault();
    win.hide();
  });

  win.on('closed', () => {
    if (standaloneWindow === win) standaloneWindow = null;
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

/** 销毁旧窗（绕过 hide），用于打开时强制用新 BrowserWindow 参数重建 */
function destroyStandaloneWindowNow(): void {
  const win = standaloneWindow;
  standaloneWindow = null;
  if (!win || win.isDestroyed()) return;
  win.removeAllListeners('close');
  win.destroy();
}

/**
 * 打开独立窗口
 * @description 若旧窗不可缩放则重建，保证 resizable/minSize 生效。
 */
function openStandaloneWindow(): void {
  if (standaloneWindow && !standaloneWindow.isDestroyed()) {
    try {
      standaloneWindow.setResizable(true);
      standaloneWindow.setMinimumSize(WINDOW_DEFAULT.minWidth, WINDOW_DEFAULT.minHeight);
    } catch {
      // ignore
    }
    if (!standaloneWindow.isResizable()) {
      destroyStandaloneWindowNow();
    }
  }

  if (standaloneWindow && !standaloneWindow.isDestroyed()) {
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
 * 启动空闲后预创建隐藏窗口
 */
export function precreateStandaloneWindow(): void {
  if (standaloneWindow && !standaloneWindow.isDestroyed()) return;
  standaloneWindow = createStandaloneWindow(false);
}

function persistStandaloneActiveTab(tab: string): void {
  try {
    const storeDir = join(app.getPath('userData'), 'eIsland_store');
    if (!existsSync(storeDir)) mkdirSync(storeDir, { recursive: true });
    writeFileSync(
      join(storeDir, `${ACTIVE_TAB_STORE_KEY}.json`),
      JSON.stringify(tab, null, 2),
      'utf-8',
    );
  } catch (err) {
    console.error('[StandaloneWindow] persist active tab error:', err);
  }
}

/**
 * 打开独立窗口并先切到指定标签页
 */
function openStandaloneWindowWithTab(tab: string): void {
  persistStandaloneActiveTab(tab);
  broadcastSettingChange(-1, `store:${ACTIVE_TAB_STORE_KEY}`, tab);
  openStandaloneWindow();
}

function closeStandaloneWindow(): void {
  if (standaloneWindow && !standaloneWindow.isDestroyed()) {
    standaloneWindow.close();
  }
}

function getStandaloneWindow(): BrowserWindow | null {
  return standaloneWindow;
}

export {
  openStandaloneWindow,
  openStandaloneWindowWithTab,
  closeStandaloneWindow,
  getStandaloneWindow,
};
