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
 * @file useAgentAuthDecision.ts
 * @description Agent 授权决策处理 Hook。
 * @author 鸡哥
 */

import { useCallback } from 'react';
import { resolveMihtnelisWebAccess } from '../../../../api/ai/mihtnelisAgentStream';
import { resolveassaLocalToolResult, rejectassaLocalTool } from '../../../../api/ai/assaLocalTool';
import type { AuthPending } from '../types/AuthPending';

interface UseAgentAuthDecisionOptions {
  authPending: AuthPending | null;
  setAuthPending: React.Dispatch<React.SetStateAction<AuthPending | null>>;
  tokenRef: React.MutableRefObject<string>;
  workspaces: string[];
}

/**
 * @description 返回处理 Agent 授权通过/拒绝的回调。
 * @param options - Agent 授权决策配置。
 * @returns 授权决策执行函数。
 */
export function useAgentAuthDecision(options: UseAgentAuthDecisionOptions): (allow: boolean) => Promise<void> {
  const {
    authPending,
    setAuthPending,
    tokenRef,
    workspaces,
  } = options;

  return useCallback(async (allow: boolean) => {
    const auth = authPending;
    if (!auth) return;

    setAuthPending(null);

    try {
      if (auth.type === 'web') {
        // 汐月侧车当前不发网页授权事件，此分支保持占位
        await resolveMihtnelisWebAccess({ token: tokenRef.current, requestId: auth.requestId, allow });
      } else if (auth.type === 'tool') {
        if (!allow) {
          await rejectassaLocalTool(auth.requestId, '用户拒绝执行工具');
          return;
        }
        const executor = window.api?.executeAgentLocalTool;
        if (typeof executor !== 'function') {
          await resolveassaLocalToolResult({ requestId: auth.requestId, success: false, result: {}, error: 'LOCAL_RUNTIME_UNAVAILABLE' });
          return;
        }
        let execution: { success?: boolean; result?: unknown; error?: string } = {};
        try {
          // 用户已点击"允许"：主进程终审要求 confirm 工具必须携带 userConfirmed
          execution = await executor({ tool: auth.tool!, arguments: auth.argumentsPayload ?? {}, workspaces, userConfirmed: true });
        } catch (e: unknown) {
          execution = { success: false, result: {}, error: e instanceof Error ? e.message : '本地工具执行失败' };
        }
        await resolveassaLocalToolResult({
          requestId: auth.requestId,
          success: Boolean(execution?.success),
          result: execution?.result,
          error: typeof execution?.error === 'string' ? execution.error : '',
        });
      }
    } catch {
      // ignore resolve errors
    }
  }, [authPending, setAuthPending, tokenRef, workspaces]);
}
