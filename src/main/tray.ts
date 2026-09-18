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
 * @file tray.ts
 * @description 系统托盘模块：托盘图标加载、托盘实例创建及右键菜单配置
 * @author 鸡哥
 */

import { Tray, Menu, nativeImage, BrowserWindow, app } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import { openSettingsWindow } from './window/settingsWindow';
import { restartApp, quitAppFast } from './services/appRestart';

let tray: Tray | null = null;
let getMainWindowRef: (() => BrowserWindow | null) | null = null;
let cachedVisibleName: string | null = null;

async function getTrayTooltip(): Promise<string> {
  if (!cachedVisibleName) {
    try {
      const data = await window.api?.assaIdentity?.();
      if (data?.visible_name) cachedVisibleName = String(data.visible_name);
    } catch {
      // ignore
    }
    cachedVisibleName = cachedVisibleName || 'Assa';
  }
  return cachedVisibleName;
}

function setTrayTooltip(): void {
  if (tray && cachedVisibleName) {
    tray.setToolTip(cachedVisibleName);
  }
}

async function refreshTrayIdentity(): Promise<void> {
  cachedVisibleName = null;
  const name = await getTrayTooltip();
  if (tray) tray.setToolTip(name);
}

/**
 * 托盘图标路径常量
 * @description 开发环境从项目根目录加载，生产环境从 extraResources 打包目录加载
 */
const TRAY_ICON_PATH = is.dev
  ? join(__dirname, '../../resources/icon/assa_16x16.ico')
  : join(process.resourcesPath, 'icon/assa_16x16.ico');

/**
 * 创建系统托盘
 * @description 初始化托盘图标、右键菜单，提供退出和显示窗口功能
 */
function createTray(mainWindowGetter: () => BrowserWindow | null): Tray {
  getMainWindowRef = mainWindowGetter;
  const icon = nativeImage.createFromPath(TRAY_ICON_PATH);
  tray = new Tray(icon);
  const logDir = join(app.getPath('userData'), 'logs');

  const menuItems: Electron.MenuItemConstructorOptions[] = [
    {
      label: '显示灵动岛',
      click: () => {
        const win = getMainWindowRef?.();
        if (!win || win.isDestroyed()) return;
        win.show();
        win.setAlwaysOnTop(true, 'screen-saver');
      }
    },
    {
      label: '隐藏灵动岛',
      click: () => {
        const win = getMainWindowRef?.();
        if (!win || win.isDestroyed()) return;
        win.hide();
      }
    },
    {
      label: '设置',
      click: () => {
        openSettingsWindow();
      }
    },
  ];

  menuItems.push(
    {
      label: '窗口置顶',
      type: 'checkbox',
      checked: getMainWindowRef?.()?.isAlwaysOnTop() ?? false,
      click: (menuItem) => {
        const win = getMainWindowRef?.();
        if (!win || win.isDestroyed()) return;
        win.setAlwaysOnTop(Boolean(menuItem.checked));
      }
    },
    { type: 'separator' },
    {
      label: '重启灵动岛',
      click: () => {
        try {
          restartApp();
        } catch {
          // EPIPE/console 已在 appRestart 内保护；此处不再打日志
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        // 强制退出：app.quit 会被设置窗口 close preventDefault 卡住
        quitAppFast();
      }
    }
  );

  const contextMenu = Menu.buildFromTemplate(menuItems);
  getTrayTooltip().then((name) => tray?.setToolTip(name));
  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    const win = getMainWindowRef?.();
    if (!win || win.isDestroyed()) return;
    if (win.isVisible()) {
      win.hide();
    } else {
      win.show();
      win.setAlwaysOnTop(true, 'screen-saver');
    }
  });

  return tray;
}

/**
 * 销毁系统托盘
 * @description 应用退出时调用，释放托盘资源
 */
function destroyTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
  }
}

/**
 * 切换系统托盘图标显示/隐藏
 * @description 隐藏时销毁托盘；显示时重建托盘
 */
function toggleTray(): void {
  if (tray) {
    tray.destroy();
    tray = null;
    getMainWindowRef = null;
  } else if (getMainWindowRef) {
    createTray(getMainWindowRef);
  }
}

export { createTray, destroyTray, toggleTray };
