/**
 * @file assaSecurityIpc.ts
 * @description 信任等级读写 + 工具审计日志只读 IPC（M-A1）。
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { app, ipcMain } from 'electron';
import { invalidateIdentityCache } from './assaIdentity';

/** persona 配置路径：延迟求值，避免在 import 阶段就调用 app.getAppPath()
 * （否则任何未完整 mock electron 的单元测试在加载本模块时直接崩溃，如 appHelpers.test.ts）。 */
let _personaJsonPath: string | null = null;
function getPersonaJsonPath(): string {
  if (_personaJsonPath === null) {
    _personaJsonPath = join(app.getAppPath(), 'agent', 'persona', 'assa.json');
  }
  return _personaJsonPath;
}

function readPersonaJson(): Record<string, unknown> {
  const PERSONA_JSON = getPersonaJsonPath();
  if (!existsSync(PERSONA_JSON)) return {};
  try {
    const data = JSON.parse(readFileSync(PERSONA_JSON, 'utf-8'));
    return typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writePersonaJson(data: Record<string, unknown>): void {
  const PERSONA_JSON = getPersonaJsonPath();
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

function readVisibleName(): string {
  const data = readPersonaJson();
  const raw = data.visible_name;
  if (typeof raw === 'string' && raw.trim()) return raw.trim();
  const name = data.name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  return '汐月';
}

function writeVisibleName(name: string): string {
  const trimmed = String(name ?? '').trim();
  const finalName = trimmed || '汐月';
  const data = readPersonaJson();
  data.visible_name = finalName;
  writePersonaJson(data);
  invalidateIdentityCache();
  return finalName;
}

function auditLogPath(): string {
  const dir = join(app.getPath('userData'), 'logs');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'assa-tools.log');
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

/** 会话通行证：本会话内对「仅缺 userConfirmed 的中低风险」自动放行 */
let sessionPassEnabled = false;

export function isAssaSessionPassEnabled(): boolean {
  return sessionPassEnabled;
}

export function registerAssaSecurityIpcHandlers(): void {
  ipcMain.handle('assa:trust-level:get', () => readTrustLevel());

  ipcMain.handle('assa:trust-level:set', (_e, level: number) => writeTrustLevel(level));

  ipcMain.handle('assa:visible-name:get', () => readVisibleName());

  ipcMain.handle('assa:visible-name:set', (_e, name: string) => writeVisibleName(name));

  ipcMain.handle('assa:audit-log:list', (_e, limit = 30) => {
    const n = Math.max(1, Math.min(200, Number(limit) || 30));
    return readAuditTail(n);
  });

  ipcMain.handle('assa:memory-list', async () => {
    try {
      const { getAssaAgentPort } = await import('../../services/assaAgentService');
      const port = getAssaAgentPort();
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

  ipcMain.handle('assa:emotion-get', async () => {
    try {
      const { getAssaAgentPort } = await import('../../services/assaAgentService');
      const port = getAssaAgentPort();
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

  async function agentPost(path: string, body: unknown): Promise<unknown> {
    try {
      const { getAssaAgentPort } = await import('../../services/assaAgentService');
      const port = getAssaAgentPort();
      const res = await fetch(`http://127.0.0.1:${port}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      return await res.json();
    } catch {
      return { ok: false, error: 'agent offline' };
    }
  }

  ipcMain.handle('assa:memory-delete', (_e, id: number) => agentPost('/memory/delete', { id }));

  ipcMain.handle('assa:memory-clear', () => agentPost('/memory/clear', {}));

  ipcMain.handle('assa:browser-enabled:get', () => {
    const data = readPersonaJson();
    const browser = data.browser as Record<string, unknown> | undefined;
    return Boolean(browser?.enabled);
  });

  ipcMain.handle('assa:browser-enabled:set', (_e, enabled: boolean) => {
    const data = readPersonaJson();
    const browser = (data.browser ?? {}) as Record<string, unknown>;
    browser.enabled = Boolean(enabled);
    data.browser = browser;
    writePersonaJson(data);
    invalidateIdentityCache();
    return Boolean(enabled);
  });

  ipcMain.handle('assa:session-pass:get', () => sessionPassEnabled);
  ipcMain.handle('assa:session-pass:set', (_e, enabled: boolean) => {
    sessionPassEnabled = Boolean(enabled);
    return sessionPassEnabled;
  });
}
