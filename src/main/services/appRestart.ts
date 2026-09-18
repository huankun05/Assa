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
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * @file appRestart.ts
 * @description 应用重启服务：统一托盘菜单、设置页 IPC 与 Agent 工具三处重启入口
 * @description 打包模式直接 app.relaunch()；dev 模式下 electron-vite CLI 会在本进程
 *   退出时连同 vite dev server 一起退出（其内部实现为 ps.on('close', process.exit)），
 *   直接 relaunch 出的新实例将加载一个已经死掉的 ELECTRON_RENDERER_URL，表现为
 *   「点击重启后应用直接消失」。因此 dev 模式改为派生一个分离的等待脚本：等本进程
 *   退出（释放单实例锁）、等 dev server 端口释放后，再重新拉起整个 dev 会话。
 * @author 鸡哥
 */

import { app, Notification } from 'electron';
import { spawn } from 'child_process';
import { appendFileSync, existsSync, mkdirSync, realpathSync, unlinkSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

/** 重启路径禁止碰 console/stdout——管道断开时异步 EPIPE 会崩主进程 */
function safeLog(...args: unknown[]): void {
  try {
    const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    appendFileSync(join(app.getPath('temp'), 'assa-dev-restart.log'), `[app] ${msg}\n`);
  } catch {
    // ignore
  }
}

function safeLogError(...args: unknown[]): void {
  safeLog(...args);
}

/** 等待旧实例退出的轮询上限（约 2 分钟），防止隐藏脚本无限循环 */
const RESTARTER_MAX_TRIES = 120;

/** 是否已处于重启流程中（托盘 / IPC / Agent 工具可能并发触发，只允许一次） */
let restarting = false;

/** 是否正处于强制退出流程（设置窗口 close 会 preventDefault，退出时需放行） */
let applicationQuitting = false;

let restartCleanup: (() => void) | null = null;

/**
 * 是否正处于重启流程
 * @description 供外部判断本次退出是否由重启触发
 */
export function isRestarting(): boolean {
  return restarting;
}

/**
 * 是否正处于强制退出流程
 * @description 设置窗口等「关闭即隐藏」的窗口在退出时必须放行 close，否则 app.quit/exit 被卡住
 */
export function isApplicationQuitting(): boolean {
  return applicationQuitting;
}

/**
 * 注册重启前的清理回调
 * @param fn - 清理函数，内容与正常退出时 will-quit 阶段的清理保持一致
 */
export function registerRestartCleanup(fn: () => void): void {
  restartCleanup = fn;
}

/** 重启前提示延时：先让右下角系统通知露出，再退出 */
const RESTART_SILENT_EXIT_MS = 900;

/** 快速退出延时：清理同步完成后立刻 exit，无需等通知 */
const FAST_QUIT_EXIT_MS = 50;

/** 外部强杀兜底延时：主循环卡死时独立进程杀 PID */
const FAST_QUIT_FORCE_KILL_MS = 1500;

/** 当前已挂起的 force-kill VBS 路径（干净退出时删掉，避免 PID 复用误杀新实例） */
let pendingForceKillVbsPath: string | null = null;

/** 干净退出时取消 force-kill 兜底：否则 soft-restart 后新 Electron 若复用 PID 会被 taskkill 掉 */
function cancelPendingForceKill(): void {
  if (!pendingForceKillVbsPath) return;
  try {
    if (existsSync(pendingForceKillVbsPath)) unlinkSync(pendingForceKillVbsPath);
  } catch {
    // ignore
  }
  pendingForceKillVbsPath = null;
}

process.on('exit', () => {
  cancelPendingForceKill();
});

/**
 * 快速退出应用
 * @description 托盘「退出」/ 退出快捷键 / app:quit 统一入口。
 *   不走 app.quit()：设置窗口 close 会 preventDefault 改为隐藏，会卡住优雅退出；
 *   且 will-quit 清理含杀子进程等，Windows 上可能等不到。
 *   与 restartApp 同路径：显式清理 → app.exit → process.exit → 外部 taskkill 兜底。
 */
export function quitAppFast(): void {
  if (applicationQuitting) return;
  applicationQuitting = true;
  safeLog('[App] quitAppFast start');

  try {
    restartCleanup?.();
  } catch (err) {
    safeLogError('[App] quit cleanup error:', err);
  }

  setTimeout(() => {
    safeLog('[App] force exit now');
    cancelPendingForceKill();
    try {
      app.exit(0);
    } catch {
      // ignore
    }
    try {
      process.exit(0);
    } catch {
      // ignore
    }
  }, FAST_QUIT_EXIT_MS);

  scheduleExternalForceKill(process.pid, FAST_QUIT_FORCE_KILL_MS);
}

/** 软重启标志：放在项目 data/ 下，主进程与 electron-vite 同一真实路径 */
function softRestartFlagPath(): string {
  try {
    const root = realpathSync(app.getAppPath());
    return join(root, 'data', 'soft-restart.flag');
  } catch {
    return join(app.getPath('temp'), 'assa-soft-restart.flag');
  }
}

/**
 * 重启应用
 * @description 先弹 Windows 系统通知告知用户，再写 flag / relaunch，最后退出。
 *   打包模式：app.relaunch() 后退出；dev 模式：soft-restart flag 让 electron-vite 原地再拉。
 *   退出：app.exit(0) + process.exit(0)，设置窗口 close 会 preventDefault 阻断 app.quit()。
 */
export function restartApp(): void {
  if (restarting) return;
  restarting = true;
  safeLog('[App] restartApp start', {
    packaged: app.isPackaged,
    hasRendererUrl: Boolean(process.env.ELECTRON_RENDERER_URL),
    appPath: app.getAppPath(),
  });
  showRestartToast();

  try {
    if (!app.isPackaged) {
      // 软重启：只让 electron-vite 原地再拉一次 electron，不整段重开 CLI（无闪窗）
      const flag = softRestartFlagPath();
      const dir = join(flag, '..');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(flag, String(process.pid), 'utf-8');
      safeLog('[App] soft-restart flag written', flag);
    } else {
      app.relaunch();
    }
  } catch (err) {
    safeLogError('[App] restart relaunch error:', err);
    try {
      if (!app.isPackaged) spawnDevSessionRestarter();
    } catch {
      // ignore
    }
  }

  try {
    restartCleanup?.();
  } catch (err) {
    safeLogError('[App] restart cleanup error:', err);
  }

  // 进程内退出：app.exit + process.exit。
  // soft-restart **不挂** 外部 taskkill：VBS 已在 Sleep 时删文件停不掉，
  // PID 复用会在 1.3s 后误杀刚拉起的新实例，表现为「用着用着直接崩」。
  setTimeout(() => {
    safeLog('[App] exit now');
    cancelPendingForceKill();
    try {
      app.exit(0);
    } catch {
      // ignore
    }
    try {
      process.exit(0);
    } catch {
      // ignore
    }
  }, RESTART_SILENT_EXIT_MS);
}

/**
 * 外部强杀兜底
 * @description 写 flag 后主进程可能卡在同步清理/原生回调里，事件循环 setTimeout 不触发。
 *   用 VBS 隐藏启动（Run style 0），不要用 cmd——Windows Terminal 会闪控制台。
 *   VBS 内先查进程是否仍存在再 taskkill，降低 PID 复用误杀新实例的概率。
 */
function scheduleExternalForceKill(pid: number, delayMs: number): void {
  try {
    const tempDir = app.getPath('temp');
    const vbsPath = join(tempDir, `assa-force-kill-${pid}.vbs`);
    const vbs = [
      'On Error Resume Next',
      'Set sh = CreateObject("WScript.Shell")',
      `WScript.Sleep ${Math.max(0, delayMs)}`,
      'Set col = GetObject("winmgmts:root\\cimv2").ExecQuery("SELECT * FROM Win32_Process WHERE ProcessId = ' + pid + '")',
      'If col.Count > 0 Then',
      `  sh.Run "taskkill /f /pid ${pid}", 0, False`,
      'End If',
      'On Error Resume Next',
      'CreateObject("Scripting.FileSystemObject").DeleteFile WScript.ScriptFullName',
    ].join('\r\n');
    writeFileSync(vbsPath, vbs, 'ascii');
    pendingForceKillVbsPath = vbsPath;
    const child = spawn('wscript.exe', [vbsPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
    });
    child.unref();
    safeLog('[App] external force-kill scheduled', { pid, delayMs, vbsPath });
  } catch (err) {
    safeLogError('[App] external force-kill schedule failed:', err);
  }
}

/**
 * 系统通知
 * @description 重启前在右下角提示；需在 app.exit 前留出 RESTART_SILENT_EXIT_MS 展示时间
 */
function showRestartToast(): void {
  try {
    if (!Notification.isSupported()) return;
    const toast = new Notification({
      title: 'Assa 正在重新启动',
      body: '应用将关闭以完成重启，结束后会自动重新打开。'
    });
    toast.show();
  } catch (err) {
    safeLogError('[App] restart toast error:', err);
  }
}

/**
 * 派生 dev 会话重启器
 * @description 写一个独立 Node 脚本并用系统 node 启动（不用 PowerShell——
 *   安全软件常把「隐藏 PowerShell」当可疑拦截）。脚本等待旧 PID / 端口后 npm run dev。
 */
function spawnDevSessionRestarter(): void {
  /** 重启瞬间把「本应用路径 + 本会话端口」写进配置，重启器只认这份配置 */
  const projectRoot = resolve(app.getAppPath());
  const pid = process.pid;

  let rendererPort = 0;
  try {
    const url = new URL(process.env.ELECTRON_RENDERER_URL || '');
    rendererPort = Number(url.port) || 0;
  } catch {
    rendererPort = 0;
  }

  const tempDir = app.getPath('temp');
  const logFile = join(tempDir, 'assa-dev-restart.log');
  const configFile = join(tempDir, `assa-dev-restart-${pid}.json`);
  const scriptPath = join(tempDir, `assa-dev-restart-${pid}.js`);
  const vbsPath = join(tempDir, `assa-dev-restart-${pid}.vbs`);
  const systemNode = 'E:/software/Nodejs/node.exe';
  const npmCli = 'E:/software/Nodejs/node_modules/npm/bin/npm-cli.js';
  const maxMs = RESTARTER_MAX_TRIES * 1000;

  const electronViteBin = join(projectRoot, 'node_modules', 'electron-vite', 'bin', 'electron-vite.js');
  const restartConfig = {
    parentPid: pid,
    projectRoot,
    recordedPort: rendererPort,
    logFile,
    systemNode,
    electronViteBin,
  };
  writeFileSync(configFile, JSON.stringify(restartConfig, null, 2), 'utf-8');

  const script = `/* assa dev restarter — config: ${configFile} */
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const cfg = JSON.parse(fs.readFileSync(${JSON.stringify(configFile)}, 'utf-8'));
const log = cfg.logFile;
const parentPid = cfg.parentPid;
const projectRoot = cfg.projectRoot;
const recordedPort = cfg.recordedPort || 0;
const systemNode = cfg.systemNode;
const electronViteBin = cfg.electronViteBin;
function logLine(s) { try { fs.appendFileSync(log, s + '\\n'); } catch (e) {} }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function alive(p) {
  try { process.kill(p, 0); return true; } catch (e) { return false; }
}
function waitPortFree(port) {
  if (!port) return Promise.resolve(true);
  return new Promise((ok) => {
    const sock = net.connect({ port, host: '127.0.0.1' }, () => { sock.destroy(); ok(false); });
    sock.on('error', () => ok(true));
    setTimeout(() => { try { sock.destroy(); } catch (e) {} ok(true); }, 300);
  });
}
(async () => {
  logLine('===== restarter start =====');
  logLine('parent=' + parentPid + ' projectRoot=' + projectRoot + ' recordedPort=' + (recordedPort || 'none'));
  const deadline = Date.now() + ${maxMs};
  while (alive(parentPid) && Date.now() < deadline) await sleep(300);
  logLine('parent gone');
  if (recordedPort) {
    // 最多等 3s：占着也不用死等——新 vite 会自动改用空闲端口
    const portDeadline = Math.min(deadline, Date.now() + 3000);
    while (!(await waitPortFree(recordedPort)) && Date.now() < portDeadline) await sleep(200);
    logLine('recorded port ' + recordedPort + ' check done');
  }
  await sleep(400);
  logLine('spawn electron-vite dev (no npm shell, no extra console)');
  const out = fs.openSync(log, 'a');
  const child = spawn(systemNode, [electronViteBin, 'dev'], {
    cwd: projectRoot,
    detached: true,
    stdio: ['ignore', out, out],
    windowsHide: true,
  });
  child.unref();
  logLine('electron-vite detached pid=' + child.pid);
  // 立刻退出 restarter，避免多占一个隐藏/可见窗口
  process.exit(0);
})();
`;

  try {
    writeFileSync(scriptPath, script, 'utf-8');
    const vbs = [
      'Set sh = CreateObject("WScript.Shell")',
      `sh.Run """${systemNode}"" ""${scriptPath.replace(/\\/g, '\\\\')}""", 0, False`,
    ].join('\r\n');
    writeFileSync(vbsPath, vbs, 'ascii');
    appendFileSync(
      logFile,
      `===== scheduled pid=${pid} projectRoot=${projectRoot} port=${rendererPort || 'none'} config=${configFile} =====\n`,
    );
    const child = spawn('wscript.exe', [vbsPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      cwd: projectRoot,
    });
    child.unref();
    safeLog(`[App] restarter scheduled root=${projectRoot} port=${rendererPort || 'none'}`);
  } catch (err) {
    safeLogError('[App] restarter schedule failed:', err);
    try {
      app.relaunch();
    } catch {
      // ignore
    }
  }
}
