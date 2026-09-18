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
 * @file StandaloneWindowViewport.tsx
 * @description 独立窗口内容视口组件。
 * @author 鸡哥
 */

import { lazy, Suspense, useEffect } from 'react';
import type { JSX } from 'react';
import type { WindowTab } from '../config/standaloneWindowConfig';
import { StandaloneTabShell } from './StandaloneTabShell';

// 代码分割：每个标签页按需动态加载
const TodoTab = lazy(() => import('../states/maxExpand/components/todo/components/TodoTab').then((m) => ({ default: m.TodoTab })));
const CountdownTab = lazy(() => import('../states/maxExpand/components/countdown').then((m) => ({ default: m.CountdownTab })));
const UrlFavoritesTab = lazy(() => import('../states/maxExpand/components/urlFavorites').then((m) => ({ default: m.UrlFavoritesTab })));
const MailTab = lazy(() => import('../states/maxExpand/components/mail').then((m) => ({ default: m.MailTab })));
const LocalFileSearchTab = lazy(() => import('../states/maxExpand/components/localFileSearch/components/LocalFileSearchTab').then((m) => ({ default: m.LocalFileSearchTab })));
const ClipboardHistoryTab = lazy(() => import('../states/maxExpand/components/clipBoardHistory').then((m) => ({ default: m.ClipboardHistoryTab })));
const MemoTab = lazy(() => import('../states/maxExpand/components/memo/components/MemoTab').then((m) => ({ default: m.MemoTab })));
const AlarmTab = lazy(() => import('../states/maxExpand/components/alarm/components/AlarmTab').then((m) => ({ default: m.AlarmTab })));
const ToolboxTab = lazy(() => import('../states/maxExpand/components/ToolboxTab').then((m) => ({ default: m.ToolboxTab })));
const AiChatTab = lazy(() => import('../states/maxExpand/components/agent').then((m) => ({ default: m.AiChatTab })));
const TranslationTab = lazy(() => import('../states/expand/components/TranslationTab').then((m) => ({ default: m.TranslationTab })));
const CustomPageManager = lazy(() => import('../states/maxExpand/components/customPages/CustomPageManager').then((m) => ({ default: m.CustomPageManager })));

interface StandaloneWindowViewportProps {
  activeTab: WindowTab;
  state: string;
}

/**
 * @description 根据标签页渲染独立窗口内容（各面板按需懒加载）。
 */
export function StandaloneWindowViewport({ activeTab }: StandaloneWindowViewportProps): JSX.Element {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        void window.api.closeStandaloneWindow().catch(() => {});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="cw-viewport settings-v2">
      <StandaloneTabShell>
        <Suspense fallback={<div className="cw-tab-loading" />}>
          {activeTab === 'todo' && <TodoTab />}
          {activeTab === 'countdown' && <CountdownTab />}
          {activeTab === 'urlFavorites' && <UrlFavoritesTab />}
          {activeTab === 'mail' && <MailTab />}
          {activeTab === 'localFileSearch' && <LocalFileSearchTab />}
          {activeTab === 'clipboardHistory' && <ClipboardHistoryTab />}
          {activeTab === 'memo' && <MemoTab />}
          {activeTab === 'alarm' && <AlarmTab />}
          {activeTab === 'toolbox' && <ToolboxTab />}
          {activeTab === 'chat' && <AiChatTab />}
          {activeTab === 'translate' && <TranslationTab />}
          {activeTab === 'customPages' && <CustomPageManager />}
        </Suspense>
      </StandaloneTabShell>
    </div>
  );
}
