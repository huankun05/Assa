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
 * @file xiyueToolSchema.test.ts
 * @description 汐月终审闸门 + 单一执行入口 + 审计的单元测试（P0a-2a）。
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { appendFileSyncMock, existsSyncMock, mkdirSyncMock } = vi.hoisted(() => ({
  appendFileSyncMock: vi.fn(),
  existsSyncMock: vi.fn(() => true),
  mkdirSyncMock: vi.fn(),
}));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => 'C:\\fake-user-data') },
}));

vi.mock('fs', () => ({
  appendFileSync: appendFileSyncMock,
  existsSync: existsSyncMock,
  mkdirSync: mkdirSyncMock,
}));

import {
  listXiyueTools,
  normalizeXiyueToolRequest,
  xiyueExecuteTool,
  xiyueFinalCheck,
} from '../xiyueToolSchema';

/** 取最近一条审计 JSON */
function lastAudit(): Record<string, unknown> {
  const calls = appendFileSyncMock.mock.calls;
  expect(calls.length).toBeGreaterThan(0);
  const line = String(calls[calls.length - 1][1]);
  return JSON.parse(line.trim()) as Record<string, unknown>;
}

describe('xiyueFinalCheck', () => {
  it('rejects empty and unregistered tools', () => {
    expect(xiyueFinalCheck({ tool: '' }).allowed).toBe(false);
    expect(xiyueFinalCheck({ tool: 'no.such.tool' })).toMatchObject({ allowed: false, denyReason: '未注册工具：no.such.tool' });
  });

  it('allows read-only tools without confirmation or workspace', () => {
    expect(xiyueFinalCheck({ tool: 'file.read' })).toEqual({ allowed: true });
    expect(xiyueFinalCheck({ tool: 'sys.info' })).toEqual({ allowed: true });
  });

  it('requires workspace for write-class tools when empty', () => {
    expect(xiyueFinalCheck({ tool: 'file.write', workspaces: [] }).allowed).toBe(false);
    expect(xiyueFinalCheck({ tool: 'file.write', workspaces: ['D:\\ws'] }).allowed).toBe(true);
  });

  it('enforces deny/ask minimal set: confirm tools need userConfirmed', () => {
    const noConfirm = xiyueFinalCheck({ tool: 'file.delete', workspaces: ['D:\\ws'] });
    expect(noConfirm.allowed).toBe(false);
    expect(noConfirm.requiresConfirmation).toBe(true);

    expect(xiyueFinalCheck({ tool: 'file.delete', workspaces: ['D:\\ws'], userConfirmed: true })).toEqual({ allowed: true });
    expect(xiyueFinalCheck({ tool: 'cmd.exec', workspaces: ['D:\\ws'] }).requiresConfirmation).toBe(true);
    expect(xiyueFinalCheck({ tool: 'cmd.exec', workspaces: ['D:\\ws'], userConfirmed: true }).allowed).toBe(true);
  });

  it('workspace check runs before confirmation check', () => {
    const r = xiyueFinalCheck({ tool: 'file.delete', workspaces: [], userConfirmed: true });
    expect(r.allowed).toBe(false);
    expect(r.requiresConfirmation).toBeUndefined();
  });

  it('every confirm:true tool in the allowlist is gated', () => {
    for (const meta of listXiyueTools()) {
      if (!meta.confirm) continue;
      const r = xiyueFinalCheck({ tool: meta.id, workspaces: ['D:\\ws'] });
      expect(r.requiresConfirmation, meta.id).toBe(true);
    }
  });
});

describe('normalizeXiyueToolRequest', () => {
  it('lower-cases tool, objectifies args, stringifies workspaces, coerces userConfirmed', () => {
    expect(normalizeXiyueToolRequest({ tool: '  File.Read ', arguments: [1], workspaces: [1, ' a ', ''], userConfirmed: 'yes' })).toEqual({
      tool: 'file.read',
      arguments: {},
      workspaces: ['1', 'a'],
      userConfirmed: false,
    });
    expect(normalizeXiyueToolRequest({ tool: 'x', userConfirmed: true }).userConfirmed).toBe(true);
  });
});

describe('xiyueExecuteTool', () => {
  beforeEach(() => {
    appendFileSyncMock.mockReset();
  });

  it('audits denial without calling impl', async () => {
    const impl = vi.fn();
    const r = await xiyueExecuteTool({ tool: 'nope' }, impl, { source: 'test' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('未注册工具');
    expect(impl).not.toHaveBeenCalled();
    expect(lastAudit()).toMatchObject({ tool: 'nope', gate: 'deny', success: false, source: 'test' });
  });

  it('audits success path (the gap that only-denial logging missed)', async () => {
    const impl = vi.fn().mockResolvedValue({ success: true, result: { ok: 1 }, error: '', durationMs: 3 });
    const r = await xiyueExecuteTool({ tool: 'SYS.info', arguments: { a: 1 } }, impl, { source: 'renderer-ipc' });
    expect(r).toEqual({ success: true, result: { ok: 1 }, error: '', durationMs: 3 });
    expect(impl).toHaveBeenCalledWith(expect.objectContaining({ tool: 'sys.info', arguments: { a: 1 }, workspaces: [] }));
    expect(lastAudit()).toMatchObject({ tool: 'sys.info', gate: 'allow', success: true, result: { ok: 1 }, source: 'renderer-ipc' });
  });

  it('audits impl failure and converts thrown errors into a result', async () => {
    const impl = vi.fn().mockRejectedValue(new Error('boom'));
    const r = await xiyueExecuteTool({ tool: 'sys.info' }, impl);
    expect(r).toMatchObject({ success: false, error: 'boom' });
    expect(lastAudit()).toMatchObject({ tool: 'sys.info', gate: 'allow', success: false, error: 'boom' });
  });

  it('denies confirm tools from callers that cannot confirm (main-process orchestrators)', async () => {
    const impl = vi.fn();
    const r = await xiyueExecuteTool({ tool: 'cmd.exec', arguments: { command: 'dir' }, workspaces: ['D:\\ws'] }, impl, { source: 'ollama-orchestrator' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('需要用户确认');
    expect(impl).not.toHaveBeenCalled();
    expect(lastAudit()).toMatchObject({ gate: 'deny', userConfirmed: false });
  });

  it('runs confirm tools once userConfirmed is present and records it in audit', async () => {
    const impl = vi.fn().mockResolvedValue({ success: true, result: {}, error: '', durationMs: 1 });
    const r = await xiyueExecuteTool({ tool: 'cmd.exec', arguments: { command: 'dir' }, workspaces: ['D:\\ws'], userConfirmed: true }, impl);
    expect(r.success).toBe(true);
    expect(lastAudit()).toMatchObject({ gate: 'allow', userConfirmed: true });
  });

  it('truncates oversized strings in audit lines', async () => {
    const big = 'x'.repeat(5000);
    const impl = vi.fn().mockResolvedValue({ success: true, result: { content: big }, error: '', durationMs: 1 });
    await xiyueExecuteTool({ tool: 'file.read', arguments: { path: big } }, impl);
    const audit = lastAudit();
    const args = audit.arguments as { path: string };
    const result = audit.result as { content: string };
    expect(args.path.length).toBeLessThan(1100);
    expect(args.path).toContain('…[+4000]');
    expect(result.content).toContain('…[+4000]');
  });

  it('never throws when audit write fails', async () => {
    appendFileSyncMock.mockImplementationOnce(() => { throw new Error('disk full'); });
    const impl = vi.fn().mockResolvedValue({ success: true, result: {}, error: '', durationMs: 1 });
    await expect(xiyueExecuteTool({ tool: 'sys.info' }, impl)).resolves.toMatchObject({ success: true });
  });
});
