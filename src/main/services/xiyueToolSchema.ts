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
 * @file xiyueToolSchema.ts
 * @description 汐月工具终审闸门（双闸门之二，Rust 为最终权威）。
 *
 * 职责：
 * - 维护汐月工具白名单 + 风险等级（与 server.py TOOL_DEFS / _TOOL_POLICY 对齐）
 * - 终审：拒绝未注册工具；写/删/命令/网络类工具在空工作区时拒绝，只读工具允许空工作区
 * - 审计日志：append-only 写入 userData/logs/xiyue-tools.log
 */

import { app } from 'electron';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/** 汐月工具风险分类（与 agent/server.py _TOOL_POLICY 对齐） */
export type XiyueToolRisk = 'read' | 'write' | 'delete' | 'cmd' | 'clipboard' | 'sys' | 'monitor' | 'network';

export interface XiyueToolMeta {
  id: string;
  risks: XiyueToolRisk[];
  confirm: boolean;
  needsWorkspace: boolean;
  requireWorkspaceWhenEmpty: boolean;
}

/** 汐月工具白名单（与 agent/server.py TOOL_DEFS + _TOOL_POLICY 保持手动同步） */
const XIYUE_TOOL_ALLOWLIST: XiyueToolMeta[] = [
  { id: 'file.read',      risks: ['read'],            confirm: false, needsWorkspace: true,  requireWorkspaceWhenEmpty: false },
  { id: 'file.list',      risks: ['read'],            confirm: false, needsWorkspace: true,  requireWorkspaceWhenEmpty: false },
  { id: 'file.stat',      risks: ['read'],            confirm: false, needsWorkspace: true,  requireWorkspaceWhenEmpty: false },
  { id: 'file.search',    risks: ['read'],            confirm: false, needsWorkspace: true,  requireWorkspaceWhenEmpty: false },
  { id: 'file.grep',      risks: ['read'],            confirm: false, needsWorkspace: true,  requireWorkspaceWhenEmpty: false },
  { id: 'file.write',     risks: ['write'],           confirm: false, needsWorkspace: true,  requireWorkspaceWhenEmpty: true },
  { id: 'file.delete',    risks: ['delete'],          confirm: true,  needsWorkspace: true,  requireWorkspaceWhenEmpty: true },
  { id: 'cmd.exec',       risks: ['cmd', 'network'],  confirm: true,  needsWorkspace: false, requireWorkspaceWhenEmpty: true },
  { id: 'clipboard.read', risks: ['clipboard'],       confirm: false, needsWorkspace: false, requireWorkspaceWhenEmpty: false },
  { id: 'sys.info',       risks: ['sys'],             confirm: false, needsWorkspace: false, requireWorkspaceWhenEmpty: false },
  { id: 'monitor.cpu',    risks: ['monitor'],         confirm: false, needsWorkspace: false, requireWorkspaceWhenEmpty: false },
  { id: 'monitor.memory', risks: ['monitor'],         confirm: false, needsWorkspace: false, requireWorkspaceWhenEmpty: false },
  { id: 'net.ping',       risks: ['network'],         confirm: true,  needsWorkspace: false, requireWorkspaceWhenEmpty: true },
  { id: 'browser.open',    risks: ['network'],         confirm: true,  needsWorkspace: false, requireWorkspaceWhenEmpty: true },
  { id: 'browser.screenshot', risks: ['network'],      confirm: true,  needsWorkspace: false, requireWorkspaceWhenEmpty: true },
  { id: 'browser.navigate', risks: ['network'],        confirm: true,  needsWorkspace: false, requireWorkspaceWhenEmpty: true },
  { id: 'browser.click',   risks: ['network'],         confirm: true,  needsWorkspace: false, requireWorkspaceWhenEmpty: true },
  { id: 'browser.fill',    risks: ['network'],         confirm: true,  needsWorkspace: false, requireWorkspaceWhenEmpty: true },
  { id: 'browser.scroll',  risks: ['network'],         confirm: true,  needsWorkspace: false, requireWorkspaceWhenEmpty: true },
];

const XIYUE_TOOL_INDEX = new Map<string, XiyueToolMeta>();
for (const meta of XIYUE_TOOL_ALLOWLIST) {
  XIYUE_TOOL_INDEX.set(meta.id, meta);
}

export interface XiyueFinalCheckResult {
  allowed: boolean;
  denyReason?: string;
}

export interface XiyueToolAuditRecord {
  tool: string;
  arguments: Record<string, unknown>;
  workspaces: string[];
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
}

/** 终审闸门：拒绝未注册工具；空工作区时拒绝高风险工具 */
export function xiyueFinalCheck(request: { tool: string; arguments?: Record<string, unknown>; workspaces?: string[] }): XiyueFinalCheckResult {
  const tool = typeof request.tool === 'string' ? request.tool.trim() : '';
  if (!tool) {
    return { allowed: false, denyReason: '工具名称不能为空' };
  }

  const meta = XIYUE_TOOL_INDEX.get(tool);
  if (!meta) {
    return { allowed: false, denyReason: `未注册工具：${tool}` };
  }

  const workspaces = Array.isArray(request.workspaces) ? request.workspaces.map((w) => String(w).trim()).filter(Boolean) : [];
  const emptyWorkspaces = workspaces.length === 0;

  if (meta.needsWorkspace && emptyWorkspaces && meta.requireWorkspaceWhenEmpty) {
    return { allowed: false, denyReason: `${tool} 需要配置工作区（当前为空）` };
  }

  return { allowed: true };
}

function ensureAuditLogPath(): string {
  const logDir = join(app.getPath('userData'), 'logs');
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }
  return join(logDir, 'xiyue-tools.log');
}

/** 审计日志：append-only，结构化一行 JSON */
export function xiyueAuditLog(record: XiyueToolAuditRecord): void {
  try {
    const line = JSON.stringify({
      t: new Date().toISOString(),
      tool: record.tool,
      arguments: record.arguments,
      workspaces: record.workspaces,
      success: record.success,
      result: record.result,
      error: record.error,
      durationMs: record.durationMs,
    }) + '\n';
    appendFileSync(ensureAuditLogPath(), line, 'utf-8');
  } catch {
    // 审计日志写入失败不应阻断工具执行
  }
}
