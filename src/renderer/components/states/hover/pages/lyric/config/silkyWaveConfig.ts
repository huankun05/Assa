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
 * @file silkyWaveConfig.ts
 * @description SilkyWave 波浪层常量配置
 * @author 鸡哥
 */

import type { WaveLayer } from '../types/silkyWaveTypes';

/** 多层正弦波配置参数
 *  amplitude 为相对 60px 基准面板高度的像素振幅，绘制时按容器实际高度线性缩放，
 *  使波在任意高度的音乐窗背后都呈现「从底部涌起的音波起伏」。
 *  opacity 为各层半透明度（叠加后形成有体积感的背景波，不喧宾夺主）。 */
export const WAVE_LAYERS: WaveLayer[] = [
  { amplitude: 18, frequency: 0.018, speed: 0.025, phase: 0, opacity: 0.25 },
  { amplitude: 13, frequency: 0.024, speed: -0.018, phase: 2, opacity: 0.18 },
  { amplitude: 8, frequency: 0.032, speed: 0.032, phase: 4, opacity: 0.12 },
];
