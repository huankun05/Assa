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
import { appendFileSync, existsSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

/** 重启路径禁止碰 console/stdout——管道断开时异步 EPIPE 会崩主进程 */
function safeLog(...args: unknown[]): void {
  try {
    const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
    appendFileSync(join(app.getPath('temp'), 'xiyue-dev-restart.log'), `[app] ${msg}\n`);
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

/** 重启前清理回调（app.exit 跳过 will-quit，需显式执行与正常退出一致的清理） */
let restartCleanup: (() => void) | null = null;

/**
 * 是否正处于重启流程
 * @description 供外部判断本次退出是否由重启触发
 */
export function isRestarting(): boolean {
  return restarting;
}

/**
 * 注册重启前的清理回调
 * @param fn - 清理函数，内容与正常退出时 will-quit 阶段的清理保持一致
 */
export function registerRestartCleanup(fn: () => void): void {
  restartCleanup = fn;
}

/** 重启提示通知显示后到退出的等待时间（toast 异步投递，立即退出会丢通知） */
const RESTART_TOAST_DELAY_MS = 1000;

/**
 * 重启应用
 * @description 先弹 Windows 系统通知告知用户，随后执行清理并退出。
 *   打包模式：app.relaunch() 后退出；dev 模式：派生等待脚本重拉 dev 会话。
 *   退出统一使用 app.exit(0)——设置窗口与独立窗口的 close 事件会
 *   preventDefault（关闭即隐藏以实现秒开），会阻断常规 app.quit() 流程。
 */
export function restartApp(): void {
  if (restarting) return;
  restarting = true;
  safeLog('[App] restartApp start', {
    packaged: app.isPackaged,
    hasRendererUrl: Boolean(process.env.ELECTRON_RENDERER_URL),
    appPath: app.getAppPath(),
  });

  try {
    // dev 下即使没有 ELECTRON_RENDERER_URL 也走脚本（相对 electron-vite.cmd），
    // 避免 app.relaunch() 指向已死的 renderer URL
    if (!app.isPackaged) {
      spawnDevSessionRestarter();
    } else {
      app.relaunch();
    }
  } catch (err) {
    safeLogError('[App] restart relaunch error:', err);
  }

  try {
    restartCleanup?.();
  } catch (err) {
    safeLogError('[App] restart cleanup error:', err);
  }

  /** 退出前清理本项目 dev 残留（按路径匹配；用系统 node，不用 electron） */
  try {
    const script = join(app.getAppPath(), 'scripts', 'clean-xiyue-dev-processes.ts');
    const systemNode = 'E:/software/Nodejs/node.exe';
    if (existsSync(script)) {
      spawn(systemNode, [script], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
      }).unref();
    }
  } catch {
    // ignore
  }

  showRestartToast();
  // 尽快退出，缩短 restarter 等待与单实例锁占用窗口
  setTimeout(() => app.exit(0), 600);
}

/**
 * 弹出重启提示的系统通知
 * @description 样式对齐 Windows 应用更新通知（如「应用将关闭以完成安装，
 *   安装结束后会自动重新打开」），让用户明确知道应用会自动回来
 */
function showRestartToast(): void {
  try {
    if (!Notification.isSupported()) return;
    new Notification({
      title: `${app.getName()} 正在重新启动`,
      body: '应用将关闭以完成重启，结束后会自动重新打开，请稍候。'
    }).show();
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
  const logFile = join(tempDir, 'xiyue-dev-restart.log');
  const configFile = join(tempDir, `xiyue-dev-restart-${pid}.json`);
  const scriptPath = join(tempDir, `xiyue-dev-restart-${pid}.js`);
  const vbsPath = join(tempDir, `xiyue-dev-restart-${pid}.vbs`);
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

  const script = `/* xiyue dev restarter — config: ${configFile} */
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
    while (!(await waitPortFree(recordedPort)) && Date.now() < deadline) await sleep(300);
    logLine('recorded port ' + recordedPort + ' free');
  }
  await sleep(1200);
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
