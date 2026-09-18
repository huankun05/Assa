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
 * @file weatherUtils.ts
 * @description 天气模块工具函数。
 * 图标使用 Meteocons（MIT）静态 SVG：日/夜彩色分套，不再用灰度 PNG。
 * @author 鸡哥
 */

import type { TFunction } from 'i18next';

/** Meteocons 静态 SVG 目录（相对 renderer public） */
const METEOCONS_BASE = './icon/weather/meteocons';

/**
 * 获取星期标签
 * @param index - 预报天数索引（0=明天，1=后天）
 * @param t - i18n 翻译函数
 * @returns 星期标签字符串
 */
export function getWeekLabel(index: number, t: TFunction): string {
  return index === 0
    ? t('hover.weather.week.tomorrow', { defaultValue: '明天' })
    : t('hover.weather.week.dayAfterTomorrow', { defaultValue: '后天' });
}

/**
 * WMO 天气码 → Meteocons 图标名（不含日夜后缀）。
 * Meteocons 对降水类多为中性图标；晴/多云/阴/雾/雷暴有日夜变体。
 */
function mapWmoCodeToMeteoconsName(iconCode: number): string {
  if (iconCode === 0 || iconCode === 1) return 'clear';
  if (iconCode === 2) return 'partly-cloudy';
  if (iconCode === 3) return 'overcast';
  if (iconCode === 45 || iconCode === 48) return 'fog';
  if (iconCode >= 51 && iconCode <= 57) return 'drizzle';
  if ((iconCode >= 61 && iconCode <= 67) || (iconCode >= 80 && iconCode <= 82)) return 'rain';
  if ((iconCode >= 71 && iconCode <= 77) || iconCode === 85 || iconCode === 86) return 'snow';
  if (iconCode === 95 || iconCode === 96 || iconCode === 99) return 'thunderstorms';
  return 'partly-cloudy';
}

/** 该名称是否存在日夜分套图标 */
function hasDayNightVariants(name: string): boolean {
  return name === 'clear' || name === 'partly-cloudy' || name === 'overcast' || name === 'fog' || name === 'thunderstorms';
}

/**
 * 解析最终使用的 Meteocons 文件名（含 .svg）
 */
export function resolveMeteoconsIconFile(iconCode: number, isDay: boolean): string {
  const name = mapWmoCodeToMeteoconsName(iconCode);
  if (hasDayNightVariants(name)) {
    return `${name}-${isDay ? 'day' : 'night'}.svg`;
  }
  return `${name}.svg`;
}

/**
 * 获取当前天气图标路径（彩色 Meteocons SVG）
 * @param iconCode - WMO 天气图标编号
 * @param isDay - 是否为白天
 * @returns 天气图标资源路径
 */
export function getWeatherIconPath(iconCode: number, isDay: boolean): string {
  return `${METEOCONS_BASE}/${resolveMeteoconsIconFile(iconCode, isDay)}`;
}

/**
 * 获取预报小图标路径（与主图标同一套 SVG，靠 CSS 缩放）
 * @param iconCode - WMO 天气图标编号
 * @param isDay - 是否为白天
 * @returns 天气小图标资源路径
 */
export function getWeatherSmallIconPath(iconCode: number, isDay: boolean): string {
  return getWeatherIconPath(iconCode, isDay);
}

/** 朝霞/晚霞装饰窗口（分钟）：日出日落前后各约 40 分钟 */
export const SOLAR_GLOW_WINDOW_MIN = 40;

/**
 * 解析本地时间字符串为 Date；失败返回 null
 */
export function parseLocalTime(value?: string | null): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * 判断当前是否处于朝霞（日出前后）时段
 * @param sunrise - 今日日出
 * @param now - 当前时间
 * @param windowMin - 窗口分钟数
 */
export function isDawnGlow(sunrise: Date | null, now: Date, windowMin = SOLAR_GLOW_WINDOW_MIN): boolean {
  if (!sunrise) return false;
  const deltaMin = Math.abs(now.getTime() - sunrise.getTime()) / 60000;
  return deltaMin <= windowMin;
}

/**
 * 判断当前是否处于晚霞（日落前后）时段
 */
export function isDuskGlow(sunset: Date | null, now: Date, windowMin = SOLAR_GLOW_WINDOW_MIN): boolean {
  if (!sunset) return false;
  const deltaMin = Math.abs(now.getTime() - sunset.getTime()) / 60000;
  return deltaMin <= windowMin;
}

/**
 * 根据日出日落推断是否白天；无数据时回退 6–18 点
 */
export function resolveIsDay(sunrise: Date | null, sunset: Date | null, now: Date): boolean {
  if (sunrise && sunset) {
    return now >= sunrise && now < sunset;
  }
  const hour = now.getHours();
  return hour >= 6 && hour < 18;
}

/**
 * 日出日落资源路径（Meteocons）
 */
export function getSolarIconPath(kind: 'sunrise' | 'sunset'): string {
  return `${METEOCONS_BASE}/${kind}.svg`;
}

/**
 * 朝霞/晚霞图标：优先真实日出日落时刻；无数据时用粗时间段兜底
 * @returns 'sunrise' | 'sunset' | null
 */
export function resolveSolarGlowKind(
  sunrise: Date | null,
  sunset: Date | null,
  now: Date,
  windowMin = SOLAR_GLOW_WINDOW_MIN,
): 'sunrise' | 'sunset' | null {
  if (isDawnGlow(sunrise, now, windowMin)) return 'sunrise';
  if (isDuskGlow(sunset, now, windowMin)) return 'sunset';
  // 无日出日落数据时：清晨 5–7 点当朝霞，傍晚 17–19 点当晚霞
  if (!sunrise && !sunset) {
    const h = now.getHours() + now.getMinutes() / 60;
    if (h >= 5 && h <= 7) return 'sunrise';
    if (h >= 17 && h <= 19) return 'sunset';
  }
  return null;
}

/**
 * 格式化降水概率文本
 * @param value - 降水概率数值（负值表示无数据）
 * @param t - i18n 翻译函数
 * @returns 格式化后的降水概率字符串
 */
export function formatPrecipitationText(value: number, t: TFunction): string {
  return value < 0 ? ` ${t('hover.weather.na', { defaultValue: 'N/A' })}` : `${value}%`;
}

/**
 * 格式化风速文本
 * @param value - 风速数值（负值表示无数据）
 * @param t - i18n 翻译函数
 * @returns 格式化后的风速文本
 */
export function formatWindText(value: number, t: TFunction): string {
  return value < 0 ? ` ${t('hover.weather.na', { defaultValue: 'N/A' })}` : `${value}m/s`;
}
