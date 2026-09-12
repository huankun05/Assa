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
import { appendFileSync } from 'fs';
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
  setTimeout(() => app.exit(0), RESTART_TOAST_DELAY_MS);
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
 * 派生 dev 会话重启器（Windows）
 * @description 用 PowerShell `Start-Process -WindowStyle Hidden` 起完全独立进程，
 *   避免 Electron Job Object 在 app.exit 时杀掉子进程；也避免 cmd start 闪终端。
 *   等待旧 PID 退出 + renderer 端口释放后，在项目根用 node+npm-cli 拉起 npm run dev。
 */
function spawnDevSessionRestarter(): void {
  const projectRoot = resolve(app.getAppPath());
  const pid = process.pid;

  let rendererPort = '';
  try {
    rendererPort = new URL(process.env.ELECTRON_RENDERER_URL || '').port;
  } catch {
    rendererPort = '';
  }

  const tempDir = app.getPath('temp');
  const logFile = join(tempDir, 'xiyue-dev-restart.log').replace(/\\/g, '/');
  const nodeExe = process.execPath.replace(/\\/g, '/');
  // electron 进程的 execPath 是 electron.exe；应用侧 npm 用系统 node 更稳
  const systemNode = 'E:/software/Nodejs/node.exe';
  const npmCli = 'E:/software/Nodejs/node_modules/npm/bin/npm-cli.js';
  const root = projectRoot.replace(/\\/g, '/');
  const maxTries = RESTARTER_MAX_TRIES;

  const portWait = rendererPort
    ? `$deadline=Get-Date; while((Get-Date) -lt $deadline.AddSeconds(${maxTries})) { $c=Get-NetTCPConnection -LocalPort ${rendererPort} -State Listen -EA SilentlyContinue; if(-not $c){break}; Start-Sleep -Milliseconds 500 }`
    : '';

  const ps = [
    `$ErrorActionPreference='Continue'`,
    `"===== xiyue restart restarter start pid=${pid} =====" | Add-Content -Encoding utf8 '${logFile}'`,
    `$p=${pid}`,
    `$deadline=Get-Date; while((Get-Process -Id $p -EA SilentlyContinue) -and ((Get-Date) -lt $deadline.AddSeconds(${maxTries}))) { Start-Sleep -Milliseconds 400 }`,
    portWait,
    `Start-Sleep -Milliseconds 800`,
    `Set-Location '${root}'`,
    `& '${systemNode}' '${npmCli}' run dev >> '${logFile}' 2>&1`,
    `"===== restarter finished exit=$LASTEXITCODE =====" | Add-Content -Encoding utf8 '${logFile}'`,
  ].join('; ');

  try {
    // 立刻写一行，证明「已排定」
    appendFileSync(logFile, `===== scheduled by pid ${pid} rendererPort=${rendererPort || 'none'} =====\n`);
    const child = spawn(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-Command', ps],
      {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        cwd: projectRoot,
      },
    );
    child.unref();
    console.log(`[App] dev restarter scheduled via powershell (log: ${logFile})`);
  } catch (err) {
    console.error('[App] powershell restarter spawn failed:', err);
    try {
      app.relaunch();
    } catch {
      // ignore
    }
  }
}

/**
 * 读取项目 package.json 中的 dev 会话脚本名
 * @description 优先 dev，其次 start；都没有时返回空串（调用方回退 electron-vite dev）
 */
function readDevScriptName(projectRoot: string): string {
  try {
    const pkg = JSON.parse(
      readFileSync(join(projectRoot, 'package.json'), 'utf8')
    ) as { scripts?: Record<string, string> };
    if (pkg.scripts?.dev) return 'dev';
    if (pkg.scripts?.start) return 'start';
  } catch {
    // package.json 缺失或损坏时由调用方回退
  }
  return '';
}
