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
import { appendFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

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
  console.log('[App] restartApp start', {
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
    console.error('[App] restart relaunch error:', err);
  }

  try {
    restartCleanup?.();
  } catch (err) {
    console.error('[App] restart cleanup error:', err);
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
    console.error('[App] restart toast error:', err);
  }
}

/**
 * 派生 dev 会话重启器
 * @description 写一个独立 Node 脚本并用系统 node 启动（不用 PowerShell——
 *   安全软件常把「隐藏 PowerShell」当可疑拦截）。脚本等待旧 PID / 端口后 npm run dev。
 */
function spawnDevSessionRestarter(): void {
  const projectRoot = resolve(app.getAppPath());
  const pid = process.pid;

  const tempDir = app.getPath('temp');
  const logFile = join(tempDir, 'xiyue-dev-restart.log');
  const scriptPath = join(tempDir, `xiyue-dev-restart-${pid}.js`);
  const vbsPath = join(tempDir, `xiyue-dev-restart-${pid}.vbs`);
  const systemNode = 'E:/software/Nodejs/node.exe';
  const npmCli = 'E:/software/Nodejs/node_modules/npm/bin/npm-cli.js';
  const maxMs = RESTARTER_MAX_TRIES * 1000;

  // 不等待具体端口：ELECTRON_RENDERER_URL 可能是 5173，实际 vite 却在 5174。
  // 等父 PID 消失 + 固定冷却即可，避免卡死在错误端口上。
  const script = `/* xiyue dev restarter parent=${pid} */
const { spawn } = require('child_process');
const fs = require('fs');
const log = ${JSON.stringify(logFile)};
function logLine(s) { try { fs.appendFileSync(log, s + '\\n'); } catch (e) {} }
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function alive(p) {
  try { process.kill(p, 0); return true; } catch (e) { return false; }
}
(async () => {
  logLine('===== restarter start parent=${pid} =====');
  const deadline = Date.now() + ${maxMs};
  while (alive(${pid}) && Date.now() < deadline) await sleep(300);
  logLine('parent gone, cooldown 2s');
  await sleep(2000);
  logLine('spawn npm run dev cwd=' + ${JSON.stringify(projectRoot)});
  const child = spawn(${JSON.stringify(systemNode)}, [${JSON.stringify(npmCli)}, 'run', 'dev'], {
    cwd: ${JSON.stringify(projectRoot)},
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const append = (c) => { try { fs.appendFileSync(log, String(c)); } catch (e) {} };
  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('error', (e) => logLine('spawn error ' + e));
  child.unref();
  logLine('npm run dev detached pid=' + child.pid);
})();
`;

  try {
    writeFileSync(scriptPath, script, 'utf-8');
    // VBS 无窗口启动 node：能脱离 Electron Job Object，且不触发「隐藏 PowerShell」拦截
    const vbs = [
      'Set sh = CreateObject("WScript.Shell")',
      `sh.Run """${systemNode}"" ""${scriptPath.replace(/\\/g, '\\\\')}""", 0, False`,
    ].join('\r\n');
    writeFileSync(vbsPath, vbs, 'ascii');
    appendFileSync(logFile, `===== scheduled pid=${pid} vbs=${vbsPath} =====\n`);
    const child = spawn('wscript.exe', [vbsPath], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true,
      cwd: projectRoot,
    });
    child.unref();
    console.log(`[App] dev restarter scheduled via wscript (log: ${logFile})`);
  } catch (err) {
    console.error('[App] restarter schedule failed:', err);
    try {
      app.relaunch();
    } catch {
      // ignore
    }
  }
}
