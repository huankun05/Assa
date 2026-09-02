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
 * @file system.ts
 * @description 系统相关 IPC 处理模块
 * @description 处理任务管理器打开和运行进程查询的 IPC 请求
 * @author 鸡哥
 */

import { ipcMain } from 'electron';
import { exec } from 'child_process';
import os from 'os';
import * as si from 'systeminformation';
import {
  getBrightnessAsync,
  setBrightnessAsync,
  onBrightnessChanged,
  stopDaemon as stopBrightnessDaemon,
} from '@eisland/windows-brightness-helper';
import {
  getVolumeAsync,
  setVolumeAsync,
  onVolumeChanged,
  stopDaemon as stopVolumeDaemon,
} from '@eisland/windows-volume-helper';

interface PerformanceSnapshot {
  timestamp: number;
  host: {
    hostname: string;
    platform: string;
    release: string;
    arch: string;
    uptimeSeconds: number;
  };
  cpu: {
    manufacturer: string;
    brand: string;
    cores: number;
    physicalCores: number;
    speedGhz: number | null;
    speedMaxGhz: number | null;
    loadPercent: number;
    temperatureCelsius: number | null;
  };
  memory: {
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usagePercent: number;
  };
  gpu: {
    vendor: string;
    model: string;
    vramTotalMb: number | null;
    loadPercent: number | null;
    temperatureCelsius: number | null;
  } | null;
  disk: {
    totalBytes: number;
    usedBytes: number;
    usagePercent: number;
    temperatureCelsius: number | null;
  };
  hardwareOptions: PerformanceHardwareOptions;
}

interface PerformanceHardwareOption {
  id: string;
  label: string;
}

interface PerformanceHardwareOptions {
  cpu: PerformanceHardwareOption[];
  gpu: PerformanceHardwareOption[];
  disk: PerformanceHardwareOption[];
}

interface PerformanceHardwareSelection {
  cpu?: string;
  gpu?: string;
  disk?: string;
}

interface RunningProcessInfo {
  name: string;
  iconDataUrl: string | null;
}

interface RunningWindowInfo {
  id: string;
  title: string;
  processName: string;
  processPath: string | null;
  processId: number | null;
  iconDataUrl: string | null;
}

interface RegisterSystemIpcHandlersOptions {
  queryRunningNonSystemProcessNames: () => Promise<string[]>;
  queryRunningNonSystemProcessesWithIcons: () => Promise<RunningProcessInfo[]>;
  queryOpenWindowsWithIcons: () => Promise<RunningWindowInfo[]>;
  queryFocusedWindow: () => Promise<RunningWindowInfo | null>;
  /** 向所有窗口广播事件（用于亮度/音量实时推送），由 main/index.ts 提供 */
  broadcast?: SystemLevelBroadcast;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const numeric = finiteNumber(value);
  return numeric !== null && numeric > 0 ? numeric : null;
}

function clampPercent(value: unknown): number {
  const numeric = finiteNumber(value);
  if (numeric === null) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function indexedId(prefix: string, index: number): string {
  return `${prefix}:${index}`;
}

const INDEXED_ID_PATTERNS: Record<string, RegExp> = {
  cpu: /^cpu:(\d+)$/,
  gpu: /^gpu:(\d+)$/,
  fs: /^fs:(\d+)$/,
};

function parseIndexedId(value: unknown, prefix: string, total: number): number | null {
  if (typeof value !== 'string') return null;
  const pattern = INDEXED_ID_PATTERNS[prefix] ?? new RegExp(`^${prefix}:(\\d+)$`);
  const match = value.match(pattern);
  if (!match) return null;
  const index = Number(match[1]);
  return Number.isInteger(index) && index >= 0 && index < total ? index : null;
}

function safeHardwareLabel(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

interface ThrottledCache<T> {
  get(): Promise<T>;
  reset(): void;
}

/**
 * 构造带 TTL 和并发去重的异步缓存
 * @description 仅在 fetcher 返回非 null/undefined 时延长 TTL；并发调用共享同一次请求
 */
function createThrottledCache<T>(fetcher: () => Promise<T>, ttlMs: number): ThrottledCache<T> {
  let value: T | undefined;
  let hasValue = false;
  let expiresAt = 0;
  let inFlight: Promise<T> | null = null;
  return {
    get(): Promise<T> {
      const now = Date.now();
      if (hasValue && now < expiresAt) return Promise.resolve(value as T);
      if (inFlight) return inFlight;
      const promise = fetcher().then((next) => {
        value = next;
        hasValue = true;
        expiresAt = next === null || next === undefined ? 0 : Date.now() + ttlMs;
        inFlight = null;
        return next;
      }).catch((err) => {
        inFlight = null;
        throw err;
      });
      inFlight = promise;
      return promise;
    },
    reset(): void {
      value = undefined;
      hasValue = false;
      expiresAt = 0;
      inFlight = null;
    },
  };
}

const STATIC_TTL_MS = Number.POSITIVE_INFINITY;
const GRAPHICS_TTL_MS = 15000;
const CPU_TEMPERATURE_TTL_MS = 15000;
const FS_SIZE_TTL_MS = 10000;
const DISK_LAYOUT_TTL_MS = 60000;

const cpuStaticCache = createThrottledCache<si.Systeminformation.CpuData | null>(() => si.cpu().catch(() => null), STATIC_TTL_MS);
const graphicsCache = createThrottledCache<si.Systeminformation.GraphicsData | null>(() => si.graphics().catch(() => null), GRAPHICS_TTL_MS);
const cpuTemperatureCache = createThrottledCache<si.Systeminformation.CpuTemperatureData | null>(() => si.cpuTemperature().catch(() => null), CPU_TEMPERATURE_TTL_MS);
const fsSizeCache = createThrottledCache<si.Systeminformation.FsSizeData[]>(() => si.fsSize().catch(() => []), FS_SIZE_TTL_MS);
const diskLayoutCache = createThrottledCache<si.Systeminformation.DiskLayoutData[]>(() => si.diskLayout().catch(() => []), DISK_LAYOUT_TTL_MS);

/**
 * 重置性能快照缓存
 * @description 仅供测试代码在每个用例前隔离状态，业务代码不应调用
 */
export function resetPerformanceCachesForTesting(): void {
  cpuStaticCache.reset();
  graphicsCache.reset();
  cpuTemperatureCache.reset();
  fsSizeCache.reset();
  diskLayoutCache.reset();
}

async function collectPerformanceSnapshot(
  selection: PerformanceHardwareSelection = {},
  includeHardwareOptions = true,
): Promise<PerformanceSnapshot> {
  const [
    cpu,
    load,
    cpuTemperature,
    memory,
    graphics,
    fsSizes,
    diskLayouts,
  ] = await Promise.all([
    cpuStaticCache.get(),
    si.currentLoad().catch(() => null),
    cpuTemperatureCache.get(),
    si.mem().catch(() => null),
    graphicsCache.get(),
    fsSizeCache.get(),
    diskLayoutCache.get(),
  ]);

  const osCpus = os.cpus();
  const cpuLoadItems = Array.isArray(load?.cpus) ? load.cpus : [];
  const selectedCpuIndex = parseIndexedId(selection.cpu, 'cpu', cpuLoadItems.length);
  const cpuOptions: PerformanceHardwareOption[] = includeHardwareOptions
    ? [
      { id: 'all', label: 'All CPU' },
      ...cpuLoadItems.map((_, index) => ({
        id: indexedId('cpu', index),
        label: `CPU ${index + 1} · ${safeHardwareLabel(osCpus[index]?.model, 'Unknown CPU')}`,
      })),
    ]
    : [];
  const selectedCpuLoad = selectedCpuIndex === null ? load?.currentLoad : cpuLoadItems[selectedCpuIndex]?.load;
  const cpuTemperatureCores = Array.isArray(cpuTemperature?.cores) ? cpuTemperature.cores : [];
  const selectedCpuTemperature = selectedCpuIndex === null ? null : positiveNumber(cpuTemperatureCores[selectedCpuIndex]);

  const gpuControllers = (graphics?.controllers ?? []).filter((controller) => Boolean(controller.model || controller.vendor));
  const selectedGpuIndex = parseIndexedId(selection.gpu, 'gpu', gpuControllers.length);
  const gpu = selectedGpuIndex === null ? (gpuControllers[0] ?? null) : gpuControllers[selectedGpuIndex];
  const gpuOptions: PerformanceHardwareOption[] = includeHardwareOptions
    ? [
      { id: 'auto', label: 'Auto GPU' },
      ...gpuControllers.map((controller, index) => ({
        id: indexedId('gpu', index),
        label: [controller.vendor, controller.model].filter(Boolean).join(' ') || `GPU ${index + 1}`,
      })),
    ]
    : [];

  const fsItems = fsSizes.filter((item) => positiveNumber(item.size) !== null);
  const selectedFsIndex = parseIndexedId(selection.disk, 'fs', fsItems.length);
  const selectedFsItems = selectedFsIndex === null ? fsItems : [fsItems[selectedFsIndex]];
  const diskOptions: PerformanceHardwareOption[] = includeHardwareOptions
    ? [
      { id: 'all', label: 'All Disks' },
      ...fsItems.map((item, index) => ({
        id: indexedId('fs', index),
        label: [item.mount, item.fs].filter(Boolean).join(' · ') || `Disk ${index + 1}`,
      })),
    ]
    : [];
  const diskTotals = selectedFsItems.reduce((acc, item) => ({
    totalBytes: acc.totalBytes + Math.max(0, item.size || 0),
    usedBytes: acc.usedBytes + Math.max(0, item.used || 0),
  }), { totalBytes: 0, usedBytes: 0 });
  const selectedDiskTemperature = selectedFsIndex === null ? null : positiveNumber(diskLayouts[selectedFsIndex]?.temperature);
  const diskTemperature = diskLayouts
    .map((item) => positiveNumber(item.temperature))
    .find((value): value is number => value !== null) ?? null;
  const memoryTotal = memory?.total ?? os.totalmem();
  const memoryAvailable = memory?.available ?? os.freemem();
  const memoryUsed = memory?.used ?? Math.max(0, memoryTotal - memoryAvailable);

  return {
    timestamp: Date.now(),
    host: {
      hostname: os.hostname(),
      platform: os.platform(),
      release: os.release(),
      arch: os.arch(),
      uptimeSeconds: os.uptime(),
    },
    cpu: {
      manufacturer: cpu?.manufacturer || '',
      brand: cpu?.brand || osCpus[0]?.model || '',
      cores: cpu?.cores || osCpus.length,
      physicalCores: cpu?.physicalCores || cpu?.cores || osCpus.length,
      speedGhz: positiveNumber(cpu?.speed),
      speedMaxGhz: positiveNumber(cpu?.speedMax),
      loadPercent: clampPercent(selectedCpuLoad),
      temperatureCelsius: selectedCpuTemperature ?? positiveNumber(cpuTemperature?.main) ?? positiveNumber(cpuTemperature?.max),
    },
    memory: {
      totalBytes: memoryTotal,
      usedBytes: memoryUsed,
      availableBytes: memoryAvailable,
      usagePercent: memoryTotal > 0 ? clampPercent((memoryUsed / memoryTotal) * 100) : 0,
    },
    gpu: gpu
      ? {
        vendor: gpu.vendor || '',
        model: gpu.model || '',
        vramTotalMb: positiveNumber(gpu.vram) ?? positiveNumber(gpu.memoryTotal),
        loadPercent: finiteNumber(gpu.utilizationGpu) === null ? null : clampPercent(gpu.utilizationGpu),
        temperatureCelsius: positiveNumber(gpu.temperatureGpu),
      }
      : null,
    disk: {
      totalBytes: diskTotals.totalBytes,
      usedBytes: diskTotals.usedBytes,
      usagePercent: diskTotals.totalBytes > 0 ? clampPercent((diskTotals.usedBytes / diskTotals.totalBytes) * 100) : 0,
      temperatureCelsius: selectedDiskTemperature ?? diskTemperature,
    },
    hardwareOptions: {
      cpu: cpuOptions,
      gpu: gpuOptions,
      disk: diskOptions,
    },
  };
}

/**
 * 注册系统相关 IPC 处理器
 * @description 注册任务管理器和运行进程查询的 IPC 事件处理器
 * @param options - 配置选项，包含进程查询函数
 */
export function registerSystemIpcHandlers(options: RegisterSystemIpcHandlersOptions): void {
  ipcMain.on('system:open-task-manager', () => {
    try {
      if (process.platform === 'win32') {
        exec('taskmgr');
      }
    } catch (err) {
      console.error('[System] open-task-manager error:', err);
    }
  });

  ipcMain.handle('system:running-processes:get', async () => {
    if (process.platform !== 'win32') return [];
    return options.queryRunningNonSystemProcessNames();
  });

  ipcMain.handle('system:running-processes:with-icons:get', async () => {
    if (process.platform !== 'win32') return [];
    return options.queryRunningNonSystemProcessesWithIcons();
  });

  ipcMain.handle('system:open-windows:with-icons:get', async () => {
    if (process.platform !== 'win32') return [];
    return options.queryOpenWindowsWithIcons();
  });

  ipcMain.handle('system:focused-window:get', async () => {
    if (process.platform !== 'win32') return null;
    return options.queryFocusedWindow();
  });

  ipcMain.handle('system:brightness:get', async () => {
    if (process.platform !== 'win32') return null;
    try {
      // 走常驻 serve 进程（亚毫秒级）；旧版 EXE 时包内自动回退到一次性 spawn
      return (await getBrightnessAsync())?.currentBrightness ?? null;
    } catch (err) {
      console.error('[System] brightness:get error:', err);
      return null;
    }
  });

  ipcMain.handle('system:brightness:set', async (_event, brightness: unknown) => {
    if (process.platform !== 'win32' || typeof brightness !== 'number' || !Number.isFinite(brightness)) {
      return false;
    }
    try {
      // 异步 spawn + 最新值合并队列：不阻塞主进程消息循环（拖动高频写回不卡鼠标）
      return enqueueBrightnessSet(Math.max(0, Math.min(100, brightness)));
    } catch (err) {
      console.error('[System] brightness:set error:', err);
      return false;
    }
  });

  ipcMain.handle('system:volume:get', async () => {
    if (process.platform !== 'win32') return null;
    try {
      return await getVolumeAsync();
    } catch (err) {
      console.error('[System] volume:get error:', err);
      return null;
    }
  });

  ipcMain.handle('system:volume:set', async (_event, volume: unknown) => {
    if (process.platform !== 'win32' || typeof volume !== 'number' || !Number.isFinite(volume)) {
      return false;
    }
    try {
      // 异步 spawn + 最新值合并队列：不阻塞主进程消息循环
      return enqueueVolumeSet(Math.max(0, Math.min(100, volume)));
    } catch (err) {
      console.error('[System] volume:set error:', err);
      return false;
    }
  });

  ipcMain.handle(
    'system:performance-snapshot:get',
    async (_event, selection?: PerformanceHardwareSelection, includeHardwareOptions = true) => {
      return collectPerformanceSnapshot(selection, includeHardwareOptions);
    },
  );

  // 启动亮度/音量事件监控：系统值一变即事件驱动推送（替代渲染端轮询，零定时器、不阻塞主线程）
  startSystemLevelMonitors(options.broadcast);
}

/* ========== 亮度/音量：常驻 serve 进程 + 事件驱动推送 ==========
 *
 * 背景：helper 是 C# 程序，每次 get/set 都 spawn 新进程要启动整个 .NET 运行时
 * （实测 250-380ms），拖动滑条时写入严重滞后 → 系统值追不上 UI，还会把 UI 拉回旧值
 * 造成闪烁。serve 模式下进程常驻（stdin/stdout 行式 JSON），单次调用降到毫秒级。
 *
 * 本方案：
 *  1. get/set 全部走包内 daemon（serve 进程），旧版 EXE 时包内自动回退一次性 spawn；
 *  2. 系统值变化由 serve 进程推送（onBrightnessChanged/onVolumeChanged），零轮询；
 *  3. 写入回声抑制：set 成功后短暂窗口内，忽略 monitor 推送的旧值，杜绝「拖到 50%
 *     又闪回 25%」的回跳；
 *  4. set 仍用「最新值合并队列」——拖动高频写回不堆积，串行执行。
 */

interface PendingSetTask {
  value: number;
}

/** 亮度 set 队列：串行执行、只保留最新目标值（拖动中高频写回不堆积） */
let brightnessSetTask: PendingSetTask | null = null;
let brightnessSetRunning = false;

async function enqueueBrightnessSet(value: number): Promise<boolean> {
  brightnessSetTask = { value };
  if (brightnessSetRunning) return true;
  brightnessSetRunning = true;
  let result = false;
  while (brightnessSetTask) {
    const task = brightnessSetTask;
    brightnessSetTask = null;
    try {
      result = await setBrightnessAsync(task.value);
    } catch (err) {
      console.error('[System] brightness:set error:', err);
      result = false;
    }
    if (result) {
      // 写入成功后主动广播目标值：monitor 推送可能有延迟，避免 UI 短暂回跳
      markLocalWrite('system:brightness:changed', Math.round(task.value));
      emitLevel('system:brightness:changed', Math.round(task.value));
    }
  }
  brightnessSetRunning = false;
  return result;
}

/** 音量 set 队列：同上 */
let volumeSetTask: PendingSetTask | null = null;
let volumeSetRunning = false;

async function enqueueVolumeSet(value: number): Promise<boolean> {
  volumeSetTask = { value };
  if (volumeSetRunning) return true;
  volumeSetRunning = true;
  let result = false;
  while (volumeSetTask) {
    const task = volumeSetTask;
    volumeSetTask = null;
    try {
      result = await setVolumeAsync(task.value);
    } catch (err) {
      console.error('[System] volume:set error:', err);
      result = false;
    }
    if (result) {
      markLocalWrite('system:volume:changed', Math.round(task.value));
      emitLevel('system:volume:changed', Math.round(task.value));
    }
  }
  volumeSetRunning = false;
  return result;
}

/** 推送通道：向所有窗口广播系统亮度/音量变化 */
export type SystemLevelBroadcast = (channel: string, ...args: unknown[]) => void;

/** 全局广播句柄（由 registerSystemIpcHandlers 注入，供 set 成功后主动推送） */
let levelBroadcast: SystemLevelBroadcast = () => undefined;

/** monitor 是否已启动（幂等） */
let monitorsStarted = false;

/**
 * 写入回声抑制窗口（ms）：set 成功后此窗口内，monitor 推送的系统旧值一律忽略。
 * 根因：系统亮度/音量是异步落盘的，set 返回后系统值短暂仍是旧值，
 * WMI/CoreAudio 会先推一个旧值事件 → 渲染端把滑条拉回旧位置（闪动）。
 * 窗口内只放行「与本地写入目标一致」的推送（即系统已追上目标值的确认）。
 */
const ECHO_SUPPRESS_WINDOW_MS = 600;

/** 最近一次本地写入（按通道） */
const lastLocalWrite: Record<string, { value: number; at: number }> = {};

/** 记录一次本地写入（set 成功时调用），开启回声抑制窗口 */
function markLocalWrite(channel: string, value: number): void {
  lastLocalWrite[channel] = { value, at: Date.now() };
}

/**
 * 判断一次 monitor 推送是否应当被忽略（写入回声）。
 * @returns true = 忽略（这是 set 后系统尚未追上的旧值）
 */
function isEchoSuppressed(channel: string, value: number): boolean {
  const write = lastLocalWrite[channel];
  if (!write) return false;
  if (Date.now() - write.at > ECHO_SUPPRESS_WINDOW_MS) return false;
  // 窗口内：只有与写入目标一致才算系统确认（放行），否则视为旧值回声
  return value !== write.value;
}

/** 向所有窗口推送一条亮度/音量变化事件（带写入回声抑制） */
function emitLevel(channel: string, value: number): void {
  try {
    levelBroadcast(channel, value);
  } catch (err) {
    console.error('[System] broadcast level failed:', err);
  }
}

/** monitor 推送入口：过滤写入回声后广播 */
function onLevelPush(channel: string, value: number): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) return;
  if (isEchoSuppressed(channel, value)) return;
  emitLevel(channel, value);
}

/** 卸载时停止常驻进程与订阅（应用退出调用） */
export function stopSystemLevelMonitors(): void {
  try {
    stopBrightnessDaemon();
  } catch (err) {
    console.error('[System] stop brightness daemon error:', err);
  }
  try {
    stopVolumeDaemon();
  } catch (err) {
    console.error('[System] stop volume daemon error:', err);
  }
}

/**
 * 监控启动延迟（ms）：避开应用启动高峰，让 .NET helper 冷启动落在系统空闲期。
 */
const MONITOR_START_DELAY_MS = 4000;

/**
 * 启动系统亮度/音量事件监控（幂等）。
 * 复用常驻 serve 进程的事件推送（onBrightnessChanged/onVolumeChanged），
 * 不再单独 spawn monitor 子进程——serve 进程内部已承担 WMI/CoreAudio 监听。
 *
 * 延迟启动：应用启动的头几秒 CPU 被窗口创建、Vite 编译、杀软扫描占满，
 * 此时拉起 .NET helper 既拖慢启动手感，又容易握手超时被降级；推迟到空闲后
 * 再启动，冷启动只发生一次且几乎无感。
 */
export function startSystemLevelMonitors(broadcast?: SystemLevelBroadcast): void {
  if (process.platform !== 'win32' || monitorsStarted) return;
  monitorsStarted = true;
  if (broadcast) levelBroadcast = broadcast;

  setTimeout(subscribeLevelPushes, MONITOR_START_DELAY_MS);
}

function subscribeLevelPushes(): void {
  try {
    onBrightnessChanged((value: number) => onLevelPush('system:brightness:changed', value));
    // 首推当前值：让渲染端确认推送可用并校准缓存
    void getBrightnessAsync().then((info) => {
      const current = info?.currentBrightness ?? null;
      if (typeof current === 'number') emitLevel('system:brightness:changed', current);
    }).catch(() => undefined);
  } catch (err) {
    console.error('[System] brightness monitor start failed:', err);
  }

  try {
    onVolumeChanged((value: number) => onLevelPush('system:volume:changed', value));
    void getVolumeAsync().then((current) => {
      if (typeof current === 'number') emitLevel('system:volume:changed', current);
    }).catch(() => undefined);
  } catch (err) {
    console.error('[System] volume monitor start failed:', err);
  }
}
