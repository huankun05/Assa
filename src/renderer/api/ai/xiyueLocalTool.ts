/*
 * eIsland - A sleek, Apple Dynamic Island inspired floating widget for Windows, built with Electron.
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
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
 * @file xiyueLocalTool.ts
 * @description 汐月本地工具结果回传
 * @description 渲染层执行完本地工具（window.api.executeAgentLocalTool）后，
 *   把结果经 window.api.xiyueToolResult 回传给侧车（替代原 mihtnelis 平台回传）。
 */

export interface XiyueToolResultPayload {
  requestId: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

/** 回传本地工具执行结果给汐月侧车 */
export async function resolveXiyueLocalToolResult(payload: XiyueToolResultPayload): Promise<void> {
  await window.api.xiyueToolResult(payload.requestId, {
    success: payload.success,
    result: payload.result ?? {},
    error: payload.error ?? '',
  });
}

/** 用户拒绝/中止工具授权：回传错误结果，让侧车 LLM 得知并继续 */
export async function rejectXiyueLocalTool(requestId: string, reason = '用户拒绝执行工具'): Promise<void> {
  await resolveXiyueLocalToolResult({ requestId, success: false, result: {}, error: reason });
}
