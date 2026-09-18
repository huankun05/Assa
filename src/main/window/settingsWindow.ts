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
 * @file settingsWindow.ts
 * @description 设置独立窗口服务模块。
 * 策略：
 * - 启动空闲 / 进控制中心时后台预热：**直接 load 设置应用**（跳过 loading 页双重加载）
 * - 关闭即隐藏；长时间不可见后自动销毁
 * - 冷启动打开（无预热）才走 loading 页，避免首开白屏
 * @author 鸡哥
 */

import { BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { existsSync } from 'fs';
import { is } from '@electron-toolkit/utils';
import { isApplicationQuitting } from '../services/appRestart';

let settingsWindow: BrowserWindow | null = null;
/** 设置应用是否已 finished-load（预热完成后为 true） */
let settingsAppReady = false;

const IDLE_UNLOAD_MS = 10 * 60 * 1000;
let idleUnloadTimer: ReturnType<typeof setTimeout> | null = null;

function clearIdleUnloadTimer(): void {
  if (idleUnloadTimer !== null) {
    clearTimeout(idleUnloadTimer);
    idleUnloadTimer = null;
  }
}

function destroySettingsWindowNow(): void {
  clearIdleUnloadTimer();
  const win = settingsWindow;
  settingsWindow = null;
  settingsAppReady = false;
  if (!win || win.isDestroyed()) return;
  win.removeAllListeners('close');
  win.destroy();
}

function scheduleIdleUnload(): void {
  clearIdleUnloadTimer();
  idleUnloadTimer = setTimeout(() => {
    idleUnloadTimer = null;
    if (isApplicationQuitting()) return;
    if (settingsWindow && !settingsWindow.isDestroyed() && settingsWindow.isVisible()) return;
    destroySettingsWindowNow();
  }, IDLE_UNLOAD_MS);
}

function getSettingsUrl(): string {
  return is.dev && process.env['ELECTRON_RENDERER_URL']
    ? process.env['ELECTRON_RENDERER_URL'] + '/DynamicIslandSettings.html'
    : join(__dirname, '../renderer/DynamicIslandSettings.html');
}

function getLoadingHtmlPath(): string {
  return join(
    is.dev ? process.cwd() : process.resourcesPath,
    is.dev ? 'resources/settings-loading.html' : 'settings-loading.html',
  );
}

function loadSettingsApp(win: BrowserWindow): void {
  const settingsUrl = getSettingsUrl();
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(settingsUrl);
  } else {
    void win.loadFile(settingsUrl);
  }
}

/**
 * @param autoShow - ready-to-show 时是否自动显示
 * @param useSplashLoading - 冷打开时是否先载 loading 页（预热路径传 false，避免双重加载）
 */
function createSettingsWindow(autoShow: boolean, useSplashLoading: boolean): BrowserWindow {
  const win = new BrowserWindow({
    width: 1240,
    height: 760,
    minWidth: 980,
    minHeight: 640,
    show: false,
    frame: false,
    transparent: false,
    backgroundColor: '#f4f6fa',
    resizable: true,
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

  settingsAppReady = false;

  const markReady = (): void => {
    if (win.isDestroyed()) return;
    settingsAppReady = true;
  };

  const loadingHtml = getLoadingHtmlPath();
  if (useSplashLoading && existsSync(loadingHtml)) {
    void win.loadFile(loadingHtml);
    win.webContents.once('did-finish-load', () => {
      if (win.isDestroyed()) return;
      win.webContents.once('did-finish-load', markReady);
      loadSettingsApp(win);
    });
  } else {
    // 预热：直接 load 设置应用（HTML 内有骨架屏），少一次页面跳转
    win.webContents.once('did-finish-load', markReady);
    loadSettingsApp(win);
  }

  if (autoShow) {
    win.on('ready-to-show', () => {
      if (!win.isDestroyed()) win.show();
    });
  }

  win.on('close', (event) => {
    if (isApplicationQuitting()) {
      clearIdleUnloadTimer();
      return;
    }
    event.preventDefault();
    win.hide();
    scheduleIdleUnload();
  });

  win.on('show', () => {
    clearIdleUnloadTimer();
  });

  win.on('hide', () => {
    scheduleIdleUnload();
  });

  win.on('closed', () => {
    clearIdleUnloadTimer();
    settingsAppReady = false;
    if (settingsWindow === win) settingsWindow = null;
  });

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  return win;
}

function showAndFocus(win: BrowserWindow): void {
  try {
    if (win.isDestroyed()) return;
    if (!win.isVisible()) win.show();
    win.focus();
  } catch {
    // ignore
  }
}

/**
 * 后台预热设置窗（不显示）。
 * 直接 load 设置应用，不经过 loading 页。
 */
function preloadSettingsWindow(): void {
  if (isApplicationQuitting()) return;
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    clearIdleUnloadTimer();
    return;
  }
  const win = createSettingsWindow(false, false);
  settingsWindow = win;
  clearIdleUnloadTimer();
}

/**
 * 打开设置窗口。
 * 已预热且应用已 load 完 → 直接 show（秒开）。
 * 仍在加载 → 先 show（骨架/加载中），不阻塞点击。
 */
function openSettingsWindow(): void {
  if (isApplicationQuitting()) return;

  if (settingsWindow && !settingsWindow.isDestroyed()) {
    clearIdleUnloadTimer();
    showAndFocus(settingsWindow);
    setTimeout(() => {
      if (settingsWindow && !settingsWindow.isDestroyed() && !settingsWindow.isVisible()) {
        showAndFocus(settingsWindow);
      }
    }, 80);
    return;
  }

  // 冷打开：loading 页 + 设置应用
  const win = createSettingsWindow(true, true);
  settingsWindow = win;
  showAndFocus(win);
}

function closeSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
}

function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}

function isSettingsAppReady(): boolean {
  return settingsAppReady && Boolean(settingsWindow && !settingsWindow.isDestroyed());
}

export {
  openSettingsWindow,
  preloadSettingsWindow,
  closeSettingsWindow,
  getSettingsWindow,
  isSettingsAppReady,
};
