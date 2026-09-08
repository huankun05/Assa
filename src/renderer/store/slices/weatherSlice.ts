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
 * @file weatherSlice.ts
 * @description 天气相关逻辑
 * @author 鸡哥
 */

import type { StateCreator } from 'zustand';
import type { WeatherSlice, WeatherApiConfig } from '../types';
import { fetchWeather } from '../../api/weather/weatherApi';
import { fetchLocation } from '../../api/weather/locationApi';
import {
  loadWeatherFromStorage,
  saveWeatherToStorage,
  loadLocationFromStorage,
  saveLocationToStorage,
  loadWeatherLocationConfig,
} from '../utils/storage';
import { logger } from '../../utils/logger';

export const createWeatherSlice: StateCreator<
  WeatherSlice,
  [],
  [],
  WeatherSlice
> = (set, get) => ({
  weather: loadWeatherFromStorage(),
  location: loadLocationFromStorage(),

  /** 上次成功刷新的时间戳（节流用） */
  lastRefreshAt: 0,

  setWeather: (data) => {
    saveWeatherToStorage(data);
    set({ weather: data });
  },

  /**
   * 拉取天气数据
   * @param config 手动坐标（可选）
   * @param forceRefresh true=强制刷新（跳过 5 分钟节流），false/undefined=节流保护
   */
  fetchWeatherData: async (config?: WeatherApiConfig, forceRefresh?: boolean) => {

    // 节流：非强制刷新时检查 5 分钟间隔
    if (!forceRefresh) {
      const last = get().lastRefreshAt ?? 0;
      const now = Date.now();
      const FIVE_MIN = 5 * 60 * 1000;
      if (last > 0 && (now - last) < FIVE_MIN) {
        logger.info(`[Weather] 节流生效：距上次刷新 ${Math.round((now - last) / 1000)}s，跳过本次（< ${FIVE_MIN / 60000}min）`);
        return;
      }
    } else {
      logger.info('[Weather] 强制刷新，跳过节流');
    }

    try {
      // 读取缓存（强制刷新时跳过）
      if (!forceRefresh) {
        const cachedWeather = loadWeatherFromStorage();
        const cachedLocation = loadLocationFromStorage();
        logger.info('[Weather] 当前缓存 -', cachedLocation
          ? `位置: ${cachedLocation.city} (${cachedLocation.latitude}, ${cachedLocation.longitude})`
          : '位置: 无缓存',
          cachedWeather.description ? `天气: ${cachedWeather.description} ${cachedWeather.temperature}°C` : '天气: 无缓存'
        );
      } else {
        logger.info('[Weather] 强制刷新，跳过缓存加载');
      }

      // 获取位置信息（强制刷新时不回退到缓存）
      let location;
      if (config) {
        logger.info('[Weather] 使用手动配置坐标:', config.latitude, config.longitude);
        location = { latitude: config.latitude, longitude: config.longitude, city: '', regionName: '', country: '' };
      } else {
        const locationConfig = loadWeatherLocationConfig();
        const customLocation = locationConfig.customLocation
          && Number.isFinite(locationConfig.customLocation.latitude)
          && Number.isFinite(locationConfig.customLocation.longitude)
          ? {
            latitude: locationConfig.customLocation.latitude,
            longitude: locationConfig.customLocation.longitude,
            city: locationConfig.customLocation.city || '自定义位置',
            regionName: '',
            country: '',
          }
          : null;

        const resolveByIp = async () => {
          logger.info('[Weather] 正在获取 IP 定位...');
          const ipLocation = await fetchLocation();
          logger.info('[Weather] 定位成功:', ipLocation.city, ipLocation.regionName, `(${ipLocation.latitude}, ${ipLocation.longitude})`);
          return ipLocation;
        };

        const resolveByCustom = () => {
          if (!customLocation) {
            logger.warn('[Weather] 自定义位置未配置或配置无效');
            return null;
          }
          logger.info('[Weather] 使用自定义位置:', customLocation.city, `(${customLocation.latitude}, ${customLocation.longitude})`);
          return customLocation;
        };

        const order = locationConfig.priority === 'custom'
          ? ['custom', 'ip'] as const
          : ['ip', 'custom'] as const;

        location = await order.reduce<Promise<typeof location>>(async (prevPromise, source) => {
          const prev = await prevPromise;
          if (prev) return prev;

          if (source === 'custom') {
            return resolveByCustom();
          }

          try {
            return await resolveByIp();
          } catch (locError) {
            logger.warn('[Weather] IP 定位失败:', locError);
            return null;
          }
        }, Promise.resolve(null));

        if (location) {
          saveLocationToStorage(location);
          set({ location });
          logger.info('[Weather] 位置信息已写入缓存');
        }

        if (!location) {
          if (forceRefresh) {
            logger.warn('[Weather] 强制刷新：定位失败，跳过天气获取');
            return;
          }
          const cachedLocation = loadLocationFromStorage();
          logger.warn('[Weather] 定位失败，回退使用缓存位置');
          location = cachedLocation;
        }
      }

      if (!location) {
        logger.error('[Weather] 无可用位置信息，跳过天气获取');
        return;
      }

      // 获取天气数据
      logger.info('[Weather] 正在获取天气数据...');
      const weather = await fetchWeather({ latitude: location.latitude, longitude: location.longitude });
      logger.info('[Weather] 天气获取成功:', weather.description, weather.temperature + '°C');

      // 写入天气缓存 + 更新 store + 记录刷新时间
      saveWeatherToStorage(weather);
      set({ weather, lastRefreshAt: Date.now() });
      logger.info('[Weather] 天气数据已写入本地缓存');
    } catch (error) {
      logger.error('[Weather] 获取天气数据失败:', error);
    }
  },
});