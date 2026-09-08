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
 * @file xiyueLocalAgent.ts
 * @description 汐月 Hermes 本地 Agent 流封装
 * @description 经主进程 SSE 桥消费侧车 /chat/stream，把事件翻译成原生
 *   MihtnelisAgentStreamEvent（think/chunk/tool_call_request/tool_call_result/final/error），
 *   并自动播放 TTS（final 事件携带 audio_b64）。
 */

import type { MihtnelisAgentStreamEvent } from './types';

interface StreamXiyueAgentRequest {
  message: string;
  signal?: AbortSignal;
  onEvent?: (event: MihtnelisAgentStreamEvent) => void;
}

interface StreamEventPayload {
  text?: unknown;
  requestId?: unknown;
  tool?: unknown;
  purpose?: unknown;
  arguments?: unknown;
  authorizationRequired?: unknown;
  reply?: unknown;
  audio_b64?: unknown;
  message?: unknown;
}

function emit(
  onEvent: ((event: MihtnelisAgentStreamEvent) => void) | undefined,
  event: MihtnelisAgentStreamEvent,
): void {
  if (typeof onEvent === 'function') {
    onEvent(event);
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

/**
 * 汐月 Hermes 工具化对话流
 * @param request - 请求（message / signal / onEvent）
 */
export async function streamXiyueAgent(request: StreamXiyueAgentRequest): Promise<void> {
  const { message, signal, onEvent } = request;
  const sessionId = `xiyue-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const onAbort = (): void => {
    window.api.xiyueStreamAbort(sessionId).catch(() => {});
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  let unsubscribed = false;
  const unsubscribe = (): void => {
    if (!unsubscribed) {
      unsubscribed = true;
      window.api.onXiyueStreamEvent(sessionId, () => {}).catch(() => {});
    }
  };

  try {
    const handler = (raw: unknown): void => {
      const payload = (raw as StreamEventPayload | null) ?? {};
      switch ((raw as { type?: string } | null)?.type) {
        case 'think':
          emit(onEvent, { type: 'think', payload: { text: str(payload.text) } });
          break;
        case 'chunk':
          emit(onEvent, { type: 'chunk', payload: { text: str(payload.text) } });
          break;
        case 'tool_call_request':
          emit(onEvent, {
            type: 'tool_call_request',
            payload: {
              requestId: str(payload.requestId),
              tool: str(payload.tool),
              purpose: str(payload.purpose),
              arguments: (payload.arguments as Record<string, unknown>) ?? {},
              authorizationRequired: Boolean(payload.authorizationRequired),
            },
          });
          break;
        case 'tool_call_result':
          emit(onEvent, { type: 'tool_call_result', payload: {} });
          break;
        case 'final':
          if (str(payload.audio_b64)) {
            try {
              const audio = new Audio(`data:audio/wav;base64,${str(payload.audio_b64)}`);
              audio.play().catch(() => {});
            } catch {
              // ignore playback failure
            }
          }
          emit(onEvent, { type: 'final', payload: {} });
          break;
        case 'error':
          emit(onEvent, { type: 'error', payload: { message: str(payload.message) || '汐月返回错误' } });
          break;
        default:
          break;
      }
    };

    const unsubscribe = window.api.onXiyueStreamEvent(sessionId, handler);

    try {
      const res = await window.api.xiyueStreamChatStart(sessionId, message);
      if (!res?.ok) {
        emit(onEvent, { type: 'error', payload: { message: res?.error || '侧车流式会话启动失败' } });
      }
    } finally {
      unsubscribe();
    }
  } finally {
    signal?.removeEventListener('abort', onAbort);
  }
}
