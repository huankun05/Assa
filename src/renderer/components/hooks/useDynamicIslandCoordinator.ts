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
 * @file useDynamicIslandCoordinator.ts
 * @description 灵动岛主协调 Hook，整合状态、订阅与渲染数据。
 * @author 鸡哥
 */

import useIslandStore from '../../store/slices';
import { useDynamicIslandShell } from './useDynamicIslandShell';
import { useIslandDominantColor } from './useIslandDominantColor';
import { useIslandTimeStrings } from './useIslandTimeStrings';
import { useIslandHoverInteraction } from './useIslandHoverInteraction';
import { useIslandNowPlayingSync } from './useIslandNowPlayingSync';
import { useIslandNotificationSubscriptions } from './useIslandNotificationSubscriptions';
import { useIslandSettingsSync } from './useIslandSettingsSync';
import { useIslandStartupAnnouncements } from './useIslandStartupAnnouncements';
import { useIslandTimerAndAlarm } from './useIslandTimerAndAlarm';
import { useIslandBreakReminder } from './useIslandBreakReminder';
import { useIslandBackgroundVideoSync } from './useIslandBackgroundVideoSync';
import { useIslandStateBridges } from './useIslandStateBridges';
import { useIslandBackgroundMediaController } from './useIslandBackgroundMediaController';
import { useIslandEscapeNavigation } from './useIslandEscapeNavigation';
import { useIslandShellPresentation } from './useIslandShellPresentation';
import { useIslandRuntimeRefs } from './useIslandRuntimeRefs';
import { useIslandDrag } from './useIslandDrag';
import { useIslandAutoDim } from './useIslandAutoDim';
import { useClaudeCliSessionStatus } from './useClaudeCliSessionStatus';

interface UseDynamicIslandCoordinatorOptions {
  t: (key: string, options?: Record<string, unknown>) => string;
  language: string | undefined;
}

interface DynamicIslandCoordinatorState {
  shellClassName: string;
  shellStyle: React.CSSProperties | undefined;
  handleIslandClick: () => void;
  handleIslandContextMenu: (event: React.MouseEvent) => void;
  timeStr: string;
  dayStr: string;
  fullTimeStr: string;
  lunarStr: string;
  bgMedia: { type: 'image' | 'video'; previewUrl: string } | null;
  bgVideoElementRef: React.MutableRefObject<HTMLVideoElement | null>;
  bgVideoHwDecode: boolean;
  bgVideoMuted: boolean;
  bgVideoVolume: number;
  bgVideoFit: 'cover' | 'contain';
  handleVideoLoadedMetadata: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
  handleVideoCanPlay: (event: React.SyntheticEvent<HTMLVideoElement>) => void;
}

/**
 * @description 协调灵动岛运行时逻辑并返回渲染所需状态。
 * @param options - 协调器初始化参数。
 * @returns 灵动岛渲染所需的聚合状态。
 */
export function useDynamicIslandCoordinator(options: UseDynamicIslandCoordinatorOptions): DynamicIslandCoordinatorState {
  const { t, language } = options;
  /**
   * 响应式字段用 selector 订阅。
   * 动作本身在 zustand 中是稳定的，可从 getState() 一次取出。
   * 注意：currentPositionMs 等高频字段不在此订阅——
   * 歌词 UI 组件自行用 selector 订阅，桥接逻辑用 getState() 读当前值。
   */
  const state = useIslandStore((s) => s.state);
  const timerData = useIslandStore((s) => s.timerData);
  const isMusicPlaying = useIslandStore((s) => s.isMusicPlaying);
  const isPlaying = useIslandStore((s) => s.isPlaying);
  const coverImage = useIslandStore((s) => s.coverImage);
  const dominantColor = useIslandStore((s) => s.dominantColor);
  const springAnimation = useIslandStore((s) => s.springAnimation);
  const animationSpeed = useIslandStore((s) => s.animationSpeed);
  const shapeMode = useIslandStore((s) => s.shapeMode);
  const syncedLyrics = useIslandStore((s) => s.syncedLyrics);
  const lyricsLoading = useIslandStore((s) => s.lyricsLoading);
  const translationLyrics = useIslandStore((s) => s.translationLyrics);

  const {
    setHover,
    setIdle,
    setExpanded,
    setCli,
    setLyrics,
    setLyricsTranslation,
    setHoverTab,
    setAnnouncement,
    setAgentVoiceInput,
    setTimerData,
    setNotification,
    handleNowPlayingUpdate,
    updateProgress,
    setDominantColor,
    setSyncedLyrics,
    setTranslationLyrics,
    setLyricsLoading,
  } = useIslandStore.getState();

  const {
    initRef,
    isHoveringRef,
    enterTimerRef,
    leaveTimerRef,
    setNotificationRef,
    expandLeaveIdleRef,
    maxExpandLeaveIdleRef,
    idleClickExpandRef,
    pendingAnnouncementAfterGuideRef,
    pendingAnnouncementAppVersionRef,
    startupAutoCheckHandledRef,
    autoDimEnabledRef,
    autoDimDelayRef,
    positionLockedRef,
    tempHideUntilRef,
    requireLeaveAfterTempHideRef,
  } = useIslandRuntimeRefs({
    setNotification,
  });

  const { hasActiveSessionRef: hasActiveCliSessionRef } = useClaudeCliSessionStatus();
  const tempHideEnabledRef = useRef<boolean | null>(null);
  const tempHideDurationMsRef = useRef<number>(3000);

  useEffect(() => {
    let cancelled = false;
    void window.api.storeRead('temp-hide-enabled').then((v) => {
      if (cancelled) return;
      tempHideEnabledRef.current = v !== false;
    }).catch(() => {});
    void window.api.storeRead('temp-hide-duration-sec').then((v) => {
      if (cancelled) return;
      const n = Number(v);
      tempHideDurationMsRef.current = Number.isFinite(n) && n >= 1 ? Math.min(30, Math.floor(n)) * 1000 : 3000;
    }).catch(() => {});
    const unsub = window.api.onSettingsChanged?.((channel: string, value: unknown) => {
      if (channel === 'store:temp-hide-enabled') tempHideEnabledRef.current = value !== false;
      if (channel === 'store:temp-hide-duration-sec') {
        const n = Number(value);
        tempHideDurationMsRef.current = Number.isFinite(n) && n >= 1 ? Math.min(30, Math.floor(n)) * 1000 : 3000;
      }
    });
    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const {
    bgOpacityRef,
    bgBlurRef,
    bgVideoFit,
    bgVideoMuted,
    bgVideoLoop,
    bgVideoVolume,
    bgVideoRate,
    bgVideoHwDecode,
    bgVideoElementRef,
    bgMedia,
    setBgVideoFit,
    setBgVideoMuted,
    setBgVideoLoop,
    setBgVideoVolume,
    setBgVideoRate,
    setBgVideoHwDecode,
    applyBgMedia,
    handleVideoLoadedMetadata,
    handleVideoCanPlay,
  } = useIslandBackgroundMediaController();

  const {
    morphing,
    fromState,
    showGlow,
    handleIslandClick,
  } = useDynamicIslandShell({
    state,
    animationSpeed,
    isMusicPlaying,
    coverImage,
    isPlaying,
    setHover,
    setExpanded,
    setCli,
    setHoverTab,
    hasActiveCliSessionRef,
    idleClickExpandRef,
    isHoveringRef,
    forceClickToHover: shapeMode === 'pill',
  });

  useIslandNowPlayingSync({
    handleNowPlayingUpdate,
    updateProgress,
    setSyncedLyrics,
    setTranslationLyrics,
    setLyricsLoading,
  });

  useIslandDominantColor({
    coverImage,
    setDominantColor,
  });

  const {
    timeStr,
    dayStr,
    fullTimeStr,
    lunarStr,
  } = useIslandTimeStrings({
    t,
    language,
  });

  useIslandTimerAndAlarm({
    language,
    timerData,
    setTimerData,
    setNotificationRef,
    t,
  });

  useIslandBreakReminder({
    language,
    setNotificationRef,
    t,
  });

  useIslandSettingsSync({
    language,
    initRef,
    setNotificationRef,
    applyBgMedia,
    expandLeaveIdleRef,
    maxExpandLeaveIdleRef,
    idleClickExpandRef,
    bgOpacityRef,
    bgBlurRef,
    setBgVideoFit,
    setBgVideoMuted,
    setBgVideoLoop,
    setBgVideoVolume,
    setBgVideoRate,
    setBgVideoHwDecode,
    autoDimEnabledRef,
    autoDimDelayRef,
    positionLockedRef,
  });

  useIslandAutoDim({
    autoDimEnabledRef,
    autoDimDelayRef,
  });

  useIslandStateBridges({
    state,
    timerState: timerData?.state ?? 'idle',
    isPlaying,
    syncedLyrics,
    lyricsLoading,
    translationLyrics,
    setLyrics,
    setLyricsTranslation,
    setAgentVoiceInput,
    setIdle,
  });

  useIslandEscapeNavigation({
    state,
    setIdle,
    setHover,
    setExpanded,
  });

  useIslandStartupAnnouncements({
    language,
    state,
    setAnnouncement,
    startupAutoCheckHandledRef,
    pendingAnnouncementAfterGuideRef,
    pendingAnnouncementAppVersionRef,
    setNotificationRef,
    t,
  });

  useIslandBackgroundVideoSync({
    bgMedia,
    bgVideoElementRef,
    bgVideoVolume,
    bgVideoRate,
    bgVideoLoop,
    bgVideoHwDecode,
  });

  useIslandNotificationSubscriptions({
    language,
    t,
    setNotificationRef,
  });

  useIslandHoverInteraction({
    state,
    setHover,
    setIdle,
    setLyrics,
    setLyricsTranslation,
    setHoverTab,
    isHoveringRef,
    idleClickExpandRef,
    expandLeaveIdleRef,
    maxExpandLeaveIdleRef,
    enterTimerRef,
    leaveTimerRef,
    forceClickToHover: shapeMode === 'pill',
    tempHideUntilRef,
    requireLeaveAfterTempHideRef,
  });

  /** 右键让路：临时隐藏，默认 3 秒，可在设置中开关与时长 */
  const handleIslandContextMenu = (event: React.MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    const enabled = tempHideEnabledRef.current;
    if (enabled === false) return;
    const durationMs = tempHideDurationMsRef.current || 3000;
    isHoveringRef.current = false;
    setIdle(true);
    window.api?.enableMousePassthrough();
    tempHideUntilRef.current = Date.now() + durationMs;
    requireLeaveAfterTempHideRef.current = true;
    window.api?.hideWindowTemporarily?.(durationMs);
  };

  const {
    shellClassName,
    shellStyle,
  } = useIslandShellPresentation({
    state,
    morphing,
    fromState,
    showGlow,
    springAnimation,
    animationSpeed,
    shapeMode,
    dominantColor,
  });

  const { wrapClick } = useIslandDrag({ shapeMode, state, positionLockedRef });

  return {
    shellClassName,
    shellStyle,
    handleIslandClick: wrapClick(handleIslandClick),
    handleIslandContextMenu,
    timeStr,
    dayStr,
    fullTimeStr,
    lunarStr,
    bgMedia,
    bgVideoElementRef,
    bgVideoHwDecode,
    bgVideoMuted,
    bgVideoVolume,
    bgVideoFit,
    handleVideoLoadedMetadata,
    handleVideoCanPlay,
  };
}
