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
 * - 从 schemas/xiyue_tools.json 同源加载工具元数据（与 agent/server.py 共用）
 * - 终审 `xiyueFinalCheck`：拒绝未注册工具；空工作区时拒绝高风险工具；
 *   `confirm: true` 的工具必须携带 `userConfirmed: true`（deny/ask 最小集，人在环）
 * - 单一执行入口 `xiyueExecuteTool`：规范化 → 终审 → 执行 → 无论成败都写审计
 * - 审计日志：append-only 写入 userData/logs/xiyue-tools.log
 */

import { app } from 'electron';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';

/** 汐月工具风险分类 */
export type XiyueToolRisk = 'read' | 'write' | 'delete' | 'cmd' | 'clipboard' | 'sys' | 'monitor' | 'network';

export interface XiyueToolMeta {
  id: string;
  risks: XiyueToolRisk[];
  /** 需要用户逐次确认；终审要求请求携带 userConfirmed: true */
  confirm: boolean;
  needsWorkspace: boolean;
  requireWorkspaceWhenEmpty: boolean;
}

interface SchemaXiyueBlock {
  risks: string[];
  confirm: boolean;
  level: number;
  scope: string;
  needsWorkspace: boolean;
  requireWorkspaceWhenEmpty: boolean;
}

interface SchemaToolEntry {
  name: string;
  xiyue: SchemaXiyueBlock;
}

interface XiyueToolsSchemaFile {
  version: string;
  tools: SchemaToolEntry[];
}

/**
 * 定位并加载 schemas/xiyue_tools.json。
 * 开发态 cwd = 仓库根；打包后从 app.getAppPath() 兜底。
 */
function loadXiyueToolsSchemaFile(): XiyueToolsSchemaFile {
  const candidates: string[] = [
    join(process.cwd(), 'schemas', 'xiyue_tools.json'),
    join(__dirname, '..', '..', '..', 'schemas', 'xiyue_tools.json'),
  ];
  try {
    candidates.push(join(app.getAppPath(), 'schemas', 'xiyue_tools.json'));
  } catch {
    /* 测试环境 app 可能是 mock */
  }
  for (const p of candidates) {
    try {
      if (existsSync(p)) {
        return JSON.parse(readFileSync(p, 'utf-8')) as XiyueToolsSchemaFile;
      }
    } catch {
      /* try next */
    }
  }
  throw new Error('schemas/xiyue_tools.json not found (tried: ' + candidates.join('; ') + ')');
}

/** 从单一 schema 构建主进程白名单元数据 */
function buildAllowlistFromSchema(): XiyueToolMeta[] {
  const schema = loadXiyueToolsSchemaFile();
  return schema.tools.map((t) => ({
    id: t.name,
    risks: t.xiyue.risks as XiyueToolRisk[],
    confirm: Boolean(t.xiyue.confirm),
    needsWorkspace: Boolean(t.xiyue.needsWorkspace),
    requireWorkspaceWhenEmpty: Boolean(t.xiyue.requireWorkspaceWhenEmpty),
  }));
}

/** 汐月工具白名单（同源：schemas/xiyue_tools.json；惰性加载，避免 import 期 IO） */
let _allowlistCache: XiyueToolMeta[] | null = null;
let _indexCache: Map<string, XiyueToolMeta> | null = null;

function ensureToolRegistry(): { list: XiyueToolMeta[]; index: Map<string, XiyueToolMeta> } {
  if (!_allowlistCache || !_indexCache) {
    _allowlistCache = buildAllowlistFromSchema();
    _indexCache = new Map<string, XiyueToolMeta>();
    for (const meta of _allowlistCache) {
      _indexCache.set(meta.id, meta);
    }
  }
  return { list: _allowlistCache, index: _indexCache };
}

/** 只读快照，供 schema 导出 / 一致性校验使用 */
export function listXiyueTools(): readonly XiyueToolMeta[] {
  return ensureToolRegistry().list;
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
  /** 与侧车 route_log / tool_call_request 串联的请求 ID（可选） */
  requestId?: unknown;
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
  /** 与侧车 route_log / tool_call_request 串联的请求 ID */
  requestId?: string;
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

  const meta = ensureToolRegistry().index.get(tool);
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
      requestId: record.requestId,
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
  const requestId = typeof request.requestId === 'string' && request.requestId.trim()
    ? request.requestId.trim()
    : undefined;
  const base = {
    requestId,
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
