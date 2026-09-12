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
 * @file PomodoroTab.tsx
 * @description Hover 番茄钟精简页：大时间 + 阶段 + 播放/暂停/重置。
 * 时长与循环在设置页配置（DESIGN_SYSTEM §4A：小面板不放表单）。
 * @author 鸡哥
 */

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../../../store/slices';

function formatMMSS(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
}

/** 默认专注时长（分钟）；后续可迁设置 store */
const DEFAULT_WORK_MIN = 25;
const DEFAULT_BREAK_MIN = 5;

/** Hover 番茄钟页 */
export function PomodoroTab(): ReactElement {
  const { t } = useTranslation();
  const {
    pomodoroPhase,
    pomodoroRemaining,
    pomodoroRunning,
    setPomodoroPhase,
    setPomodoroRemaining,
    setPomodoroRunning,
  } = useIslandStore();

  const workSec = DEFAULT_WORK_MIN * 60;
  const breakSec = DEFAULT_BREAK_MIN * 60;
  const [loopEnabled] = useState(true);

  useEffect(() => {
    if (!pomodoroRunning) return;
    const id = setInterval(() => {
      const st = useIslandStore.getState();
      const cur = st.pomodoroRemaining;
      if (cur <= 1) {
        if (st.pomodoroPhase === 'work') {
          st.setPomodoroPhase('shortBreak');
          st.setPomodoroRemaining(breakSec);
          if (!loopEnabled) st.setPomodoroRunning(false);
        } else {
          st.setPomodoroPhase('work');
          st.setPomodoroRemaining(workSec);
          if (!loopEnabled) st.setPomodoroRunning(false);
        }
      } else {
        st.setPomodoroRemaining(cur - 1);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [pomodoroRunning, loopEnabled, workSec, breakSec]);

  const handleStart = (): void => {
    if (
      pomodoroRemaining <= 0
      || (pomodoroPhase === 'work' && pomodoroRemaining >= workSec)
      || (pomodoroPhase === 'shortBreak' && pomodoroRemaining >= breakSec)
    ) {
      setPomodoroRemaining(pomodoroPhase === 'work' ? workSec : breakSec);
    }
    setPomodoroRunning(true);
  };

  const handleReset = (): void => {
    setPomodoroRunning(false);
    setPomodoroPhase('work');
    setPomodoroRemaining(workSec);
  };

  return (
    <div className="pomodoro-tab">
      <span
        className="pomodoro-phase"
        data-phase={pomodoroPhase}
      >
        {pomodoroPhase === 'work'
          ? t('hover.pomodoro.work', { defaultValue: '工作' })
          : t('hover.pomodoro.break', { defaultValue: '休息' })}
      </span>
      <div className="pomodoro-time">{formatMMSS(pomodoroRemaining)}</div>
      <div className="pomodoro-controls">
        {pomodoroRunning
          ? (
            <button type="button" onClick={() => setPomodoroRunning(false)}>
              {t('hover.pomodoro.pause', { defaultValue: '暂停' })}
            </button>
          )
          : (
            <button type="button" onClick={handleStart}>
              {t('hover.pomodoro.start', { defaultValue: '开始' })}
            </button>
          )}
        <button type="button" onClick={handleReset}>
          {t('hover.pomodoro.reset', { defaultValue: '重置' })}
        </button>
      </div>
    </div>
  );
}
