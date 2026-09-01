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
 */

/**
 * @file titleFallback.ts
 * @description 窗口标题兜底检测服务
 * @description 网易云音乐 PC 客户端（部分版本）不向 Windows 注册 SMTC 媒体会话，
 *              导致系统层面拿不到任何播放信息。本模块在 SMTC 无活跃会话时，
 *              轮询网易云主窗口标题（播放时格式为「歌名 - 歌手」）解析出曲目信息，
 *              并通过与 SMTC 相同的 nowplaying:info 通道广播给渲染进程，
 *              使歌词页展板在无 SMTC 会话时也能实时显示当前曲目。
 *              播放控制与「喜欢」同步同样降级为网易云默认全局快捷键模拟。
 * @author 鸡哥
 */

import { BrowserWindow } from 'electron';
import { spawn, type ChildProcess } from 'child_process';
import { sendHotkeyCombo } from '../system/mediaKey';
import { parseHotkeyCombo } from './mediaLike';

/** 轮询间隔（毫秒），由常驻 PowerShell worker 内部执行 */
const FALLBACK_POLL_INTERVAL_MS = 2000;

/** worker 异常退出后的重启延迟 */
const WORKER_RESTART_DELAY_MS = 5000;

/** worker 输出的 tick 分隔行 */
const TICK_MARKER = '__NCM_TICK__';

/**
 * 常驻 PowerShell worker 脚本：每 2 秒枚举一次网易云进程的全部顶层窗口标题
 * （含隐藏窗口——网易云主窗口最小化到托盘后标题仍实时更新为「歌名 - 歌手」，
 *  而 get-windows 的 openWindows 只枚举可见窗口，托盘化后拿不到任何网易云窗口）
 */
const WORKER_SCRIPT = `
$sig = @'
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class NcmWinEnum {
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lParam);
  [DllImport("user32.dll")] static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  delegate bool EnumWindowsProc(IntPtr h, IntPtr lParam);
  public static List<string> GetTitles(HashSet<uint> pids) {
    var result = new List<string>();
    EnumWindows((h, l) => {
      uint pid; GetWindowThreadProcessId(h, out pid);
      if (pids.Contains(pid)) {
        var sb = new StringBuilder(512);
        GetWindowText(h, sb, 512);
        if (sb.Length > 0) result.Add(sb.ToString());
      }
      return true;
    }, IntPtr.Zero);
    return result;
  }
}
'@
Add-Type -TypeDefinition $sig
while ($true) {
  $pids = @()
  Get-Process cloudmusic -ErrorAction SilentlyContinue | ForEach-Object { $pids += $_.Id }
  if ($pids.Count -gt 0) {
    [NcmWinEnum]::GetTitles([System.Collections.Generic.HashSet[uint32]]$pids) | ForEach-Object { Write-Output $_ }
  }
  Write-Output '${TICK_MARKER}'
  Start-Sleep -Milliseconds ${FALLBACK_POLL_INTERVAL_MS}
}
`;

/** 兜底模式下的音源标识，与 SMTC 上报的 sourceAppId 格式保持一致 */
export const NETEASE_FALLBACK_DEVICE_ID = 'cloudmusic.exe';

/** 网易云 PC 端默认全局快捷键（设置 → 快捷键 → 启用全局快捷键） */
const NETEASE_DEFAULT_HOTKEYS = {
  playPause: 'Ctrl+Alt+P',
  prev: 'Ctrl+Alt+Left',
  next: 'Ctrl+Alt+Right',
} as const;

/** 兜底播放信息载荷（结构与 SMTC session payload 一致） */
interface TitleFallbackPayload {
  title: string;
  artist: string;
  album: string;
  duration_ms: number;
  position_ms: number;
  isPlaying: boolean;
  thumbnail: string | null;
  canFastForward: boolean;
  canSkip: boolean;
  canLike: boolean;
  canChangeVolume: boolean;
  canSetOutput: boolean;
  deviceId: string;
}

/** 兜底播放控制类型 */
export type FallbackControlAction = 'playPause' | 'prev' | 'next';

export interface TitleFallbackService {
  start: () => void;
  stop: () => void;
  /** 兜底当前是否生效（正在展示窗口标题解析出的曲目） */
  isActive: () => boolean;
  /** 兜底生效时，按网易云全局快捷键派发播放控制 */
  dispatchControl: (action: FallbackControlAction) => boolean;
}

/**
 * 解析网易云窗口标题为曲目信息
 * @description 播放时标题格式为「歌名 - 歌手」；未播放时无「 - 」分隔，解析失败
 * @param title - 窗口标题
 * @returns 解析结果，解析失败返回 null
 */
export function parseNeteaseWindowTitle(title: string): { title: string; artist: string } | null {
  const trimmed = String(title ?? '').trim();
  if (!trimmed) return null;
  const separatorIndex = trimmed.lastIndexOf(' - ');
  if (separatorIndex <= 0 || separatorIndex >= trimmed.length - 3) return null;
  const trackTitle = trimmed.slice(0, separatorIndex).trim();
  const artist = trimmed.slice(separatorIndex + 3).trim();
  if (!trackTitle || !artist) return null;
  return { title: trackTitle, artist };
}

/**
 * 创建窗口标题兜底检测服务
 * @param options.hasActiveSmtcSession - SMTC 侧是否存在带标题的活跃会话（存在时兜底让位）
 * @returns 兜底服务实例
 */
export function createTitleFallbackService(options: {
  hasActiveSmtcSession: () => boolean;
}): TitleFallbackService {
  let worker: ChildProcess | null = null;
  let restartTimer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let tickLines: string[] = [];
  let active = false;
  let lastKey = '';

  /** 向所有窗口广播播放信息（与 smtcService 的 emitCurrentSession 同通道） */
  function broadcast(payload: TitleFallbackPayload | null): void {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('nowplaying:info', payload);
      }
    });
  }

  function buildPayload(track: { title: string; artist: string }): TitleFallbackPayload {
    return {
      title: track.title,
      artist: track.artist,
      album: '',
      duration_ms: 0,
      position_ms: 0,
      isPlaying: true,
      thumbnail: null,
      canFastForward: false,
      canSkip: false,
      canLike: false,
      canChangeVolume: false,
      canSetOutput: false,
      deviceId: NETEASE_FALLBACK_DEVICE_ID,
    };
  }

  function reset(): void {
    if (!active && !lastKey) return;
    active = false;
    lastKey = '';
    broadcast(null);
  }

  /** 处理一轮 worker 枚举出的网易云窗口标题集合 */
  function processTick(titles: string[]): void {
    // SMTC 有活跃会话时让位（其数据更丰富：封面/进度/暂停状态）
    if (options.hasActiveSmtcSession()) {
      reset();
      return;
    }

    // 多个网易云窗口（主窗口/迷你播放器/桌面歌词）都尝试解析，
    // 优先沿用上一次解析结果所在标题，避免其他窗口标题干扰导致抖动
    let parsed: { title: string; artist: string } | null = null;
    for (const title of titles) {
      const result = parseNeteaseWindowTitle(title);
      if (!result) continue;
      if (`${result.title}||${result.artist}` === lastKey) {
        parsed = result;
        break;
      }
      if (!parsed) parsed = result;
    }

    if (!parsed) {
      reset();
      return;
    }

    const key = `${parsed.title}||${parsed.artist}`;
    if (key === lastKey) return;
    lastKey = key;
    active = true;
    broadcast(buildPayload(parsed));
  }

  /** 处理 worker stdout 的一行 */
  function handleWorkerLine(line: string): void {
    if (line === TICK_MARKER) {
      processTick(tickLines);
      tickLines = [];
      return;
    }
    if (line) tickLines.push(line);
  }

  function spawnWorker(): void {
    const encoded = Buffer.from(WORKER_SCRIPT, 'utf16le').toString('base64');
    try {
      worker = spawn(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
        { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true },
      );
    } catch (error) {
      console.error('[TitleFallback] spawn worker failed:', error);
      worker = null;
      restartTimer = setTimeout(spawnWorker, WORKER_RESTART_DELAY_MS);
      return;
    }

    let buffer = '';
    worker.stdout?.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      let index: number;
      while ((index = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, index).replace(/\r$/, '');
        buffer = buffer.slice(index + 1);
        handleWorkerLine(line);
      }
    });
    worker.stderr?.on('data', (chunk: Buffer) => {
      console.error('[TitleFallback] worker stderr:', chunk.toString('utf8').trim());
    });
    worker.on('error', (err) => {
      console.error('[TitleFallback] worker error:', err);
    });
    worker.on('exit', () => {
      worker = null;
      tickLines = [];
      buffer = '';
      // worker 常驻循环正常不会退出；异常退出时延迟重启，保持兜底可用
      if (running) {
        restartTimer = setTimeout(spawnWorker, WORKER_RESTART_DELAY_MS);
      }
    });
  }

  return {
    start: () => {
      if (running) return;
      running = true;
      spawnWorker();
    },
    stop: () => {
      running = false;
      if (restartTimer) {
        clearTimeout(restartTimer);
        restartTimer = null;
      }
      if (worker) {
        worker.kill();
        worker = null;
      }
      reset();
    },
    isActive: () => active,
    dispatchControl: (action) => {
      // 兜底未生效时（SMTC 会话正常）不派发，由调用方走 SMTC 控制链路
      if (!active) return false;
      const hotkey = NETEASE_DEFAULT_HOTKEYS[action];
      const vkCodes = parseHotkeyCombo(hotkey);
      if (!vkCodes.length) return false;
      sendHotkeyCombo(vkCodes);
      return true;
    },
  };
}

/** 模块级单例引用，供 IPC 处理器等非注入上下文查询兜底状态 */
let _fallbackInstance: TitleFallbackService | null = null;

/**
 * 注册兜底服务单例（index.ts 创建服务后调用）
 */
export function setTitleFallbackInstance(instance: TitleFallbackService | null): void {
  _fallbackInstance = instance;
}

/**
 * 兜底当前是否生效
 */
export function isNeteaseFallbackActive(): boolean {
  return _fallbackInstance?.isActive() ?? false;
}

/**
 * 兜底生效时派发网易云全局快捷键播放控制
 * @param action - 控制类型
 * @returns 是否成功派发（兜底未生效时返回 false，调用方应回退到 SMTC 控制链路）
 */
export function dispatchNeteaseFallbackControl(action: FallbackControlAction): boolean {
  return _fallbackInstance?.dispatchControl(action) ?? false;
}
