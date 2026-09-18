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
 * @file DynamicIslandMain.tsx
 * @description React 19 渲染进程入口，挂载根组件并初始化全局样式
 * @author 鸡哥
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import DynamicIsland from './components/DynamicIsland';
import useIslandStore from './store/slices';
import { hydrateWeatherLocationConfigFromStore } from './store/utils/storage';
import { initTheme } from './utils/theme';
import { initFonts } from './utils/font';
import { bootstrapAuthSession } from './utils/authSession';
import i18n from './i18n';

function applyIslandOpacity(opacity: number): void {
  const safe = Math.max(10, Math.min(100, Math.round(opacity)));
  document.documentElement.style.setProperty('--island-opacity', String(safe));
}

const root = document.getElementById('root');
if (!root) {
  throw new Error(`[Renderer] ${i18n.t('common.errors.rootMountNotFound', { defaultValue: '未找到 #root 挂载节点' })}`);
}
const rootEl = root;

/** 启动时初始化主题（读取持久化设置并应用 data-theme，在 React 挂载前执行避免闪烁） */
async function bootstrap(): Promise<void> {
  await initTheme();
  /**
   * 字体不阻塞 createRoot：大 TTF/OTF 的 base64 传输与 atob 会显著拉长首屏。
   * 先挂载 UI，字体就绪后通过 CSS 变量生效（短暂回退系统字体可接受）。
   */
  void initFonts();
  await bootstrapAuthSession();
  await hydrateWeatherLocationConfigFromStore();

  /** 启动时初始化灵动岛透明度（在 React 挂载前设置，避免首次渲染闪烁） */
  window.api?.islandOpacityGet?.().then((val) => {
    applyIslandOpacity(typeof val === 'number' ? val : 100);
  }).catch(() => {
    applyIslandOpacity(100);
  });

  /** 定时刷新天气：每 30 分钟一次（fetchWeatherData 内部有 5 分钟节流保护） */
  setInterval(() => {
    useIslandStore.getState().fetchWeatherData().catch(() => {});
  }, 30 * 60 * 1000);

  /**
   * 挂载 React 根组件，启动灵动岛 UI
   * @description 使用 StrictMode 捕获潜在问题，生产环境无额外影响
   */
  createRoot(rootEl).render(
    <StrictMode>
      <DynamicIsland />
    </StrictMode>
  );

  /** 挂载后再拉天气，避免与首屏渲染抢主线程 */
  useIslandStore.getState().fetchWeatherData().catch(() => {});
}

void bootstrap();
