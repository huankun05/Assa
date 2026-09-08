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
 * @file localToolIpc.ts
 * @description Agent 本地工具 IPC handler 注册，将渲染进程的本地工具执行请求桥接到主进程。
 * @author 鸡哥
 */

import { ipcMain } from 'electron';
import type { AgentLocalToolRequest, AgentLocalToolResult } from './types/AgentLocalToolRequest';
import { xiyueAuditLog, xiyueFinalCheck } from '../../services/xiyueToolSchema';

export type { AgentLocalToolRequest, AgentLocalToolResult } from './types/AgentLocalToolRequest';

interface RegisterAgentLocalToolIpcHandlersOptions {
  executeAgentLocalTool: (request: AgentLocalToolRequest) => Promise<AgentLocalToolResult>;
}

/** 注册 Agent 本地工具执行的 IPC handler（agent:local-tool:execute）。 */
export function registerAgentLocalToolIpcHandlers(options: RegisterAgentLocalToolIpcHandlersOptions): void {
  ipcMain.handle('agent:local-tool:execute', async (_event, request: AgentLocalToolRequest) => {
    const startedAt = Date.now();
    const tool = typeof request?.tool === 'string' ? request.tool.trim().toLowerCase() : '';
    const args = typeof request?.arguments === 'object' && request?.arguments !== null
      ? (request.arguments as Record<string, unknown>) : {};
    const workspaces = Array.isArray(request?.workspaces) ? request.workspaces.map(String) : [];

    const finalCheck = xiyueFinalCheck({ tool, arguments: args, workspaces });
    if (!finalCheck.allowed) {
      const denial: AgentLocalToolResult = {
        success: false,
        result: {},
        error: `汐月终审拒绝：${finalCheck.denyReason}`,
        durationMs: Date.now() - startedAt,
      };
      xiyueAuditLog({
        tool,
        arguments: args,
        workspaces,
        success: false,
        error: denial.error,
        durationMs: denial.durationMs,
      });
      return denial;
    }

    let result: AgentLocalToolResult;
    try {
      result = await options.executeAgentLocalTool(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err ?? 'local tool execute failed');
      result = {
        success: false,
        result: {},
        error: message,
        durationMs: Date.now() - startedAt,
      };
    }

    xiyueAuditLog({
      tool,
      arguments: args,
      workspaces,
      success: result.success,
      result: result.result,
      error: result.error,
      durationMs: result.durationMs,
    });
    return result;
  });
}
