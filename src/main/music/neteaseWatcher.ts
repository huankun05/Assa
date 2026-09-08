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
 */

/**
 * @file neteaseWatcher.ts
 * @description 网易云真实播放进度读取（netease-watcher 本地 HTTP 源）
 * @description 网易云在系统层（SMTC 无时间轴、窗口标题无进度、UIA 读不到 CEF 内容）拿不到真实进度，
 *              唯一可靠来源是进入网易云进程内部。netease-watcher（独立 Rust 钩子进程）在本地
 *              http://127.0.0.1:3574/ 暴露一次快照：{ time: 秒, music: { id, name, artists, album, duration, ... } }。
 *              播放时 time 实时增长、暂停时冻结、切歌时随 music 一起更新。
 *              本模块作为「真实进度最高优先级」来源，供 smtcService 无时间轴会话取用。
 * @author 鸡哥
 */

/** netease-watcher 默认监听地址（可用环境变量 HOST/PORT 调整，此处按默认） */
const WATCHER_HOST = '127.0.0.1';
const WATCHER_PORT = 3574;

/** 本地请求短超时：避免 watcher 未运行时长时间挂起 */
const FETCH_TIMEOUT_MS = 500;

/** 失败退避：watcher 未启动时，不反复每 1s 打一次拒绝连接 */
const FAIL_BACKOFF_MS = 2000;
let lastWatcherFailAt = 0;

/** WebSocket 推送接口路径（netease-watcher 内置）：切歌/进度变化时主动推送，无变化时零流量 */
const WATCHER_WS_PATH = '/ws';
/** WS 断线重连退避（递增，最大 5s） */
const WS_MIN_RECONNECT_MS = 1000;
const WS_MAX_RECONNECT_MS = 5000;

const createWsUrl = (): string => `ws://${WATCHER_HOST}:${WATCHER_PORT}${WATCHER_WS_PATH}`;

/** WS 推送的消息载荷 */
interface WatcherWsMessage {
  type?: string;
  value?: { time?: unknown; music?: unknown } | number | unknown;
}

export interface NeteaseWatcherSnapshot {
  position_ms: number;
  duration_ms: number;
  /** 网易云歌曲 ID（可用于更精确的喜欢判定） */
  id?: number;
  title?: string;
  artists?: string[];
}

/**
 * 订阅 netease-watcher 的 WebSocket 实时推送。
 * 相比 HTTP 高频轮询，推送是事件驱动：切歌/进度变化时服务器主动下发，
 * 无变化时完全静默，不消耗轮询资源，也更实时。
 * 内部处理断线重连（指数退避），自动维护最新快照后回调。
 * @param onUpdate - 每次收到推送且快照发生有效变化时回调
 * @returns 取消订阅函数（幂等）
 */
export function subscribeNeteaseWatcherPosition(
  onUpdate: (snap: NeteaseWatcherSnapshot) => void,
): () => void {
  let ws: WebSocket | null = null;
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let reconnectDelay = WS_MIN_RECONNECT_MS;

  /** 当前已解析的歌曲元数据，与推送的进度合并成完整快照 */
  let currentMusic: { id?: number; title?: string; artists?: string[]; durationMs: number } | null = null;
  let latestTimeSec: number | null = null;
  let latestSnapshotSent: string | null = null;

  const emitIfChanged = (): void => {
    if (latestTimeSec === null || !currentMusic) return;
    const snap: NeteaseWatcherSnapshot = {
      position_ms: Math.max(0, Math.round((latestTimeSec ?? 0) * 1000)),
      duration_ms: currentMusic.durationMs,
      id: currentMusic.id,
      title: currentMusic.title,
      artists: currentMusic.artists,
    };
    // 相同快照不重复回调，避免渲染层无谓刷新
    const key = `${snap.position_ms}:${snap.duration_ms}:${snap.id ?? ''}`;
    if (key === latestSnapshotSent) return;
    latestSnapshotSent = key;
    onUpdate(snap);
  };

  const parseValue = (msg: WatcherWsMessage): void => {
    if (!msg.type || msg.value === undefined) return;
    if (msg.type === 'musicchange' && msg.value && typeof msg.value === 'object') {
      const music = msg.value as { id?: unknown; name?: unknown; artists?: unknown; duration?: unknown };
      const durationMs = Number(music.duration);
      const arts = Array.isArray(music.artists) ? music.artists.map((a) => String(a)) : undefined;
      currentMusic = {
        id: Number.isFinite(Number(music.id)) && Number(music.id) > 0 ? Number(music.id) : undefined,
        title: music.name ? String(music.name) : undefined,
        artists: arts?.length ? arts : undefined,
        durationMs: Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : 0,
      };
      emitIfChanged();
      return;
    }
    if (msg.type === 'timechange') {
      const t = Number(msg.value);
      if (Number.isFinite(t) && t >= 0) {
        latestTimeSec = t;
        emitIfChanged();
      }
    }
  };

  const connect = (): void => {
    if (closed) return;
    try {
      ws = new WebSocket(createWsUrl());
    } catch {
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      reconnectDelay = WS_MIN_RECONNECT_MS;
      // 连接建立后 watcher 会第一时间下发当前歌曲 + 进度
    };

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const msg = JSON.parse(String(ev.data)) as WatcherWsMessage;
        parseValue(msg);
      } catch {
        /* 忽略无法解析的消息 */
      }
    };

    ws.onerror = () => {
      /* onclose 统一触发重连 */
    };

    ws.onclose = () => {
      if (closed) return;
      ws = null;
      scheduleReconnect();
    };
  };

  const scheduleReconnect = (): void => {
    if (closed || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connect();
    }, reconnectDelay);
    reconnectDelay = Math.min(reconnectDelay * 2, WS_MAX_RECONNECT_MS);
  };

  connect();

  return function unsubscribe(): void {
    closed = true;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (ws) {
      try {
        ws.onclose = null;
        ws.close();
      } catch {
        /* ignore */
      }
      ws = null;
    }
  };
}

/**
 * 读取 netease-watcher 当前播放快照（HTTP 一次性读取，适合启动探测/切换时主动拉取）。
 * @returns 拿到真实进度返回快照；watcher 未运行 / 无播放 / 请求失败返回 null
 */
export async function readNeteaseWatcherPosition(): Promise<NeteaseWatcherSnapshot | null> {
  // 失败退避：刚失败过则短暂跳过，降低无谓请求
  if (Date.now() - lastWatcherFailAt < FAIL_BACKOFF_MS) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`http://${WATCHER_HOST}:${WATCHER_PORT}/`, {
      method: 'GET',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!res.ok) {
      lastWatcherFailAt = Date.now();
      return null;
    }
    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return null;
    }
    if (!data || typeof data !== 'object') return null;
    const obj = data as { time?: unknown; music?: unknown };
    const tSec = Number(obj.time);
    const music = (obj.music && typeof obj.music === 'object' ? obj.music : null) as
      | { id?: unknown; name?: unknown; artists?: unknown; duration?: unknown }
      | null;
    if (!Number.isFinite(tSec) || !music) return null;

    const durationMs = Number(music.duration);
    const arts = Array.isArray(music.artists) ? music.artists.map((a) => String(a)) : undefined;
    return {
      position_ms: Math.max(0, Math.round(tSec * 1000)),
      duration_ms: Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs) : 0,
      id: Number.isFinite(Number(music.id)) && Number(music.id) > 0 ? Number(music.id) : undefined,
      title: music.name ? String(music.name) : undefined,
      artists: arts?.length ? arts : undefined,
    };
  } catch {
    lastWatcherFailAt = Date.now();
    return null;
  } finally {
    clearTimeout(timer);
  }
}