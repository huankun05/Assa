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
 *   终审与审计不在此处：统一由 services/xiyueToolSchema.xiyueExecuteTool 收口，
 *   本 handler 只做透传与"抛异常 → 失败结果"的兜底转换。
 * @author 鸡哥
 */

import { ipcMain } from 'electron';
import type { AgentLocalToolRequest } from '../../types/agent/AgentLocalToolRequest';
import type { AgentLocalToolResult } from '../../types/agent/AgentLocalToolResult';

// 多个同级模块（index / ollamaIpc / 两个编排器）从这里取类型，保留再导出
export type { AgentLocalToolRequest } from '../../types/agent/AgentLocalToolRequest';
export type { AgentLocalToolResult } from '../../types/agent/AgentLocalToolResult';

interface RegisterAgentLocalToolIpcHandlersOptions {
  executeAgentLocalTool: (request: AgentLocalToolRequest) => Promise<AgentLocalToolResult>;
}

/** 注册 Agent 本地工具执行的 IPC handler（agent:local-tool:execute）。 */
export function registerAgentLocalToolIpcHandlers(options: RegisterAgentLocalToolIpcHandlersOptions): void {
  ipcMain.handle('agent:local-tool:execute', async (_event, request: AgentLocalToolRequest) => {
    const startedAt = Date.now();
    try {
      return await options.executeAgentLocalTool(request);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err ?? 'local tool execute failed');
      const failure: AgentLocalToolResult = {
        success: false,
        result: {},
        error: message,
        durationMs: Date.now() - startedAt,
      };
      return failure;
    }
  });
}
