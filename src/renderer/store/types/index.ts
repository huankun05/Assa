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
 * @file index.ts
 * @description 灵动岛 Store 类型定义
 * @author 鸡哥
 */

import type { LocationInfo } from '../../api/weather/locationApi';
import type { WeatherApiConfig } from '../../api/weather/weatherApi';
import type { TranslationLyricsResult } from '../../api/lyrics/lrcApi';
import type { MusicProviderId } from '../../../shared/musicProviderAuth';

export type { WeatherApiConfig };

/** 灵动岛 UI 状态枚举 */
export type IslandState = 'idle' | 'hover' | 'expanded' | 'notification' | 'maxExpand' | 'lyrics' | 'lyricsTranslation' | 'guide' | 'announcement' | 'agentVoiceInput' | 'agent' | 'stt' | 'cli' | 'musicProvidersLogin';

/** 灵动岛动画速度档位 */
export type AnimationSpeed = 'slow' | 'medium' | 'fast';

/** 灵动岛形态模式 */
export type IslandShapeMode = 'notch' | 'pill';

/** Hover 状态下的子标签页类型 */
export type HoverTab = 'time' | 'lyrics' | 'weather' | 'xiyue' | 'pomodoro' | 'expand' | `custom:${string}`;

/** 自定义页面定义（原则 A 后半：用户自主创建的内嵌 URL / 空白组件容器页） */
export interface CustomPageDef {
  /** 页面唯一标识 */
  id: string;
  /** 页面标题（导航点显示） */
  title: string;
  /** 模板类型：url=内嵌网页，blank=空白组件容器 */
  template: 'url' | 'blank';
  /** 内嵌网址（template=url 时必填） */
  url?: string;
}

/** 控制中心（time 页）按钮池按钮标识 */
export type ControlCenterButtonId = 'hide' | 'quit' | 'brightness' | 'volume' | 'screenshot' | 'taskManager' | 'toolbox' | 'calculator' | 'translate' | 'managePages' | 'settings';

/** 控制中心按钮池配置项（顺序 + 显隐） */
export interface ControlCenterButtonConfig {
  /** 按钮唯一标识 */
  id: ControlCenterButtonId;
  /** 是否显示 */
  visible: boolean;
}

/** Expanded 状态下的子标签页类型（时间仪表板 overview 与音乐总览 song 已移除） */
export type ExpandTab = 'hover' | 'tools' | 'translation' | 'performanceMonitor';

/** CLI 活动提供方 */
export type CliProvider = 'claude' | 'codex';

/** MaxExpand 状态下的子标签页类型 */
export type MaxExpandTab = 'aiChat' | 'todo' | 'urlFavorites' | 'localFileSearch' | 'clipboardHistory' | 'album' | 'mail' | 'memo' | 'countdown' | 'alarm' | 'toolbox' | 'miniGame' | 'stock' | 'cli' | 'settings';

/** 歌词显示模式 */
export type LrcMode = 'off' | 'info' | 'lrc';

/** 单行歌词数据类型 */
export interface LyricLine {
  text: string;
  is_current: boolean;
}

/** 逐字音节(可选), 由 karaoke 歌词源产出 */
export interface SyncedLyricSyllable {
  /** 相对于行首的起始偏移(毫秒) */
  start_offset_ms: number;
  /** 音节持续时长(毫秒) */
  duration_ms: number;
  /** 音节文本 */
  text: string;
}

/** 同步歌词行(来自 lrcApi / karaoke) */
export interface SyncedLyricLine {
  time_ms: number;
  text: string;
  /** 行持续时长(毫秒), 0 或缺省表示未知 */
  duration_ms?: number;
  /** 逐字音节数组, 存在且非空则启用逐字扫光渲染 */
  syllables?: SyncedLyricSyllable[];
}

/** 媒体信息数据类型 */
export interface MediaInfo {
  title: string;
  artist: string;
  album: string;
  duration_ms: number;
}

/** NowPlaying 原始数据结构（来自 @xiyue/windows-smtc-helper SmtcMonitor） */
export type NowPlayingInfo = {
  title: string;
  artist: string;
  album: string;
  duration_ms: number;
  position_ms: number;
  isPlaying: boolean;
  thumbnail?: string | null;
  canFastForward: boolean;
  canSkip: boolean;
  canLike: boolean;
  canChangeVolume: boolean;
  canSetOutput: boolean;
  deviceId?: string;
  /** 网易云已登录时由主进程统一解析的 songId，渲染端可据此直接取词，保证歌词与喜欢状态基于同一首歌 */
  songId?: number | null;
};

/** 歌词更新数据（后端推送的格式） */
export interface LrcUpdateData {
  text: string | null;
  title: string;
  artist: string;
  position_ms?: number;
  duration_ms?: number;
  nearby_lyrics?: LyricLine[];
}

/** 媒体变化数据 */
export interface MediaChangedData {
  title: string;
  artist: string;
  thumbnail?: string | null;
  duration_ms?: number;
}

/** 番茄钟阶段 */
export type PomodoroPhase = 'work' | 'shortBreak' | 'longBreak';

/** 倒计时数据类型 */
export interface CountdownConfig {
  targetDate: string;
  label: string;
  enabled: boolean;
}

/** 单日天气预报数据类型 */
export interface DayForecast {
  temperature: number;
  description: string;
  temperatureMax: number;
  temperatureMin: number;
  windSpeed: number;
  uvIndex: number;
  precipitationProbability: number;
  iconCode: number;
}

/** 天气数据类型定义 */
export interface WeatherData {
  temperature: number;
  description: string;
  humidity: number;
  windSpeed: number;
  uvIndex: number;
  forecast: [DayForecast, DayForecast];
  iconCode: number;
}

/** 计时器状态类型 */
export type TimerState = 'idle' | 'running' | 'paused';

/** 计时器数据接口 */
export interface TimerData {
  state: TimerState;
  remainingSeconds: number;
  inputHours: string;
  inputMinutes: string;
  inputSeconds: string;
}

/** 通知数据类型 */
export interface NotificationData {
  title: string;
  body: string;
  icon?: string;
  /** 通知类型：默认通知 / 播放源切换请求 / 有新版本 / 更新下载中 / 更新就绪 / 启动天气预警 / 剪贴板URL / 重启确认 / 外部Agent启动 / 外部Agent关闭 / 检测到 Claude Code 流事件 */
  type?: 'default' | 'source-switch' | 'update-available' | 'update-downloading' | 'update-ready' | 'weather-alert-startup' | 'clipboard-url' | 'restart-required' | 'external-agent-active' | 'external-agent-stopped' | 'cli-session-detected';
  /** 检测到 CLI session 时应切换到的提供方 */
  cliProvider?: CliProvider;
  /** 外部 Agent 名称（仅 external-agent-active / external-agent-stopped 类型） */
  agentName?: string;
  /** 请求切换到的播放源 ID（仅 source-switch 类型） */
  sourceAppId?: string;
  /** 更新版本号（用于 update-available 与 update-ready 类型） */
  updateVersion?: string;
  /** 当前更新源展示文案（用于 update-available 类型） */
  updateSourceLabel?: string;
  /** 天气预警发布时间文案（仅 weather-alert-startup 类型） */
  weatherAlertTime?: string;
  /** 启动自动检查更新时要使用的更新源（仅 weather-alert-startup 类型） */
  startupUpdateSource?: 'cloudflare-r2' | 'esa-cdn' | 'tencent-cos' | 'aliyun-oss' | 'github';
  /** 启动自动检查更新时解析后的更新源地址（仅 weather-alert-startup 类型） */
  startupUpdateResolvedUrl?: string;
  /** 检测到的 URL 列表（仅 clipboard-url 类型） */
  urls?: string[];
  /** 休息提醒条目 ID（仅默认通知中由休息提醒触发时使用） */
  breakReminderItemId?: string;
}

/** Agent Skill 定义（基于 .md 文件） */
export interface AiSkill {
  id: string;
  name: string;
  filePath: string;
  enabled: boolean;
}

/** AI 配置数据 */
export interface AiConfig {
  apiKey: string;
  endpoint: string;
  model: string;
  mcpEndpoint: string;
  systemPrompt: string;
  deepseekThinking: boolean;
  deepseekReasoningEffort: 'low' | 'medium' | 'high';
  contextLimit: 200_000 | 400_000 | 1_000_000;
  r1pxcAvatar: string;
  workspaces: string[];
  skills: AiSkill[];
  ollamaModel: string;
  ollamaBaseUrl: string;
  customApiModel: string;
  customApiMode: 'relay' | 'direct';
  sttOrbEnabled: boolean;
  orbColorA: string;
  orbColorB: string;
}

/** AI 工具调用轨迹 */
export interface AiToolCall {
  turn: number;
  tool: string;
  requestId?: string;
  purpose?: string;
  riskLevel?: string;
  durationMs?: number;
  pending?: boolean;
  arguments?: Record<string, unknown>;
  success?: boolean;
  error?: string;
  result?: unknown;
  authorizationRequired?: boolean;
  webAccessRequestId?: string;
  webAccessUrl?: string;
  webAccessResolved?: boolean;
  webAccessAllowed?: boolean;
  webAccessResolveError?: string;
}

/** AI Agent TodoList 单项 */
export interface AiTodoItem {
  id: string;
  content: string;
  status: 'pending' | 'in_progress' | 'completed';
}

/** AI Agent TodoList 快照（带时间线 turn） */
export interface AiTodoSnapshot {
  turn: number;
  items: AiTodoItem[];
}

/** AI 对话附件元信息（仅文本） */
export interface AiChatAttachment {
  name: string;
  size: number;
}

/** AI 对话单条消息 */
export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  traceId?: string;
  finalized?: boolean;
  thinkBlocks?: string[];
  thinkDurations?: number[];
  toolCalls?: AiToolCall[];
  todoSnapshots?: AiTodoSnapshot[];
  attachments?: AiChatAttachment[];
  quote?: string;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    totalTokens: number;
    source: string;
  };
}

/** AI 历史会话 */
export interface AiChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: AiChatMessage[];
}

/** AI Web 访问提示 */
export interface AiWebAccessPrompt {
  sessionId?: string;
  requestId: string;
  url: string;
  message: string;
  hostname?: string;
  siteName?: string;
  iconUrl?: string;
  domainPolicy?: 'ask' | 'allow' | 'deny';
}

// ============= Slice Interfaces =============

export type PaymentContext =
  | { type: 'pro' }
  | { type: 'recharge'; amountFen: number };

/** 设置密码上下文（OAuth 新用户注册） */
export interface SetPasswordContext {
  tempToken: string;
  suggestedUsername: string;
  email: string;
}

/** 绑定 OAuth 上下文（已有邮箱账号绑定第三方登录） */
export interface BindOAuthContext {
  tempToken: string;
  username: string;
  email: string;
}

/** 绑定邮箱上下文（OAuth 新用户绑定邮箱） */
export interface BindEmailContext {
  tempToken: string;
  suggestedUsername: string;
}

/** 岛屿状态 Slice */
export interface IslandSlice {
  state: IslandState;
  uiStateLocked: boolean;
  hoverTab: HoverTab;
  customPages: CustomPageDef[];
  controlCenterButtons: ControlCenterButtonConfig[];
  expandTab: ExpandTab;
  maxExpandTab: MaxExpandTab;
  cliProvider: CliProvider;
  notification: NotificationData;
  sttText: string;
  agentPrompt: string;
  /** 汐月 AI 情绪/工作状态（hover 页头像与状态点）— 与 AgentMood 七态对齐 */
  agentMood: 'calm' | 'happy' | 'thinking' | 'tool' | 'listening' | 'confuse' | 'speaking';

  springAnimation: boolean;
  animationSpeed: AnimationSpeed;
  shapeMode: IslandShapeMode;
  setIdle: (force?: boolean) => void;
  setHover: () => void;
  setExpanded: () => void;
  setMaxExpand: () => void;
  setLyrics: () => void;
  setLyricsTranslation: () => void;
  setNotification: (data: NotificationData) => void;

  setGuide: () => void;
  setAnnouncement: () => void;
  setAgentVoiceInput: () => void;
  setStt: (text?: string) => void;
  setAgent: (prompt?: string) => void;
  setAgentMood: (mood: IslandSlice['agentMood']) => void;
  setCli: () => void;
  toggleUiStateLock: () => boolean;
  setHoverTab: (tab: HoverTab) => void;
  addCustomPage: (def: CustomPageDef) => void;
  removeCustomPage: (id: string) => void;
  updateCustomPage: (id: string, patch: Partial<CustomPageDef>) => void;
  setCustomPages: (defs: CustomPageDef[]) => void;
  setControlCenterButtons: (config: ControlCenterButtonConfig[]) => void;
  setExpandTab: (tab: ExpandTab) => void;
  setMaxExpandTab: (tab: MaxExpandTab) => void;
  setCliProvider: (provider: CliProvider) => void;
  setSpringAnimation: (enabled: boolean) => void;
  setAnimationSpeed: (speed: AnimationSpeed) => void;
  setShapeMode: (mode: IslandShapeMode) => void;
}

/** 天气 Slice */
export interface WeatherSlice {
  lastRefreshAt: number;
  weather: WeatherData;
  location: LocationInfo | null;
  setWeather: (data: WeatherData) => void;
  fetchWeatherData: (config?: WeatherApiConfig, forceRefresh?: boolean) => Promise<void>;
}

/** 计时器 Slice */
export interface TimerSlice {
  countdown: CountdownConfig;
  timerData: TimerData;
  setCountdown: (config: Partial<CountdownConfig>) => void;
  setTimerData: (data: Partial<TimerData>) => void;
}

/** 通知 Slice */
export interface NotificationSlice {
  notification: NotificationData;
}

/** 媒体/音乐 Slice */
export interface MediaSlice {
  isMusicPlaying: boolean;
  isPlaying: boolean;
  lrcMode: LrcMode;
  currentDurationMs: number;
  currentPositionMs: number;
  currentLyricText: string | null;
  mediaInfo: MediaInfo;
  nearbyLyrics: LyricLine[];
  coverImage: string | null;
  dominantColor: [number, number, number];
  syncedLyrics: SyncedLyricLine[] | null;
  translationLyrics: TranslationLyricsResult | null;
  lyricsLoading: boolean;
  updateLrcData: (data: LrcUpdateData | null) => void;
  onMediaChanged: (data: MediaChangedData) => void;
  setPlaybackState: (isPlaying: boolean) => void;
  setLrcMode: (mode: LrcMode) => void;
  updateProgress: (position_ms: number) => void;
  setCoverImage: (cover: string | null) => void;
  setDominantColor: (color: [number, number, number]) => void;
  handleNowPlayingUpdate: (info: NowPlayingInfo | null) => void;
  setSyncedLyrics: (lyrics: SyncedLyricLine[] | null) => void;
  setTranslationLyrics: (translation: TranslationLyricsResult | null) => void;
  setLyricsLoading: (loading: boolean) => void;
}

/** AI Slice */
export interface AiSlice {
  aiConfig: AiConfig;
  setAiConfig: (config: Partial<AiConfig>) => void;

  aiChatSessions: AiChatSession[];
  activeAiChatSessionId: string;
  aiChatMessages: AiChatMessage[];
  aiChatStreaming: boolean;
  createNewAiChatSession: () => void;
  switchAiChatSession: (sessionId: string) => void;
  deleteAiChatSession: (sessionId: string) => void;
  setAiChatStreaming: (streaming: boolean) => void;
  setAiChatSessionMessages: (sessionId: string, messages: AiChatMessage[]) => void;
  markAiChatSessionReplyFinished: (sessionId: string, finishedAt?: number) => void;
  setAiChatMessageThinkDuration: (messageIndex: number, thinkIndex: number, seconds: number) => void;
  setAiChatMessages: (messages: AiChatMessage[]) => void;
  clearAiChatMessages: () => void;
  aiWebAccessPrompt: AiWebAccessPrompt | null;
  setAiWebAccessPrompt: (prompt: AiWebAccessPrompt | null) => void;
  aiWebAccessResolveError: string;
  setAiWebAccessResolveError: (message: string) => void;
}

/** 番茄钟 Slice */
export interface PomodoroSlice {
  pomodoroPhase: PomodoroPhase;
  pomodoroRemaining: number;
  pomodoroRunning: boolean;
  pomodoroCompletedCount: number;
  setPomodoroPhase: (phase: PomodoroPhase) => void;
  setPomodoroRemaining: (remaining: number) => void;
  setPomodoroRunning: (running: boolean) => void;
  setPomodoroCompletedCount: (count: number) => void;
}

/** 完整 Store 类型 */
export type IIslandStore = IslandSlice & WeatherSlice & TimerSlice & MediaSlice & AiSlice & PomodoroSlice;