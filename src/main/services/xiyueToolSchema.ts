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
 * @description 汐月工具终审闸门（双闸门之二，Electron 主进程为最终权威）。
 *
 * 职责：
 * - 维护汐月工具白名单 + 风险等级（与 agent/server.py TOOL_DEFS / _TOOL_POLICY 手动对齐）
 * - 终审 `xiyueFinalCheck`：拒绝未注册工具；写/删/命令/网络类工具在空工作区时拒绝；
 *   `confirm: true` 的工具必须携带 `userConfirmed: true`（deny/ask 最小集，人在环）
 * - 单一执行入口 `xiyueExecuteTool`：规范化 → 终审 → 执行 → 无论成败都写审计。
 *   所有工具执行路径（渲染层 IPC、主进程 Ollama/自定义编排器）都必须经过它。
 * - 审计日志：append-only 写入 userData/logs/xiyue-tools.log，一行一条 JSON
 */

import { app } from 'electron';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

/** 汐月工具风险分类（与 agent/server.py _TOOL_POLICY 对齐） */
export type XiyueToolRisk = 'read' | 'write' | 'delete' | 'cmd' | 'clipboard' | 'sys' | 'monitor' | 'network';

export interface XiyueToolMeta {
  id: string;
  risks: XiyueToolRisk[];
  /** 需要用户逐次确认；终审要求请求携带 userConfirmed: true */
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

/** 只读快照，供 schema 导出 / 一致性校验使用 */
export function listXiyueTools(): readonly XiyueToolMeta[] {
  return XIYUE_TOOL_ALLOWLIST;
}

export interface XiyueFinalCheckResult {
  allowed: boolean;
  denyReason?: string;
  /** 被拒原因是缺少用户确认（调用方可据此弹确认 UI 后重试） */
  requiresConfirmation?: boolean;
}

/** 终审入参（已规范化） */
export interface XiyueFinalCheckRequest {
  tool: string;
  arguments?: Record<string, unknown>;
  workspaces?: string[];
  userConfirmed?: boolean;
}

/** 执行入口收到的原始请求（字段来自渲染层/编排器，均按 unknown 处理） */
export interface XiyueToolExecuteRequest {
  tool?: unknown;
  arguments?: unknown;
  workspaces?: unknown;
  userConfirmed?: unknown;
}

export interface XiyueToolExecuteResult {
  success: boolean;
  result: unknown;
  error: string;
  durationMs: number;
}

export interface XiyueToolAuditRecord {
  tool: string;
  arguments: Record<string, unknown>;
  workspaces: string[];
  success: boolean;
  result?: unknown;
  error?: string;
  durationMs: number;
  /** 请求是否声明已获用户确认 */
  userConfirmed?: boolean;
  /** 终审结论：deny = 未进入执行 */
  gate?: 'allow' | 'deny';
  /** 调用来源（renderer-ipc / ollama-orchestrator / custom-direct 等） */
  source?: string;
}

/** 规范化原始请求：工具名小写去空白，参数对象化，工作区字符串化 */
export function normalizeXiyueToolRequest(request: XiyueToolExecuteRequest): XiyueFinalCheckRequest & {
  arguments: Record<string, unknown>;
  workspaces: string[];
  userConfirmed: boolean;
} {
  const tool = typeof request?.tool === 'string' ? request.tool.trim().toLowerCase() : '';
  const args = typeof request?.arguments === 'object' && request?.arguments !== null && !Array.isArray(request.arguments)
    ? (request.arguments as Record<string, unknown>)
    : {};
  const workspaces = Array.isArray(request?.workspaces)
    ? request.workspaces.map((w) => String(w).trim()).filter(Boolean)
    : [];
  return { tool, arguments: args, workspaces, userConfirmed: request?.userConfirmed === true };
}

/** 终审闸门：拒绝未注册工具；空工作区时拒绝高风险工具；confirm 工具必须携带用户确认 */
export function xiyueFinalCheck(request: XiyueFinalCheckRequest): XiyueFinalCheckResult {
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

  if (meta.confirm && request.userConfirmed !== true) {
    return {
      allowed: false,
      requiresConfirmation: true,
      denyReason: `${tool} 需要用户确认后才能执行（请求未携带 userConfirmed）`,
    };
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

const AUDIT_STRING_LIMIT = 1000;

/** 审计序列化：超长字符串截断，避免 file.read/file.write 把整份文件写进日志 */
function auditReplacer(_key: string, value: unknown): unknown {
  if (typeof value === 'string' && value.length > AUDIT_STRING_LIMIT) {
    return `${value.slice(0, AUDIT_STRING_LIMIT)}…[+${value.length - AUDIT_STRING_LIMIT}]`;
  }
  return value;
}

/** 审计日志：append-only，结构化一行 JSON */
export function xiyueAuditLog(record: XiyueToolAuditRecord): void {
  try {
    const line = JSON.stringify({
      t: new Date().toISOString(),
      tool: record.tool,
      source: record.source,
      gate: record.gate ?? (record.success ? 'allow' : undefined),
      userConfirmed: record.userConfirmed,
      arguments: record.arguments,
      workspaces: record.workspaces,
      success: record.success,
      result: record.result,
      error: record.error,
      durationMs: record.durationMs,
    }, auditReplacer) + '\n';
    appendFileSync(ensureAuditLogPath(), line, 'utf-8');
  } catch {
    // 审计日志写入失败不应阻断工具执行
  }
}

export interface XiyueExecuteToolOptions {
  /** 调用来源标识，写入审计 */
  source?: string;
}

/**
 * 单一执行入口：规范化 → 终审 → 执行 → 审计（成功/失败/拒绝三种结果都记录）。
 *
 * @param request 原始请求
 * @param impl    真正的工具实现（app.ts executeAgentLocalToolImpl），只负责"怎么做"，不负责"能不能做"
 */
export async function xiyueExecuteTool(
  request: XiyueToolExecuteRequest,
  impl: (request: XiyueToolExecuteRequest) => Promise<XiyueToolExecuteResult>,
  options: XiyueExecuteToolOptions = {},
): Promise<XiyueToolExecuteResult> {
  const startedAt = Date.now();
  const normalized = normalizeXiyueToolRequest(request);
  const base = {
    tool: normalized.tool,
    arguments: normalized.arguments,
    workspaces: normalized.workspaces,
    userConfirmed: normalized.userConfirmed,
    source: options.source,
  };

  const finalCheck = xiyueFinalCheck(normalized);
  if (!finalCheck.allowed) {
    const denial: XiyueToolExecuteResult = {
      success: false,
      result: {},
      error: `汐月终审拒绝：${finalCheck.denyReason}`,
      durationMs: Date.now() - startedAt,
    };
    xiyueAuditLog({ ...base, gate: 'deny', success: false, error: denial.error, durationMs: denial.durationMs });
    return denial;
  }

  let result: XiyueToolExecuteResult;
  try {
    result = await impl({ ...request, tool: normalized.tool, arguments: normalized.arguments, workspaces: normalized.workspaces });
  } catch (err) {
    result = {
      success: false,
      result: {},
      error: err instanceof Error ? err.message : String(err ?? 'local tool execute failed'),
      durationMs: Date.now() - startedAt,
    };
  }

  xiyueAuditLog({
    ...base,
    gate: 'allow',
    success: result.success,
    result: result.result,
    error: result.error,
    durationMs: result.durationMs,
  });
  return result;
}
