/**
 * @file xiyueSecurityIpc.ts
 * @description 信任等级读写 + 工具审计日志只读 IPC（M-A1）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { app, ipcMain } from 'electron';
import { invalidateIdentityCache } from './xiyueIdentity';

const PERSONA_JSON = join(app.getAppPath(), 'agent', 'persona', 'xiyue.json');

function readPersonaJson(): Record<string, unknown> {
  if (!existsSync(PERSONA_JSON)) return {};
  try {
    const data = JSON.parse(readFileSync(PERSONA_JSON, 'utf-8'));
    return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writePersonaJson(data: Record<string, unknown>): void {
  writeFileSync(PERSONA_JSON, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
}

function readTrustLevel(): number {
  const data = readPersonaJson();
  const security = data.security as Record<string, unknown> | undefined;
  const raw = security?.trust_level;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.max(0, Math.min(3, Math.floor(n)));
}

function writeTrustLevel(level: number): number {
  const clamped = Math.max(0, Math.min(3, Math.floor(level)));
  const data = readPersonaJson();
  const security = (data.security ?? {}) as Record<string, unknown>;
  security.trust_level = clamped;
  data.security = security;
  writePersonaJson(data);
  invalidateIdentityCache();
  return clamped;
}

function auditLogPath(): string {
  const dir = join(app.getPath('userData'), 'logs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'xiyue-tools.log');
}

function readAuditTail(limit: number): unknown[] {
  const path = auditLogPath();
  if (!existsSync(path)) return [];
  try {
    const text = readFileSync(path, 'utf-8');
    const lines = text.split('\n').filter((l) => l.trim());
    const tail = lines.slice(Math.max(0, lines.length - limit));
    return tail.map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    }).reverse();
  } catch {
    return [];
  }
}

export function registerXiyueSecurityIpcHandlers(): void {
  ipcMain.handle('xiyue:trust-level:get', () => readTrustLevel());

  ipcMain.handle('xiyue:trust-level:set', (_e, level: number) => writeTrustLevel(level));

  ipcMain.handle('xiyue:audit-log:list', (_e, limit = 30) => {
    const n = Math.max(1, Math.min(200, Number(limit) || 30));
    return readAuditTail(n);
  });

  ipcMain.handle('xiyue:memory-list', async () => {
    try {
      const { getXiyueAgentPort } = await import('../../services/xiyueAgentService');
      const port = getXiyueAgentPort();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`http://127.0.0.1:${port}/memory/list`, { signal: controller.signal as any });
      clearTimeout(timeout);
      if (!res.ok) return { items: [] };
      return await res.json();
    } catch {
      return { items: [], error: 'agent offline' };
    }
  });

  ipcMain.handle('xiyue:emotion-get', async () => {
    try {
      const { getXiyueAgentPort } = await import('../../services/xiyueAgentService');
      const port = getXiyueAgentPort();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`http://127.0.0.1:${port}/emotion`, { signal: controller.signal as any });
      clearTimeout(timeout);
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  });
}
