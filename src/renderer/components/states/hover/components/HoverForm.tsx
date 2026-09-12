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
 * @file HoverForm.tsx
 * @description Hover 状态表单组件
 * @author 鸡哥
 */

import type { ReactElement } from 'react';
import { useState } from 'react';
import type { useHover } from '../hooks/useHover';
import { ControlCenterTab } from '../pages/time';
import { LyricsTab } from '../pages/lyric';
import { WeatherTab } from '../pages/weather';
import { PomodoroTab } from '../pages/pomodoro';
import { XiyueTab } from '../pages/xiyue';
import { CustomPage } from '../pages/custom/CustomPage';

type HoverFormProps = ReturnType<typeof useHover>;

/** Hover 状态表单组件 */
export function HoverForm(props: HoverFormProps): ReactElement {
  const {
    fullTimeStr,
    lunarStr,
    t,
    hoverTab,
    setHoverTab,
    setExpanded,
    contentRef,
    getDotLabel,
    navTabs,
  } = props;

  // 浮层（亮度/音量 popover）激活时隐藏右侧 toolbar，避免图标穿透显示
  const [popoverActive, setPopoverActive] = useState(false);

  return (
    <div className={`hover-content${popoverActive ? ' popover-active' : ''}`} ref={contentRef}>
      <div className="hover-nav-dots">
        {navTabs.map((tab) => (
          <button
            key={tab}
            className={`hover-nav-dot ${hoverTab === tab ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); if (tab === 'expand') { setExpanded(); } else { setHoverTab(tab); } }}
            title={getDotLabel(tab)}
            aria-label={t('hover.nav.switchToPage', { defaultValue: '切换到{{label}}页面', label: getDotLabel(tab) })}
          />
        ))}
      </div>

      <div className="hover-tab-content" onClick={(e) => e.stopPropagation()}>
        {hoverTab === 'time' && (
          <ControlCenterTab
            fullTimeStr={fullTimeStr}
            lunarStr={lunarStr}
            onPopoverChange={setPopoverActive}
          />
        )}
        {hoverTab === 'lyrics' && <LyricsTab />}
        {hoverTab === 'weather' && <WeatherTab />}
        {hoverTab === 'pomodoro' && <PomodoroTab />}
        {hoverTab === 'xiyue' && <XiyueTab />}
        {hoverTab.startsWith('custom:') && (
          <CustomPage tabId={hoverTab.slice('custom:'.length)} />
        )}
      </div>
    </div>
  );
}
