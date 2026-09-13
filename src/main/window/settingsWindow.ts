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
 * 设置作为「元功能」（配置一切），与待办/相册/工具等业务面板分离成独立窗口，
 * 避免与业务功能共用一个窗口造成的语义混淆与相互拖累。
 * 采用按需创建（首次打开才建窗）、关闭即隐藏（保活复用，秒开）的策略，与业务窗口一致。
 * @author 鸡哥
 */

import { BrowserWindow, shell } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { isApplicationQuitting } from '../services/appRestart';

let settingsWindow: BrowserWindow | null = null;

/**
 * 创建设置窗口
 * @param autoShow - ready-to-show 时是否自动显示
 */
function createSettingsWindow(autoShow: boolean): BrowserWindow {
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
      ? join(__dirname, '../../resources/icon/xiyue_256x256.ico')
      : join(process.resourcesPath, 'icon/xiyue_256x256.ico'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  });

  if (autoShow) {
    win.on('ready-to-show', () => win.show());
  }

  // 关闭即隐藏而非销毁：拦截 'close'（含窗口 X 按钮、Alt+F4、windowClose），
  // 保留渲染进程常驻，下次打开无需重建与重新 loadURL，实现秒开。
  // 只在首次打开过后产生常驻内存（关闭不销毁仅隐藏），启动阶段零额外占用。
  // 强制退出时必须放行 close，否则 app.quit/exit 会被 preventDefault 卡住。
  win.on('close', (event) => {
    if (isApplicationQuitting()) return;
    event.preventDefault();
    win.hide();
  });

  win.on('closed', () => {
    settingsWindow = null;
  });

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: 'deny' };
  });

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'] + '/DynamicIslandSettings.html');
  } else {
    win.loadFile(join(__dirname, '../renderer/DynamicIslandSettings.html'));
  }

  return win;
}

/**
 * 打开设置窗口（若已打开则直接显示/聚焦，否则创建并自动显示）
 */
function openSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    // dev：每次打开强制 reload，避免「关闭即隐藏」把旧 bundle 一直挂在内存里
    if (is.dev) {
      void settingsWindow.webContents.reload();
    }
    if (settingsWindow.isVisible()) {
      settingsWindow.focus();
    } else {
      settingsWindow.show();
      settingsWindow.focus();
    }
    return;
  }
  settingsWindow = createSettingsWindow(true);
}

/**
 * 关闭设置窗口（触发 close → 隐藏，保活复用）
 */
function closeSettingsWindow(): void {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.close();
  }
}

/**
 * 获取设置窗口实例
 */
function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow;
}

export {
  openSettingsWindow,
  closeSettingsWindow,
  getSettingsWindow,
};