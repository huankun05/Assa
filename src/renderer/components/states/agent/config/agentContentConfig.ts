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
 * @file agentContentConfig.ts
 * @description Agent 内容区状态配置与常量定义。
 * @author 鸡哥
 */

export type AgentPhase = 'connecting' | 'thinking' | 'toolCalling' | 'answering' | 'done' | 'error';

/**
 * 阶段 → 少女素材（DESIGN_SYSTEM §5.5）。
 * 缺文件时组件 onError 回落 happy；素材清单见 docs/design/CHARACTER_ASSET_CHECKLIST.md
 */
export const PHASE_IMAGE: Record<AgentPhase, string> = {
  connecting: 'image/agent/xiyue_calm.png',
  thinking: 'image/agent/xiyue_thinking.png',
  toolCalling: 'image/agent/xiyue_tool.png',
  answering: 'image/agent/xiyue_speaking.png',
  done: 'image/agent/xiyue_happy.png',
  error: 'image/agent/xiyue_confuse.png',
};

export const PHASE_IMAGE_FALLBACK = 'image/agent/xiyue_happy.png';

export const PHASE_LABEL: Record<AgentPhase, string> = {
  connecting: '正在连接…',
  thinking: '正在思考…',
  toolCalling: '正在调用工具…',
  answering: '正在回答…',
  done: '回答完成',
  error: '出错了',
};

export const AGENT_MODE_STORAGE_KEY = 'eIsland_agentMode';
export const VALID_AGENT_MODES = new Set(['mihtnelis', 'r1pxc', 'edoc']);
