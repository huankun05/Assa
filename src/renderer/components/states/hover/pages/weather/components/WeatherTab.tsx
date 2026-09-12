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
 * @file WeatherTab.tsx
 * @description 天气 Tab 内容组件
 * @author 鸡哥
 */

import { type SyntheticEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../../../store/slices';
import { abbreviateWeatherDescription } from '../../../../../../utils/weatherText';
import '../../../../../../styles/hover/weather-tab.css';
import { FALLBACK_WEATHER_ICON } from '../config/weatherConfig';
import {
  getWeekLabel,
  getWeatherIconPath,
  getWeatherSmallIconPath,
} from '../utils/weatherUtils';

/**
 * 天气 Tab 内容
 * @description 显示当前天气及未来两天预报
 * @returns 天气 Tab 元素
 */
export function WeatherTab(): React.ReactElement {
  const { t } = useTranslation();
  const weather = useIslandStore(s => s.weather);
  const location = useIslandStore(s => s.location);
  const fetchWeatherData = useIslandStore(s => s.fetchWeatherData);
  const hoverTab = useIslandStore(s => s.hoverTab);
  const [refreshState, setRefreshState] = useState<'idle' | 'refreshing' | 'success' | 'error'>('idle');
  const [toastTimer, setToastTimer] = useState<number | null>(null);
  const hour = new Date().getHours();
  /** 图标码能区分日夜时优先用数据，否则回退本机 6–18 点 */
  const inferIsDay = (iconCode: number): boolean => {
    if (iconCode >= 500 && iconCode < 1000) return hour >= 6 && hour < 18;
    return hour >= 6 && hour < 18;
  };
  const isDay = inferIsDay(weather.iconCode);
  const currentWeatherDesc = abbreviateWeatherDescription(weather.description, t);

  // 切换到天气 tab 时自动刷新一次（节流保护：5 分钟内不重复）
  useEffect(() => {
    if (hoverTab === 'weather') {
      fetchWeatherData().catch(() => {});
    }
  }, [hoverTab, fetchWeatherData]);

  // 组件卸载时清理 toast 定时器
  useEffect(() => {
    return () => {
      if (toastTimer !== null) window.clearTimeout(toastTimer);
    };
  }, [toastTimer]);

  const showToast = (state: 'success' | 'error'): void => {
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    setRefreshState(state);
    const id = window.setTimeout(() => {
      setRefreshState('idle');
    }, 2000);
    setToastTimer(id);
  };

  const formatTime = (): string => {
    const d = new Date();
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  const handleIconError = (event: SyntheticEvent<HTMLImageElement>): void => {
    event.currentTarget.onerror = null;
    event.currentTarget.src = FALLBACK_WEATHER_ICON;
  };

  const handleRefresh = async (): Promise<void> => {
    if (refreshState === 'refreshing') return;
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    setRefreshState('refreshing');
    try {
      await fetchWeatherData(undefined, true);
      showToast('success');
    } catch {
      showToast('error');
    }
  };

  return (
    <div className="weather-tab">
      {/* 左：大天气图标 + 天气描述 / 刷新反馈 */}
      <div className="weather-tab-icon-block">
        <img
          src={getWeatherIconPath(weather.iconCode, isDay)}
          alt={currentWeatherDesc}
          className={`weather-tab-icon weather-tab-icon-clickable${refreshState === 'refreshing' ? ' weather-tab-icon-spinning' : ''}`}
          onClick={handleRefresh}
          onError={handleIconError}
          title={t('hover.weather.refreshTitle', { defaultValue: '点击刷新天气' })}
        />
        <span className={`weather-tab-desc${refreshState !== 'idle' ? ' weather-tab-toast weather-tab-toast-' + refreshState : ''}`}>
          {refreshState === 'refreshing' && (t('hover.weather.refreshing', { defaultValue: '刷新中...' }))}
          {refreshState === 'success' && (t('hover.weather.updated', { defaultValue: '已更新' }) + ' · ' + formatTime())}
          {refreshState === 'error' && (t('hover.weather.refreshFailed', { defaultValue: '刷新失败' }))}
          {refreshState === 'idle' && currentWeatherDesc}
        </span>
      </div>

      {/* 中：温度大字 + 位置块（并排，位置贴温度右侧） */}
      <div className="weather-tab-mid-block">
        <div className="weather-tab-temp-big tabular-nums">
          {weather.temperature}°
        </div>
        <div className="weather-tab-location">
          <span className="weather-tab-city">
            {location?.city ?? t('hover.weather.unknownCity', { defaultValue: '未知' })}
          </span>
          <span className="weather-tab-coords tabular-nums">
            {location ? `${location.latitude.toFixed(2)}°N ${location.longitude.toFixed(2)}°E` : ''}
          </span>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="weather-tab-divider" />

      {/* 右：未来两天预报（仅砍降水概率 & 风速） */}
      <div className="weather-tab-forecast">
        {weather.forecast.map((day, index) => (
          <div key={`${getWeekLabel(index, t)}-${day.description}-${day.iconCode}-${day.temperatureMin}-${day.temperatureMax}`} className="weather-tab-forecast-row">
            <span className="text-xs opacity-60 w-6 leading-none">{getWeekLabel(index, t)}</span>
            <img
              src={getWeatherSmallIconPath(day.iconCode, isDay)}
              alt={abbreviateWeatherDescription(day.description, t)}
              className="weather-tab-forecast-icon"
              onError={handleIconError}
            />
            <span className="text-xs leading-none">{abbreviateWeatherDescription(day.description, t)}</span>
            <span className="weather-tab-temps tabular-nums" title={`${day.temperatureMax}℃ / ${day.temperatureMin}℃`}>
              {day.temperatureMax}° / {day.temperatureMin}°
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
