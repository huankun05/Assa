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
 * @file assaAgentService.ts
 * @description 汐月 Hermes Python 侧车生命周期管理
 * @description 拉起 agent/server.py（HTTP 127.0.0.1:8765），健康巡检 + 自动重启，
 *   应用退出时清理。
 */

import { spawn, type ChildProcess } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

let child: ChildProcess | null = null;
let currentPort = 8765;
let healthTimer: ReturnType<typeof setInterval> | null = null;
let restartTimer: ReturnType<typeof setTimeout> | null = null;

const HEALTH_INTERVAL_MS = 30_000;
const RESTART_DELAY_MS = 2_000;
const MAX_RESTART_ATTEMPTS = 3;
let restartAttempts = 0;

/** 解析 Python 解释器路径：环境变量 > 项目内 .venv > PATH */
function resolvePythonPath(): string {
  const envPy = process.env.ASSA_PYTHON;
  if (envPy && existsSync(envPy)) return envPy;

  const devVenv = join(app.getAppPath(), '.venv', 'Scripts', 'python.exe');
  if (existsSync(devVenv)) return devVenv;

  return 'python';
}

/** 当前侧车监听端口（供 IPC 转发使用） */
export function getAssaAgentPort(): number {
  return currentPort;
}

/** 侧车是否正在运行 */
export function isAssaAgentRunning(): boolean {
  return child !== null && !child.killed && child.exitCode === null;
}

async function checkHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);
    const res = await fetch(`http://127.0.0.1:${currentPort}/health`, { signal: controller.signal as any });
    clearTimeout(timeout);
    return res.ok;
  } catch {
    return false;
  }
}

function scheduleRestart(): void {
  if (restartTimer) return;
  if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
    console.warn('[assa-agent] 重启次数已达上限，停止自动重启');
    return;
  }
  restartAttempts += 1;
  console.warn(`[assa-agent] 将在 ${RESTART_DELAY_MS}ms 后尝试重启 (${restartAttempts}/${MAX_RESTART_ATTEMPTS})`);
  restartTimer = setTimeout(() => {
    restartTimer = null;
    void startAssaAgent();
  }, RESTART_DELAY_MS);
}

function cancelScheduledRestart(): void {
  if (restartTimer) {
    clearTimeout(restartTimer);
    restartTimer = null;
  }
  restartAttempts = 0;
}

async function healthLoop(): Promise<void> {
  if (isAssaAgentRunning()) {
    const healthy = await checkHealth();
    if (!healthy) {
      console.warn('[assa-agent] 健康检查失败，准备重启');
      stopAssaAgent();
      scheduleRestart();
    } else {
      cancelScheduledRestart();
    }
  }
}

function startHealthLoop(): void {
  stopHealthLoop();
  healthTimer = setInterval(() => {
    void healthLoop();
  }, HEALTH_INTERVAL_MS);
}

function stopHealthLoop(): void {
  if (healthTimer) {
    clearInterval(healthTimer);
    healthTimer = null;
  }
}

/** 拉起侧车（幂等：已有实例则忽略） */
export function startAssaAgent(): void {
  if (isAssaAgentRunning()) return;

  cancelScheduledRestart();
  const script = join(app.getAppPath(), 'agent', 'server.py');
  if (!existsSync(script)) {
    console.warn(`[assa-agent] 未找到 ${script}，跳过启动`);
    return;
  }

  const port = Number(process.env.ASSA_AGENT_PORT) || 8765;
  currentPort = port;
  const py = resolvePythonPath();

  child = spawn(py, [script], {
    cwd: app.getAppPath(),
    env: {
      ...process.env,
      ASSA_AGENT_PORT: String(port),
      ASSA_LLM_MODEL: process.env.ASSA_LLM_MODEL || 'qwen3-4b-32k',
    },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (d) => {
    console.log(`[assa-agent] ${String(d).trimEnd()}`);
  });
  child.stderr?.on('data', (d) => {
    console.error(`[assa-agent:err] ${String(d).trimEnd()}`);
  });
  child.on('exit', (code) => {
    console.warn(`[assa-agent] 退出 code=${code}`);
    child = null;
    if (code !== 0 && code !== null) {
      scheduleRestart();
    }
  });
  child.on('error', (err) => {
    console.error('[assa-agent] 启动失败', err);
    child = null;
    scheduleRestart();
  });

  startHealthLoop();
}

/** 停止侧车（应用退出时调用） */
export function stopAssaAgent(): void {
  stopHealthLoop();
  cancelScheduledRestart();
  if (child) {
    try {
      child.kill();
    } catch {
      // ignore
    }
    child = null;
  }
}
