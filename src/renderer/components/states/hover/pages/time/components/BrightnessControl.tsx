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
 * @file BrightnessControl.tsx
 * @description Hover 时间页中的屏幕亮度调节控件
 * @author 鸡哥
 */

import { type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { useBrightness } from '../hooks/useBrightness';

/**
 * 屏幕亮度调节控件
 * @description 读取当前屏幕亮度，并在滑动时通过主进程更新系统亮度
 * @returns 屏幕亮度调节元素
 */
export function BrightnessControl(): ReactElement {
  const { t } = useTranslation();
  const {
    brightness,
    isAvailable,
    handleBrightnessChange,
    handleBrightnessPointerDown,
    handleBrightnessPointerUp,
  } = useBrightness();

  const handlePointerDown = (event: ReactPointerEvent<HTMLInputElement>): void => {
    // 指针捕获：拖动期间即使滑出滑块，pointerup 仍会回到本元素，抑制才可靠
    event.currentTarget.setPointerCapture(event.pointerId);
    handleBrightnessPointerDown();
  };

  return (
    <div className="brightness-panel">
      <div className="timer-title-row">
        <div className="timer-title">
          <span className="text-[13px] font-medium text-[var(--color-island-text)] leading-tight">
            {t('hover.brightness.title', { defaultValue: '屏幕亮度' })}
          </span>
        </div>
        <span className="text-[12px] text-[var(--color-island-text)] opacity-70 leading-tight ml-2">
          {t('hover.brightness.hint', { defaultValue: '拖动调节' })}
        </span>
      </div>
      <div className="brightness-control-row">
        <input
          className="brightness-slider"
          type="range"
          min="0"
          max="100"
          step="1"
          value={brightness}
          disabled={!isAvailable}
          onChange={handleBrightnessChange}
          onPointerDown={handlePointerDown}
          onPointerUp={handleBrightnessPointerUp}
          onPointerCancel={handleBrightnessPointerUp}
          aria-label={t('hover.brightness.sliderLabel', { defaultValue: '屏幕亮度' })}
          style={{ ['--slider-val' as string]: `${brightness}%` } as CSSProperties}
        />
        <span className="brightness-value">
          {isAvailable ? `${brightness}%` : t('hover.brightness.unavailable', { defaultValue: '不可用' })}
        </span>
      </div>
    </div>
  );
}