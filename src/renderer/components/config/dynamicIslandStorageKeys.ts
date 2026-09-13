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
 * @file dynamicIslandStorageKeys.ts
 * @description 灵动岛相关存储键常量定义。
 * @author 鸡哥
 */

export const CLIPBOARD_URL_SUPPRESS_IN_FAVORITES_KEY = 'clipboard-url-suppress-in-url-favorites';
export const AI_CHAT_CLIPBOARD_URL_EVENT = 'eisland:ai-chat-clipboard-urls-detected';
export const ISLAND_BG_MEDIA_STORE_KEY = 'island-bg-media';
export const ISLAND_BG_IMAGE_STORE_KEY = 'island-bg-image';
export const ISLAND_BG_VIDEO_FIT_STORE_KEY = 'island-bg-video-fit';
export const ISLAND_BG_VIDEO_MUTED_STORE_KEY = 'island-bg-video-muted';
export const ISLAND_BG_VIDEO_LOOP_STORE_KEY = 'island-bg-video-loop';
export const ISLAND_BG_VIDEO_VOLUME_STORE_KEY = 'island-bg-video-volume';
export const ISLAND_BG_VIDEO_RATE_STORE_KEY = 'island-bg-video-rate';
export const ISLAND_BG_VIDEO_HW_DECODE_STORE_KEY = 'island-bg-video-hw-decode';
export const LOCAL_ISLAND_BG_SYNC_EVENT = 'island-bg-local-sync';
export const ISLAND_BG_POSITION_X_STORE_KEY = 'island-bg-position-x';
export const ISLAND_BG_POSITION_Y_STORE_KEY = 'island-bg-position-y';

/** 壁纸位置按岛状态拆分：idle / hover / expand / maxExpand */
export type IslandBgPosState = 'idle' | 'hover' | 'expand' | 'maxExpand';

export function getIslandBgPositionKeys(state: IslandBgPosState): { x: string; y: string } {
  return {
    x: `island-bg-position-${state}-x`,
    y: `island-bg-position-${state}-y`,
  };
}

export const UPDATE_SOURCE_STORE_KEY = 'update-source';
export const UPDATE_AUTO_PROMPT_STORE_KEY = 'update-auto-prompt-enabled';
export const WEATHER_ALERT_ENABLED_STORE_KEY = 'weather-alert-enabled';
