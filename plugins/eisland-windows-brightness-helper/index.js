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
  throw new Error('@eisland/windows-src only supports Windows.');
}

const { spawnSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { HelperDaemon } = require('./daemon');

const helperFileName = 'eIslandBrightnessReader.exe';
const helperCandidates = [
  ...(typeof process.resourcesPath === 'string'
    ? [path.join(process.resourcesPath, 'helpers', 'brightness', helperFileName)]
    : []),
  path.join(__dirname, 'src', 'bin', 'Release', 'net10.0', 'win-x64', helperFileName),
  path.join(__dirname, 'src', 'bin', 'Debug', 'net10.0', 'win-x64', helperFileName),
  path.join(__dirname, 'src', 'bin', 'Release', 'net10.0', helperFileName),
  path.join(__dirname, 'src', 'bin', 'Debug', 'net10.0', helperFileName),
];

/**
 * 查找 helper EXE 路径
 * @returns {string | null}
 */
function findHelper() {
  return helperCandidates.find((c) => fs.existsSync(c)) ?? null;
}

/**
 * 同步调用 helper EXE
 * @param {string[]} args
 * @param {number} timeout
 * @returns {any | null}
 */
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
 * spawnSync 会同步启动整个 .NET 运行时（实测 126-380ms），期间主线程消息循环
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
 * 暴露 helper EXE 的解析结果
 * @description 供调用方（Electron 主进程）自行 spawn 避免阻塞主线程；
 * 路径解析保持单一真源，避免调用方各拼一份导致找不到 EXE。
 * @returns {string | null} helper EXE 绝对路径，未构建时返回 null
 */
function getHelperPath() {
  return findHelper();
}

/**
 * 获取当前屏幕亮度
 * @returns {import('.').BrightnessInfo | null}
 */
function getBrightness() {
  return callHelper(['get']);
}

/**
 * 设置屏幕亮度
 * @param {number} brightness - 目标亮度 (0-100)
 * @returns {boolean}
 */
function setBrightness(brightness) {
  const val = Math.max(0, Math.min(100, Math.round(brightness)));
  const result = callHelper(['set', String(val)]);
  return result?.success === true;
}

/**
 * 常驻进程（serve 模式）客户端：进程只启动一次，命令走 stdin/stdout。
 * 单次调用从 ~380ms 降到亚毫秒级；EXE 为旧版时自动回退（见 getBrightnessAsync）。
 */
const daemon = new HelperDaemon({
  name: 'brightness',
  findHelper: findHelper,
  eventName: 'brightness-changed',
  valueKey: 'brightness',
});

/**
 * 异步获取当前亮度（走常驻进程）
 * @returns {Promise<import('.').BrightnessInfo | null>}
 */
async function getBrightnessAsync() {
  try {
    const result = await daemon.request('get');
    return result ?? null;
  } catch (error) {
    // serve 不可用（旧版 EXE / 握手超时）→ 回退到一次性 spawn。
    // 注意：回退**必须**用 callHelperAsync，绝不能调 getBrightness()——
    // 那个是 spawnSync，会同步阻塞 Electron 主线程 126-380ms（鼠标拖不动的元凶）。
    return callHelperAsync(['get']);
  }
}

/**
 * 异步设置屏幕亮度（走常驻进程）
 * @param {number} brightness - 目标亮度 (0-100)
 * @returns {Promise<boolean>}
 */
async function setBrightnessAsync(brightness) {
  const value = Math.max(0, Math.min(100, Math.round(brightness)));
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
 * 订阅亮度变化（走常驻进程的事件推送）
 * @param {(brightness: number) => void} listener
 * @returns {() => void} 取消订阅
 */
function onBrightnessChanged(listener) {
  return daemon.onValue(listener);
}

/**
 * 屏幕亮度实时监控器
 * 通过 WmiMonitorBrightnessEvent 监听亮度变化
 */
class BrightnessMonitor extends EventEmitter {
  constructor() {
    super();
    this._process = null;
    this._running = false;
  }

  /**
   * 启动监控（幂等）
   */
  start() {
    if (this._running) return;

    const helperPath = findHelper();
    if (!helperPath) {
      throw new Error('Brightness helper EXE not found. Run "npm run build" first.');
    }

    this._process = spawn(helperPath, ['monitor'], {
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    this._running = true;

    let buffer = '';
    this._process.stdout.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const event = JSON.parse(trimmed);
          if (typeof event.brightness === 'number') {
            this.emit('brightness-changed', event.brightness, event.timestamp);
          }
        } catch {
          // ignore non-JSON output
        }
      }
    });

    this._process.stderr.on('data', (chunk) => {
      this.emit('error', new Error(chunk.toString()));
    });

    this._process.on('error', (err) => {
      this._running = false;
      this.emit('error', err);
    });

    this._process.on('close', () => {
      this._running = false;
    });
  }

  /**
   * 停止监控（幂等）
   */
  stop() {
    if (!this._running) return;
    this._running = false;

    if (this._process) {
      this._process.kill();
      this._process = null;
    }

    this.removeAllListeners();
  }

  /**
   * 是否正在监控
   * @returns {boolean}
   */
  isRunning() {
    return this._running;
  }
}

module.exports = {
  getBrightness,
  setBrightness,
  getHelperPath,
  getBrightnessAsync,
  setBrightnessAsync,
  onBrightnessChanged,
  stopDaemon: () => daemon.stop(),
  BrightnessMonitor,
};
