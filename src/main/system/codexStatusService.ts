/*
 * eIsland - A sleek, Apple Dynamic Island inspired floating widget for Windows, built with Electron.
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM[](https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @file codexStatusService.ts
 * @description 轮询 Codex rollout 文件并发布统一 CLI 状态快照。
 * @author 鸡哥
 */

import { app, type BrowserWindow } from 'electron';
import {
  existsSync,
  mkdirSync,
  promises as fsp,
  readFileSync,
  writeFileSync,
} from 'fs';
import type { Dirent } from 'fs';
import { dirname, join } from 'path';
import type { ClaudeCodeHeatmapDaily } from '../types/system/ClaudeCodeHeatmapDailyCount';
import type { ClaudeCodeHookEvent } from '../types/system/ClaudeCodeHookEvent';
import type { ClaudeCodeSessionSnapshot } from '../types/system/ClaudeCodeSessionSnapshot';
import type { ClaudeCodeStatusSnapshot } from '../types/system/ClaudeCodeStatusSnapshot';
import type { CodexMonitorMutationResult, CodexStatusService } from '../types/system/CodexStatusService';
import { parseCodexSessionContent, type ParsedCodexSession } from './codexSessionParser';
import { MAX_CLI_SESSIONS } from './sessionLimits';

interface CreateCodexStatusServiceOptions {
  getMainWindow: () => BrowserWindow | null;
  pollIntervalMs?: number;
}

interface FileEntry {
  path: string;
  mtimeMs: number;
  size: number;
}

interface CachedSession {
  mtimeMs: number;
  size: number;
  parsed: ParsedCodexSession | null;
}

interface PersistedCodexState {
  enabled: boolean;
  clearBefore: number;
  deletedBeforeBySession: Record<string, number>;
}

const MAX_EVENTS = 120;
const MAX_SESSION_EVENTS = 40;
/** 5s→15s：同步/异步扫盘都会产生 IO 压力，CLI 状态不需要秒级新鲜度 */
const DEFAULT_POLL_INTERVAL_MS = 15000;

function emptySnapshot(sessionsPath: string, enabled: boolean, running: boolean): ClaudeCodeStatusSnapshot {
  return {
    enabled,
    receiverRunning: running,
    receiverUrl: null,
    settingsPath: sessionsPath,
    hookScriptPath: '',
    sessions: [],
    events: [],
    heatmap: {},
    updatedAt: Date.now(),
  };
}

async function collectJsonlFilesAsync(root: string): Promise<FileEntry[]> {
  if (!existsSync(root)) return Promise.resolve([]);
  const output: FileEntry[] = [];

  const visit = async (directory: string): Promise<void> => {
    if (output.length >= MAX_CLI_SESSIONS) return;
    let entries: Dirent<string>[];
    try {
      entries = await fsp.readdir(directory, { withFileTypes: true, encoding: 'utf-8' });
    } catch {
      return;
    }
    entries.sort((a, b) => b.name.localeCompare(a.name));
    for (const entry of entries) {
      if (output.length >= MAX_CLI_SESSIONS) return;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
      try {
        const stat = await fsp.stat(path);
        output.push({ path, mtimeMs: stat.mtimeMs, size: stat.size });
      } catch {
        // 文件可能在扫描时被 Codex 轮换
      }
    }
  };

  await visit(root);
  return output.sort((a, b) => b.mtimeMs - a.mtimeMs).slice(0, MAX_CLI_SESSIONS);
}

function mergeHeatmap(target: ClaudeCodeHeatmapDaily, source: ClaudeCodeHeatmapDaily): void {
  Object.entries(source).forEach(([date, count]) => {
    const current = target[date] ?? { session: 0, tool: 0, prompt: 0 };
    target[date] = {
      session: current.session + count.session,
      tool: current.tool + count.tool,
      prompt: current.prompt + count.prompt,
    };
  });
}

function phaseForVisibleEvents(events: ClaudeCodeHookEvent[], now: number): ClaudeCodeSessionSnapshot['phase'] {
  const latest = events[0];
  if (!latest || now - latest.createdAt > 10 * 60 * 1000) return 'completed';
  if (latest.eventName === 'PermissionRequest') return 'waiting_permission';
  if (latest.eventName === 'Stop' || latest.eventName === 'StopFailure' || latest.eventName === 'AssistantOutput') return 'idle';
  return 'running';
}

/**
 * 创建 Codex CLI 状态服务
 * @param options - 主窗口访问器与可选轮询周期
 * @returns Codex 状态服务实例
 */
export function createCodexStatusService(options: CreateCodexStatusServiceOptions): CodexStatusService {
  const sessionsPath = join(app.getPath('home'), '.codex', 'sessions');
  const persistPath = join(app.getPath('userData'), 'eIsland_store', 'codex-status-state.json');
  const cache = new Map<string, CachedSession>();
  let timer: ReturnType<typeof setInterval> | null = null;
  /** 默认关闭：避免一启动就扫 ~/.codex/sessions 弹「检测到 Codex」 */
  let enabled = false;
  let clearBefore = 0;
  let deletedBeforeBySession: Record<string, number> = {};
  let snapshot = emptySnapshot(sessionsPath, enabled, false);
  let snapshotSignature = '';

  const loadState = (): void => {
    try {
      if (!existsSync(persistPath)) return;
      const persisted = JSON.parse(readFileSync(persistPath, 'utf-8')) as Partial<PersistedCodexState>;
      enabled = persisted.enabled === true;
      clearBefore = typeof persisted.clearBefore === 'number' ? persisted.clearBefore : 0;
      deletedBeforeBySession = persisted.deletedBeforeBySession && typeof persisted.deletedBeforeBySession === 'object'
        ? persisted.deletedBeforeBySession
        : {};
    } catch {
      enabled = false;
    }
  };

  const persistState = (): void => {
    try {
      mkdirSync(dirname(persistPath), { recursive: true });
      writeFileSync(persistPath, JSON.stringify({ enabled, clearBefore, deletedBeforeBySession }, null, 2), 'utf-8');
    } catch {
      // 状态持久化失败不影响会话读取。
    }
  };

  const emitSnapshot = (): void => {
    const win = options.getMainWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send('codex:status-updated', snapshot);
  };

  const rebuildSnapshot = async (): Promise<void> => {
    const now = Date.now();
    const files = await collectJsonlFilesAsync(sessionsPath);
    const activePaths = new Set(files.map((file) => file.path));
    cache.forEach((_value, path) => {
      if (!activePaths.has(path)) cache.delete(path);
    });

    await Promise.all(files.map(async (file) => {
      const cached = cache.get(file.path);
      if (cached && cached.mtimeMs === file.mtimeMs && cached.size === file.size) return;
      let parsed: ParsedCodexSession | null = null;
      try {
        const content = await fsp.readFile(file.path, 'utf-8');
        parsed = parseCodexSessionContent(content, file.path, file.mtimeMs, now);
      } catch {
        parsed = null;
      }
      cache.set(file.path, { mtimeMs: file.mtimeMs, size: file.size, parsed });
    }));

    const parsedSessions: ParsedCodexSession[] = [];
    files.forEach((file) => {
      const cached = cache.get(file.path);
      if (cached?.parsed) parsedSessions.push(cached.parsed);
    });

    const heatmap: ClaudeCodeHeatmapDaily = {};
    parsedSessions.forEach((parsed) => mergeHeatmap(heatmap, parsed.heatmap));
    const sessions = parsedSessions.flatMap((parsed) => {
      const cutoff = Math.max(clearBefore, deletedBeforeBySession[parsed.session.id] ?? 0);
      const events = parsed.events.filter((event) => event.createdAt > cutoff);
      if (events.length === 0) return [];
      const phase = phaseForVisibleEvents(events, now);
      return [{
        ...parsed.session,
        phase,
        lastSummary: events[0].summary,
        lastEventAt: events[0].createdAt,
        pendingPermission: phase === 'waiting_permission' ? events[0] : null,
        events: events.slice(0, MAX_SESSION_EVENTS),
      }];
    }).sort((a, b) => b.lastEventAt - a.lastEventAt);
    const events = sessions.flatMap((session) => session.events).sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_EVENTS);
    const next: ClaudeCodeStatusSnapshot = {
      enabled,
      receiverRunning: Boolean(timer),
      receiverUrl: null,
      settingsPath: sessionsPath,
      hookScriptPath: '',
      sessions,
      events,
      heatmap,
      updatedAt: Date.now(),
    };
    // 增量签名：排除 updatedAt 等易变字段，保留阶段与事件内容以确保变更可检测
    const signature = JSON.stringify({ ...next, updatedAt: 0 });
    snapshot = next;
    if (signature !== snapshotSignature) {
      snapshotSignature = signature;
      emitSnapshot();
    }
  };

  const startPolling = (): void => {
    if (timer || !enabled) return;
    let inFlight = false;
    const tick = (): void => {
      if (inFlight) return;
      inFlight = true;
      void rebuildSnapshot().finally(() => { inFlight = false; });
    };
    timer = setInterval(tick, options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS);
    tick();
  };

  async function start(): Promise<void> {
    loadState();
    snapshot = emptySnapshot(sessionsPath, enabled, false);
    startPolling();
    if (!enabled) emitSnapshot();
  }

  function stop(): void {
    if (timer) clearInterval(timer);
    timer = null;
    snapshot = { ...snapshot, receiverRunning: false, updatedAt: Date.now() };
    emitSnapshot();
  }

  async function enableMonitor(): Promise<CodexMonitorMutationResult> {
    enabled = true;
    persistState();
    startPolling();
    return { ok: true, message: 'Codex 会话监视已启用。', snapshot };
  }

  async function disableMonitor(): Promise<CodexMonitorMutationResult> {
    enabled = false;
    if (timer) clearInterval(timer);
    timer = null;
    persistState();
    snapshot = { ...snapshot, enabled: false, receiverRunning: false, updatedAt: Date.now() };
    snapshotSignature = '';
    emitSnapshot();
    return { ok: true, message: 'Codex 会话监视已关闭。', snapshot };
  }

  function clearEvents(): ClaudeCodeStatusSnapshot {
    clearBefore = Date.now();
    deletedBeforeBySession = {};
    persistState();
    void rebuildSnapshot();
    return snapshot;
  }

  function deleteSessions(sessionIds: string[]): ClaudeCodeStatusSnapshot {
    const deletedAt = Date.now();
    sessionIds.filter(Boolean).forEach((sessionId) => {
      deletedBeforeBySession[sessionId] = deletedAt;
    });
    persistState();
    void rebuildSnapshot();
    return snapshot;
  }

  return { start, stop, getSnapshot: () => snapshot, enableMonitor, disableMonitor, clearEvents, deleteSessions };
}