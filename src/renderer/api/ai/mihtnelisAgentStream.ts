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
 * @file mihtnelisAgentStream.ts
 * @description 仅保留网页访问授权解析（向账号服务提交用户授权结果）。
 *   原云端流式 / 本地工具结果回传 / 提示词拉取等函数已在本地侧车 Agent 接入后废弃，
 *   本地工具走 window.api.xiyueToolResult / executeAgentLocalTool，不再经由此模块。
 * @author 鸡哥
 */

import { buildReplayHeaders, resolveClientVersion, USER_ACCOUNT_API_BASE } from '../user/userAccountApi.client';
import type { MihtnelisAgentStreamEvent, MihtnelisAgentStreamEventType } from './types/MihtnelisAgentStreamEvent';
import type { ResolveMihtnelisWebAccessRequest } from './types/ResolveMihtnelisWebAccessRequest';

export type {
  MihtnelisAgentStreamEvent,
  MihtnelisAgentStreamEventType,
  ResolveMihtnelisWebAccessRequest,
};

const APP_NAME_HEADER = 'X-App-Name';
const APP_NAME_VALUE = 'eisland';

/**
 * 提交网页访问授权结果到账号服务。
 * @description 由网页授权弹窗（handleResolveWebAccess）调用，侧车当前不主动下发网页授权事件。
 * @param request - 请求参数。
 */
export async function resolveMihtnelisWebAccess(request: ResolveMihtnelisWebAccessRequest): Promise<void> {
  const token = request.token?.trim();
  if (!token) {
    throw new Error('未登录，无法提交网页访问授权');
  }
  const requestId = request.requestId?.trim();
  if (!requestId) {
    throw new Error('requestId 不能为空');
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    [APP_NAME_HEADER]: APP_NAME_VALUE,
    ...buildReplayHeaders(),
  };
  const version = await resolveClientVersion();
  if (version) {
    headers['X-Client-Version'] = version;
  }

  const response = await fetch(`${USER_ACCOUNT_API_BASE}/v1/user/ai/agent/web-access/resolve`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      requestId,
      allow: Boolean(request.allow),
    }),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`网页授权提交失败 (${response.status}): ${body || response.statusText}`);
  }
}
