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
 * @file storeKeys.ts
 * @description 主进程与渲染进程共享的持久化存储键常量
 * @author 鸡哥
 */

/** pill 模式灵动岛位置锁定配置键 */
export const ISLAND_POSITION_LOCKED_STORE_KEY = 'island-position-locked';

/** 截图引擎配置键 */
export const SCREENSHOT_ENGINE_STORE_KEY = 'screenshot-engine';

/** OCR 引擎配置键 */
export const SCREENSHOT_OCR_ENGINE_STORE_KEY = 'screenshot-ocr-engine';

/** 截图翻译引擎配置键（'local' 本机 Hy-MT2 / 'server' 服务端） */
export const SCREENSHOT_TRANSLATE_ENGINE_STORE_KEY = 'screenshot-translate-engine';

/** 本地 OCR/翻译服务目录（local_capture_service.py 所在目录，留空用默认值） */
export const SCREENSHOT_LOCAL_OCR_DIR_STORE_KEY = 'screenshot-local-ocr-dir';

/** 云端翻译（百度翻译通用版）appid 与密钥配置键 */
export const SCREENSHOT_CLOUD_TRANSLATE_APPID_STORE_KEY = 'screenshot-cloud-translate-appid';
export const SCREENSHOT_CLOUD_TRANSLATE_SECRET_STORE_KEY = 'screenshot-cloud-translate-secret';

/** 截图引擎类型 */
export type ScreenshotEngine = 'plugin' | 'js';

/** OCR 引擎类型：local=Tesseract.js(秒开) / paddleocr=本机 PaddleOCR(高精度) / server=服务端 */
export type ScreenshotOcrEngine = 'local' | 'paddleocr' | 'server';

/** 截图翻译引擎类型：local=本机 Hy-MT2 / cloud=云端百度翻译(免费额度) / server=服务端 */
export type ScreenshotTranslateEngine = 'local' | 'cloud' | 'server';
