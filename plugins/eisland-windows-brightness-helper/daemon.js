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

'use strict';

/**
 * @file daemon.js
 * @description helper EXE 的常驻进程（serve 模式）客户端。
 *
 * 为什么需要它：helper 是 C# 程序，每次 get/set 都 spawn 新进程要启动整个 .NET 运行时
 * （实测 250-380ms）。拖动滑条时写入严重滞后 → 系统值追不上 UI，还会把 UI 拉回旧值造成闪烁。
 * serve 模式下进程只启动一次，命令走 stdin/stdout 行式 JSON，单次调用降到亚毫秒级，
 * 并顺带承担事件推送（monitor 能力合并进同一个进程）。
 *
 * 兼容性：如果 EXE 是旧版（不认识 serve 命令）会立刻退出，此时标记 unsupported，
 * 调用方自动回退到"每次 spawn"或包自带的同步 API，功能不受影响。
 */

const { spawn } = require('node:child_process');

/** serve 握手超时（ms）：超时即认为该 EXE 不支持 serve */
const SERVE_HANDSHAKE_TIMEOUT_MS = 4000;

/** 单个命令的响应超时（ms） */
const REQUEST_TIMEOUT_MS = 4000;

class HelperDaemon {
  /**
   * @param {object} options
   * @param {string} options.name 日志用名称
   * @param {() => string | null} options.findHelper 解析 helper EXE 路径
   * @param {string} options.eventName 事件名，如 'brightness-changed'
   * @param {string} options.valueKey 事件中取值的字段，如 'brightness'
   */
  constructor(options) {
    this._name = options.name;
    this._findHelper = options.findHelper;
    this._eventName = options.eventName;
    this._valueKey = options.valueKey;

    this._process = null;
    this._buffer = '';
    this._nextId = 1;
    this._pending = new Map();
    this._listeners = new Set();
    this._startPromise = null;
    this._readyResolve = null;
    /** 旧版 EXE 不支持 serve：不再重试，直接走回退路径 */
    this._unsupported = false;
  }

  /** 该 EXE 是否支持 serve 模式（启动握手后确定） */
  isSupported() {
    return !this._unsupported;
  }

  /** 进程是否在运行 */
  isRunning() {
    return this._process !== null;
  }

  /** 订阅系统值变化事件（走 serve 进程推送） */
  onValue(callback) {
    this._listeners.add(callback);
    // 惰性启动：订阅即拉起常驻进程
    this.start().catch(() => undefined);
    return () => {
      this._listeners.delete(callback);
    };
  }

  _emitValue(value) {
    for (const callback of Array.from(this._listeners)) {
      try {
        callback(value);
      } catch {
        // 单个订阅者抛错不影响其它订阅者
      }
    }
  }

  _handleLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return;

    let payload;
    try {
      payload = JSON.parse(trimmed);
    } catch {
      return;
    }
    if (!payload || typeof payload !== 'object') return;

    // 命令响应：带 id
    if (payload.id !== undefined) {
      const key = String(payload.id);
      const entry = this._pending.get(key);
      if (!entry) return;
      this._pending.delete(key);
      clearTimeout(entry.timer);
      if (payload.ok === false) {
        entry.reject(new Error(payload.error || `${this._name} command failed`));
      } else {
        entry.resolve(payload.result);
      }
      return;
    }

    // 事件推送：无 id
    const eventType = payload.event ?? payload.eventName;
    if (eventType === 'ready') {
      const resolve = this._readyResolve;
      this._readyResolve = null;
      if (resolve) resolve();
      return;
    }
    if (eventType === this._eventName && typeof payload[this._valueKey] === 'number') {
      this._emitValue(payload[this._valueKey]);
    }
  }

  _rejectAllPending(error) {
    for (const entry of Array.from(this._pending.values())) {
      clearTimeout(entry.timer);
      entry.reject(error);
    }
    this._pending.clear();
  }

  /** 启动常驻进程（幂等，返回同一个 Promise） */
  start() {
    if (this._process) return Promise.resolve();
    if (this._unsupported) return Promise.reject(new Error(`${this._name} serve unsupported`));
    if (this._startPromise) return this._startPromise;

    this._startPromise = new Promise((resolve, reject) => {
      const helperPath = this._findHelper();
      if (!helperPath) {
        reject(new Error(`${this._name} helper EXE not found`));
        return;
      }

      let child;
      try {
        child = spawn(helperPath, ['serve'], {
          windowsHide: true,
          // stderr 用 ignore：避免子进程写满管道缓冲被卡住
          stdio: ['pipe', 'pipe', 'ignore'],
        });
      } catch (error) {
        reject(error);
        return;
      }

      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(handshakeTimer);
        this._startPromise = null;
        if (error) reject(error);
        else resolve();
      };

      const handshakeTimer = setTimeout(() => {
        // 握手超时：多半是旧版 EXE 不支持 serve，标记后走回退
        this._unsupported = true;
        try {
          child.kill();
        } catch {
          // ignore
        }
        finish(new Error(`${this._name} serve handshake timeout`));
      }, SERVE_HANDSHAKE_TIMEOUT_MS);

      this._readyResolve = () => finish(null);

      child.stdout.on('data', (chunk) => {
        this._buffer += chunk.toString('utf8');
        const lines = this._buffer.split('\n');
        this._buffer = lines.pop() ?? '';
        for (const line of lines) this._handleLine(line);
      });

      child.on('error', (error) => {
        this._process = null;
        this._rejectAllPending(error);
        finish(error);
      });

      child.on('close', () => {
        const wasCurrent = this._process === child;
        this._process = null;
        this._buffer = '';
        if (wasCurrent) {
          this._rejectAllPending(new Error(`${this._name} serve process exited`));
        }
        // 还没收到 ready 就退出 = 旧版 EXE（不认识 serve 命令）
        if (!settled) {
          this._unsupported = true;
          finish(new Error(`${this._name} exited before ready (serve unsupported)`));
        }
      });

      this._process = child;
    });

    return this._startPromise;
  }

  /**
   * 向常驻进程发送一条命令
   * @param {string} cmd
   * @param {number | boolean} [value]
   * @returns {Promise<any>}
   */
  async request(cmd, value) {
    await this.start();
    const child = this._process;
    if (!child || !child.stdin || child.stdin.destroyed) {
      throw new Error(`${this._name} serve process unavailable`);
    }

    const id = this._nextId++;
    const payload = value === undefined ? { id, cmd } : { id, cmd, value };

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(String(id));
        reject(new Error(`${this._name} request timeout: ${cmd}`));
      }, REQUEST_TIMEOUT_MS);
      this._pending.set(String(id), { resolve, reject, timer });
      try {
        child.stdin.write(`${JSON.stringify(payload)}\n`);
      } catch (error) {
        this._pending.delete(String(id));
        clearTimeout(timer);
        reject(error);
      }
    });
  }

  /** 停止常驻进程（应用退出时调用） */
  stop() {
    const child = this._process;
    this._process = null;
    this._startPromise = null;
    this._readyResolve = null;
    if (!child) return;
    try {
      child.stdin.end('{"cmd":"quit"}\n');
    } catch {
      // ignore
    }
    const killTimer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // ignore
      }
    }, 800);
    killTimer.unref();
  }
}

module.exports = { HelperDaemon };
