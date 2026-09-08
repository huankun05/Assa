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
 * Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY, without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file PomodoroTab.tsx
 * @description Hover 番茄钟专属页（原则：计时器单独成页，不与控制中心混）
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

  const [workMin, setWorkMin] = useState(25);
  const [breakMin, setBreakMin] = useState(5);
  const [loopEnabled, setLoopEnabled] = useState(true);

  const workSec = workMin * 60;
  const breakSec = breakMin * 60;

  // 计时 tick：运行中每秒递减，归零按循环设置切换工作/休息
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
    if (pomodoroRemaining <= 0 || (pomodoroPhase === 'work' && pomodoroRemaining >= workSec) || (pomodoroPhase === 'shortBreak' && pomodoroRemaining >= breakSec)) {
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
      <div className="pomodoro-phase">
        {pomodoroPhase === 'work' ? t('hover.pomodoro.work', { defaultValue: '工作' }) : t('hover.pomodoro.break', { defaultValue: '休息' })}
      </div>
      <div className="pomodoro-time">{formatMMSS(pomodoroRemaining)}</div>

      <div className="pomodoro-inputs">
        <label>
          {t('hover.pomodoro.workMin', { defaultValue: '工作(分)' })}
          <input
            type="number"
            min={1}
            max={120}
            value={workMin}
            onChange={(e) => setWorkMin(Math.max(1, Math.min(120, Number(e.target.value) || 1)))}
          />
        </label>
        <label>
          {t('hover.pomodoro.breakMin', { defaultValue: '休息(分)' })}
          <input
            type="number"
            min={1}
            max={60}
            value={breakMin}
            onChange={(e) => setBreakMin(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
          />
        </label>
      </div>

      <div className="pomodoro-controls">
        {pomodoroRunning
          ? <button onClick={() => setPomodoroRunning(false)}>{t('hover.pomodoro.pause', { defaultValue: '暂停' })}</button>
          : <button onClick={handleStart}>{t('hover.pomodoro.start', { defaultValue: '开始' })}</button>}
        <button onClick={handleReset}>{t('hover.pomodoro.reset', { defaultValue: '重置' })}</button>
        <label className="pomodoro-loop">
          <input type="checkbox" checked={loopEnabled} onChange={(e) => setLoopEnabled(e.target.checked)} />
          {t('hover.pomodoro.loop', { defaultValue: '循环' })}
        </label>
      </div>
    </div>
  );
}
