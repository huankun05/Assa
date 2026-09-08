/*
 * eIsland - A sleek, Apple Dynamic Island inspired floating widget for Windows, built with Electron.
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 */

/**
 * @file neteaseWatcherLauncher.ts
 * @description netease-watcher 常驻进程管理（随 eIsland 启动/退出）
 * @description netease-watcher 是独立 Rust 钩子进程，在本地 http://127.0.0.1:3574/ 暴露网易云
 *              真实播放进度（SMTC 无时间轴、UIA 读不到 CEF 时唯一可靠来源）。
 *              本模块负责在应用启动时拉起该进程、退出时关闭它，并保证 exe 与其依赖的
 *              wndhok.dll 同目录（钩子注入必需）。
 * @author 鸡哥
 */

import { spawn, type ChildProcess } from 'node:child_process';
import { join, dirname } from 'node:path';
import { existsSync } from 'node:fs';
import { app } from 'electron';

interface NeteaseWatcherLauncher {
  start: () => void;
  stop: () => void;
}

function resolveWatcherExecutable(): string | null {
  // 打包模式：extraResources 打包到 helpers/netease-watcher
  const packaged = process.resourcesPath
    ? join(process.resourcesPath, 'helpers', 'netease-watcher', 'netease-watcher.exe')
    : '';
  // dev 模式：源码 resources/netease-watcher
  const dev = join(app.getAppPath(), 'resources', 'netease-watcher', 'netease-watcher.exe');

  const candidates = [
    ...(packaged ? [packaged] : []),
    dev,
  ];
  return candidates.find((c) => existsSync(c)) ?? null;
}

/**
 * 创建 netease-watcher 常驻进程管理器。
 * @description 只负责拉起/终止外部进程；真实进度读取由 neteaseWatcher.readNeteaseWatcherPosition 负责。
 */
export function createNeteaseWatcherLauncher(): NeteaseWatcherLauncher {
  let child: ChildProcess | null = null;

  /**
   * 应用就绪时启动。
   * @description exe 与 wndhok.dll 必须同目录；启动失败（例如被占用/非 Windows）静默忽略，
   *              进度读取会有失败退避，不会对主流程造成影响。Windows 专属。
   */
  function start(): void {
    if (process.platform !== 'win32') return;
    if (child) return;

    const exe = resolveWatcherExecutable();
    if (!exe) {
      console.warn('[netease-watcher] 未找到可执行文件，跳过启动（真实进度将不可用）');
      return;
    }

    try {
      child = spawn(exe, [], {
        cwd: dirname(exe), // 保持 wndhok.dll 相对可执行文件可被加载
        windowsHide: true,
        stdio: 'ignore',
      });
      child.on('error', (err) => {
        console.warn('[netease-watcher] 启动失败：', err.message);
        child = null;
      });
      child.on('exit', () => {
        child = null;
      });
      console.log(`[netease-watcher] 已启动（${exe}）`);
    } catch (err) {
      console.warn('[netease-watcher] 启动异常：', (err as Error).message);
      child = null;
    }
  }

  /** 应用退出时关闭。 */
  function stop(): void {
    if (child && !child.killed) {
      try {
        child.kill();
      } catch {
        /* ignore */
      }
    }
    child = null;
  }

  return { start, stop };
}