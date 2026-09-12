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
 */

/**
 * @file islandDimensions.ts
 * @description 主进程与渲染进程共享的灵动岛基础尺寸。
 * @author 鸡哥
 */

export const ISLAND_WIDTH = 260;
export const ISLAND_HEIGHT = 42;

/**
 * idle 态命中热区宽度（px）
 * @description 居中窄条：两侧不参与 hit-test，避免 always-on-top 整条挡住浏览器标签。
 * 命中热区外点击穿透到下层应用（DESIGN_SYSTEM §4.2 P1）。
 */
export const IDLE_HOTSPOT_WIDTH = 120;