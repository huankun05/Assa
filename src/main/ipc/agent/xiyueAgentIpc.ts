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
 * @file xiyueAgentIpc.ts
 * @description 汐月 Hermes 侧车 IPC 桥
 * @description 把渲染进程的 health/chat/voice 请求转发到 Python 侧车
 *   （HTTP 127.0.0.1:8765，见 agent/server.py）。
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import { getXiyueAgentPort } from '../../services/xiyueAgentService';
import { invalidateIdentityCache } from './xiyueIdentity';

interface XiyueHealthResult {
  ok: boolean;
  model?: string;
  error?: string;
}

interface XiyueChatResult {
  user: string;
  reply: string;
  audio?: string;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`http://127.0.0.1:${getXiyueAgentPort()}${path}`, init);
  if (!res.ok) {
    throw new Error(`xiyue-agent ${path} HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

/** 流式会话 → 中止控制器（退出时清理） */
const streamControllers = new Map<string, AbortController>();

export function registerXiyueAgentIpcHandlers(): void {
  ipcMain.handle('xiyue:health', async (): Promise<XiyueHealthResult> => {
    try {
      return await fetchJson<XiyueHealthResult>('/health');
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  });

  ipcMain.handle('xiyue:chat', async (_e, text: unknown): Promise<XiyueChatResult> => {
    return fetchJson<XiyueChatResult>('/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: String(text ?? '') }),
    });
  });

  ipcMain.handle('xiyue:voice', async (): Promise<XiyueChatResult> => {
    return fetchJson<XiyueChatResult>('/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
  });

  /** 本地转写：接收渲染层录音（16k mono wav base64）→ faster-whisper → 文本 */
  ipcMain.handle('xiyue:transcribe', async (_e, audioB64: unknown): Promise<{ text: string }> => {
    return fetchJson<{ text: string }>('/transcribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_b64: String(audioB64 ?? '') }),
    });
  });

  /** 启动工具化流式对话（SSE → 逐事件转发给渲染层） */
  ipcMain.handle('xiyue:stream:start', async (event: IpcMainInvokeEvent, sessionId: unknown, text: unknown): Promise<{ ok: boolean; error?: string }> => {
    const sid = String(sessionId ?? '');
    const msg = String(text ?? '');
    if (!sid || !msg) return { ok: false, error: 'bad args' };

    const controller = new AbortController();
    streamControllers.set(sid, controller);
    const channel = `xiyue:stream:event:${sid}`;
    const send = (evt: unknown): void => {
      if (!event.sender.isDestroyed()) event.sender.send(channel, evt);
    };

    try {
      const res = await fetch(`http://127.0.0.1:${getXiyueAgentPort()}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`xiyue-agent /chat/stream HTTP ${res.status}`);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const readWithTimeout = () => new Promise<{ done: boolean; value: Uint8Array }>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('SSE read timeout')), 5 * 60_000);
        reader.read().then(({ done, value }) => {
          clearTimeout(timer);
          resolve({ done: Boolean(done), value: value ?? new Uint8Array() });
        }, (err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
      try {
        for (;;) {
          const { done, value } = await readWithTimeout();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx = buffer.indexOf('\n\n');
          while (idx >= 0) {
            const raw = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            for (const line of raw.split('\n')) {
              if (!line.startsWith('data: ')) continue;
              try {
                send(JSON.parse(line.slice(6)));
              } catch {
                // 忽略坏帧
              }
            }
            idx = buffer.indexOf('\n\n');
          }
        }
      } catch (err) {
        if (controller.signal.aborted) return { ok: false, aborted: true } as { ok: boolean };
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
      }
      return { ok: true };
    } catch (err) {
      if (controller.signal.aborted) return { ok: false, aborted: true } as { ok: boolean };
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    } finally {
      streamControllers.delete(sid);
    }
  });

  /** 中止流式会话 */
  ipcMain.handle('xiyue:stream:abort', (_e, sessionId: unknown): { ok: boolean } => {
    const sid = String(sessionId ?? '');
    streamControllers.get(sid)?.abort();
    streamControllers.delete(sid);
    return { ok: true };
  });

  /** 回传本地工具执行结果给侧车 */
  ipcMain.handle('xiyue:tool-result', async (_e, requestId: unknown, result: unknown): Promise<{ ok: boolean }> => {
    const payload = (typeof result === 'object' && result !== null ? result : {}) as Record<string, unknown>;
    return fetchJson<{ ok: boolean }>('/tool-result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId: String(requestId ?? ''),
        success: payload.success !== false,
        result: payload.result ?? {},
        error: payload.error ?? '',
      }),
    });
  });
}
