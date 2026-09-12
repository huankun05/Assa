/**
 * @file xiyueLocalAgent.ts
 * @description 汐月 Hermes 本地 Agent 流封装
 * @description 经主进程 SSE 桥消费侧车 /chat/stream，把事件翻译成原生
 *   MihtnelisAgentStreamEvent，并自动播放 TTS（final 事件携带 audio_b64）。
 *   支持语音打断：abort / 新语音输入时 stopXiyueTtsPlayback()。
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

/** 当前 TTS 播放句柄（barge-in 用） */
let currentTtsAudio: HTMLAudioElement | null = null;

/**
 * 停止正在播放的 TTS（语音打断 / 新会话前调用）
 */
export function stopXiyueTtsPlayback(): void {
  if (currentTtsAudio) {
    try {
      currentTtsAudio.pause();
      currentTtsAudio.currentTime = 0;
    } catch {
      // ignore
    }
    currentTtsAudio = null;
  }
}

function playTtsBase64(b64: string): void {
  stopXiyueTtsPlayback();
  try {
    const audio = new Audio(`data:audio/wav;base64,${b64}`);
    currentTtsAudio = audio;
    audio.onended = (): void => {
      if (currentTtsAudio === audio) currentTtsAudio = null;
    };
    audio.play().catch(() => {
      if (currentTtsAudio === audio) currentTtsAudio = null;
    });
  } catch {
    // ignore
  }
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

  /** 用户打断：停 TTS + 通知侧车 abort */
  const onAbort = (): void => {
    stopXiyueTtsPlayback();
    window.api.xiyueStreamAbort(sessionId).catch(() => {});
  };
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const handler = (raw: unknown): void => {
      if (signal?.aborted) return;
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
          if (str(payload.audio_b64) && !signal?.aborted) {
            playTtsBase64(str(payload.audio_b64));
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
