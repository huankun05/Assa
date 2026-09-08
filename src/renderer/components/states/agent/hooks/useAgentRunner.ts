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
 * @file useAgentRunner.ts
 * @description Agent 执行流程编排 Hook（汐月 Hermes 专属）
 * @description 原 eIsland 三路由（mihtnelis/Ollama/自定义直连）已移除，
 *   仅保留本地汐月侧车（window.api.xiyueChat）。
 */

import { useEffect } from 'react';
import useIslandStore from '../../../../store/isLandStore';
import { streamXiyueAgent } from '../../../../api/ai/xiyueLocalAgent';
import type { AiChatMessage } from '../../../../store/types';
import type { AgentPhase } from '../config/agentContentConfig';
import type { AuthPending } from '../types/AuthPending';
import { createAgentStreamEventHandler } from '../utils/agentRunnerEventHandler';

interface UseAgentRunnerOptions {
  agentPrompt: string;
  setPhase: React.Dispatch<React.SetStateAction<AgentPhase>>;
  setThinkText: React.Dispatch<React.SetStateAction<string>>;
  setAnswerText: React.Dispatch<React.SetStateAction<string>>;
  setErrorMsg: React.Dispatch<React.SetStateAction<string>>;
  setAuthPending: React.Dispatch<React.SetStateAction<AuthPending | null>>;
  setToolCallInfo: React.Dispatch<React.SetStateAction<{ tool: string; purpose: string } | null>>;
  answerAccRef: React.MutableRefObject<string>;
  thinkAccRef: React.MutableRefObject<string>;
  traceIdRef: React.MutableRefObject<string>;
  tokenRef: React.MutableRefObject<string>;
}

/**
 * @description 执行汐月 Hermes 请求并同步流式事件状态。
 * @param options - Agent 执行流程配置。
 */
export function useAgentRunner(options: UseAgentRunnerOptions): void {
  const {
    agentPrompt,
    setPhase,
    setThinkText,
    setAnswerText,
    setErrorMsg,
    setAuthPending,
    setToolCallInfo,
    answerAccRef,
    thinkAccRef,
    traceIdRef,
  } = options;

  useEffect(() => {
    if (!agentPrompt.trim()) {
      setPhase('error');
      setErrorMsg('没有输入内容');
      return;
    }

    const controller = new AbortController();
    let active = true;

    const run = async (): Promise<void> => {
      setPhase('connecting');
      setThinkText('');
      setAnswerText('');
      setErrorMsg('');
      setAuthPending(null);
      setToolCallInfo(null);
      answerAccRef.current = '';
      thinkAccRef.current = '';
      traceIdRef.current = '';

      const handleEvent = createAgentStreamEventHandler({
        isActive: () => active,
        isOllama: false,
        token: '',
        workspaces: [],
        setPhase,
        setThinkText,
        setAnswerText,
        setErrorMsg,
        setAuthPending,
        setToolCallInfo,
        answerAccRef,
        thinkAccRef,
        traceIdRef,
      });

      try {
        await streamXiyueAgent({
          message: agentPrompt.trim(),
          signal: controller.signal,
          onEvent: handleEvent,
        });

        if (active) {
          setPhase((prev) => (prev === 'error' ? prev : 'done'));
          const finalAnswer = answerAccRef.current.trim();
          if (finalAnswer) {
            const store = useIslandStore.getState();
            const sid = store.activeAiChatSessionId;
            const session = store.aiChatSessions.find((s) => s.id === sid);
            const prev = session?.messages ?? [];
            const userMsg: AiChatMessage = { role: 'user', content: agentPrompt.trim() };
            const assistantMsg: AiChatMessage = {
              role: 'assistant',
              content: finalAnswer,
              model: 'xiyue',
              finalized: true,
              traceId: traceIdRef.current || undefined,
            };
            store.setAiChatSessionMessages(sid, [...prev, userMsg, assistantMsg]);
          }
        }
      } catch (err: unknown) {
        if (!active) return;
        if (controller.signal.aborted) return;
        const msg = err instanceof Error ? err.message : '请求失败';
        setPhase('error');
        setErrorMsg(msg);
      }
    };

    void run();

    return () => {
      active = false;
      controller.abort();
    };
  }, [
    agentPrompt,
    setAnswerText,
    setAuthPending,
    setErrorMsg,
    setPhase,
    setThinkText,
    setToolCallInfo,
    answerAccRef,
    thinkAccRef,
    traceIdRef,
  ]);
}
