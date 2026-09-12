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

if (process.platform !== 'win32') {
  throw new Error('@xiyue/windows-volume-helper only supports Windows.');
}

const { spawnSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { HelperDaemon } = require('./daemon');

const helperFileName = 'eIslandVolumeHelper.exe';
const helperCandidates = [
  ...(typeof process.resourcesPath === 'string'
    ? [path.join(process.resourcesPath, 'helpers', 'volume', helperFileName)]
    : []),
  path.join(__dirname, 'src', 'bin', 'Release', 'net10.0', 'win-x64', helperFileName),
  path.join(__dirname, 'src', 'bin', 'Debug', 'net10.0', 'win-x64', helperFileName),
  path.join(__dirname, 'src', 'bin', 'Release', 'net10.0', helperFileName),
  path.join(__dirname, 'src', 'bin', 'Debug', 'net10.0', helperFileName),
];

function findHelper() {
  return helperCandidates.find((candidate) => fs.existsSync(candidate)) ?? null;
}

/**
 * 暴露 helper EXE 的解析结果
 * @description 供调用方（Electron 主进程）自行 spawn 避免阻塞主线程；
 * 路径解析保持单一真源，避免调用方各拼一份导致找不到 EXE。
 * @returns {string | null} helper EXE 绝对路径，未构建时返回 null
 */
function getHelperPath() {
  return findHelper();
}

function callHelper(args, timeout = 5000) {
  const helperPath = findHelper();
  if (!helperPath) return null;

  const result = spawnSync(helperPath, args, {
    encoding: 'utf8',
    windowsHide: true,
    timeout,
  });

  if (result.status !== 0 || result.error || !result.stdout) return null;

  try {
    return JSON.parse(result.stdout.trim());
  } catch {
    return null;
  }
}

/**
 * 异步调用 helper EXE（不阻塞调用线程）
 * @description 与 callHelper 的唯一区别是异步。Electron 主进程**必须**用它：
 * spawnSync 会同步启动整个 .NET 运行时（实测 80-380ms），期间主线程消息循环
 * 完全停摆 → 表现为「鼠标拖不动、界面卡死」。serve 常驻进程不可用时的回退路径
 * 一律走这里，绝不退回 spawnSync。
 * @param {string[]} args
 * @param {number} timeout
 * @returns {Promise<any | null>}
 */
function callHelperAsync(args, timeout = 8000) {
  const helperPath = findHelper();
  if (!helperPath) return Promise.resolve(null);

  return new Promise((resolve) => {
    let child;
    try {
      child = spawn(helperPath, args, {
        windowsHide: true,
        // stderr 用 ignore：避免子进程写满管道缓冲被卡住
        stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch {
      resolve(null);
      return;
    }

    let stdout = '';
    let settled = false;
    const done = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };

    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignore
      }
      done(null);
    }, timeout);

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString('utf8');
    });
    child.on('error', () => done(null));
    child.on('close', (code) => {
      if (code !== 0 || !stdout) {
        done(null);
        return;
      }
      try {
        done(JSON.parse(stdout.trim()));
      } catch {
        done(null);
      }
    });
  });
}

/**
 * 获取当前默认播放设备的静音状态
 * @returns {boolean | null} 静音状态，失败时返回 null
 */
function getMute() {
  const result = callHelper(['get-mute']);
  return typeof result?.muted === 'boolean' ? result.muted : null;
}

/**
 * 设置当前默认播放设备的静音状态
 * @param {boolean} muted - 是否静音
 * @returns {boolean} 是否设置成功
 */
function setMute(muted) {
  if (typeof muted !== 'boolean') return false;
  const result = callHelper(['set-mute', String(muted)]);
  return result?.success === true;
}

/**
 * 获取当前默认播放设备的主音量
 * @returns {number | null} 0-100 音量，失败时返回 null
 */
function getVolume() {
  const result = callHelper(['get']);
  return typeof result?.level === 'number' ? result.level : null;
}

/**
 * 设置当前默认播放设备的主音量
 * @param {number} level - 目标音量 (0-100)
 * @returns {boolean} 是否设置成功
 */
function setVolume(level) {
  const normalized = Math.max(0, Math.min(100, Math.round(level)));
  const result = callHelper(['set', String(normalized)]);
  return result?.success === true;
}

/**
 * 常驻进程（serve 模式）客户端：进程只启动一次，命令走 stdin/stdout。
 * 单次调用从 ~280ms 降到亚毫秒级；EXE 为旧版时自动回退（见 getVolumeAsync）。
 */
const daemon = new HelperDaemon({
  name: 'volume',
  findHelper: findHelper,
  eventName: 'volume-changed',
  valueKey: 'level',
});

/**
 * 异步获取当前音量（走常驻进程）
 * @returns {Promise<number | null>}
 */
async function getVolumeAsync() {
  try {
    const result = await daemon.request('get');
    // serve 模式 get 返回裸数字（如 10）；兼容对象形态 { level }
    if (typeof result === 'number') return result;
    return typeof result?.level === 'number' ? result.level : null;
  } catch (error) {
    // serve 不可用 → 回退一次性 spawn。回退**必须**异步：
    // getVolume() 是 spawnSync，会同步阻塞 Electron 主线程（鼠标拖不动的元凶）。
    return callHelperAsync(['get']);
  }
}

/**
 * 异步设置音量（走常驻进程）
 * @param {number} level - 目标音量 (0-100)
 * @returns {Promise<boolean>}
 */
async function setVolumeAsync(level) {
  const value = Math.max(0, Math.min(100, Math.round(level)));
  try {
    const result = await daemon.request('set', value);
    return result?.success === true;
  } catch (error) {
    // 同上：回退走异步 spawn，绝不阻塞主线程
    const result = await callHelperAsync(['set', String(value)]);
    return result?.success === true;
  }
}

/**
 * 订阅音量变化（走常驻进程的事件推送）
 * @param {(level: number) => void} listener
 * @returns {() => void} 取消订阅
 */
function onVolumeChanged(listener) {
  return daemon.onValue(listener);
}

/**
 * 获取静音状态（走常驻进程，失败回退一次性调用）
 * @returns {Promise<boolean | null>}
 */
async function getMuteAsync() {
  try {
    const result = await daemon.request('get-mute');
    return typeof result === 'boolean' ? result : null;
  } catch (error) {
    // 回退**必须**异步：getMute() 是 spawnSync，会同步阻塞 Electron 主线程（鼠标拖不动的元凶）。
    const r = await callHelperAsync(['get-mute']);
    return typeof r?.muted === 'boolean' ? r.muted : null;
  }
}

/**
 * 设置静音状态（走常驻进程，失败回退一次性调用）
 * @param {boolean} muted
 * @returns {Promise<boolean>}
 */
async function setMuteAsync(muted) {
  if (typeof muted !== 'boolean') return false;
  try {
    const result = await daemon.request('set-mute', muted);
    return result?.success === true;
  } catch (error) {
    // 回退**必须**异步：setMute() 是 spawnSync，会同步阻塞 Electron 主线程（鼠标拖不动的元凶）。
    const r = await callHelperAsync(['set-mute', String(muted)]);
    return r?.success === true;
  }
}

class VolumeMonitor extends EventEmitter {
  constructor() {
    super();
    this._process = null;
    this._running = false;
    this._buffer = '';
  }

  start() {
    if (this._running) return;

    const helperPath = findHelper();
    if (!helperPath) {
      throw new Error('Volume helper EXE not found. Run "npm run build" first.');
    }

    this._process = spawn(helperPath, ['monitor'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    this._running = true;

    this._process.stdout.on('data', (chunk) => {
      this._buffer += chunk.toString();
      const lines = this._buffer.split('\n');
      this._buffer = lines.pop() ?? '';

      for (const line of lines) {
        this._handleLine(line);
      }
    });

    this._process.stderr.on('data', (chunk) => {
      this.emit('error', new Error(chunk.toString().trim()));
    });

    this._process.on('error', (error) => {
      this._running = false;
      this.emit('error', error);
    });

    this._process.on('close', () => {
      this._running = false;
      this._process = null;
      this._buffer = '';
    });
  }

  stop() {
    if (!this._running) return;
    this._running = false;

    const process = this._process;
    this._process = null;
    if (!process) return;

    process.stdin.end('\n');
    const killTimer = setTimeout(() => {
      if (!process.killed) process.kill();
    }, 1000);
    killTimer.unref();
  }

  isRunning() {
    return this._running;
  }

  _handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    try {
      const event = JSON.parse(trimmed);
      if (event.eventName === 'volume-changed' && typeof event.level === 'number') {
        this.emit('volume-changed', event.level, event.timestamp);
        return;
      }
      if (event.eventName === 'error' && typeof event.message === 'string') {
        this.emit('error', new Error(event.message));
      }
    } catch {
      // Ignore non-JSON helper output.
    }
  }
}

module.exports = {
  getMute,
  setMute,
  getVolume,
  setVolume,
  getHelperPath,
  getVolumeAsync,
  setVolumeAsync,
  onVolumeChanged,
  getMuteAsync,
  setMuteAsync,
  stopDaemon: () => daemon.stop(),
  VolumeMonitor,
};