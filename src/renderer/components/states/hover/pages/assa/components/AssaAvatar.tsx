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
 * @file AssaAvatar.tsx
 * @description 汐月 AI 头像：人形角色（圆形头像框 + 可变换表情 + AI sparkle 标识）。
 *              双轨渲染：AVATAR_IMAGE_MAP 配了路径走图片模式，否则走内联 SVG 模式。
 *              7 种状态：calm / happy / thinking / tool / listening / confuse / speaking。
 *              头像元素带 `mood-${mood}` class，CSS 微动系统据此播放状态独特动画。
 * @author 鸡哥
 */

import type { KeyboardEvent, ReactElement } from 'react';
import { AVATAR_IMAGE_MAP, type AgentMood } from '../config/assaMoodConfig';

/**
 * 各状态的「眼 + 嘴」面部元素（SVG 模式用，图片模式不使用）
 * @description 只换眼和嘴，头部圆框与 sparkle 恒定，因此状态切换成本极低。
 *              全部使用 currentColor，配合 filter invert 实现主题适配。
 */
const FACE: Record<AgentMood, ReactElement> = {
  /** 待机：圆眼 + 平直嘴（无笑意） */
  calm: (
    <>
      <circle cx="11.9" cy="14.6" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="18.9" cy="14.6" r="1.35" fill="currentColor" stroke="none" />
      <path d="M12.8 19.8h5.2" strokeWidth="1.5" />
    </>
  ),
  /** 开心：圆眼 + 微笑 */
  happy: (
    <>
      <circle cx="11.9" cy="14.6" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="18.9" cy="14.6" r="1.35" fill="currentColor" stroke="none" />
      <path d="M12.2 19.6c1.05 1.05 2.1 1.6 3.2 1.6s2.15-.55 3.2-1.6" />
    </>
  ),
  /** 思考中：半闭眼（向下弧）+ 抿嘴 */
  thinking: (
    <>
      <path d="M10.4 14.8c.8-.85 1.9-.85 2.7 0" strokeWidth="1.5" />
      <path d="M17.7 14.8c.8-.85 1.9-.85 2.7 0" strokeWidth="1.5" />
      <path d="M13.4 20h2.9" />
    </>
  ),
  /** 操作中：圆眼 + 抿嘴（专注） */
  tool: (
    <>
      <circle cx="11.9" cy="14.6" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="18.9" cy="14.6" r="1.2" fill="currentColor" stroke="none" />
      <path d="M13.4 20h2.9" />
    </>
  ),
  /** 聆听中：睁眼 + 张嘴（小圆） */
  listening: (
    <>
      <circle cx="11.9" cy="14.6" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="18.9" cy="14.6" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="15.4" cy="19.8" r="1.5" />
    </>
  ),
  /** 困惑：一眼眯（横线）一眼睁 + 波浪嘴 */
  confuse: (
    <>
      <path d="M10.6 14.6h2.8" strokeWidth="1.5" />
      <circle cx="19" cy="14.6" r="1.35" fill="currentColor" stroke="none" />
      <path d="M12.6 20.2c.65-.85 1.3-.85 1.95 0s1.3.85 1.95 0" strokeWidth="1.5" />
    </>
  ),
  /** 说话中：圆眼 + 张嘴（椭圆） */
  speaking: (
    <>
      <circle cx="11.9" cy="14.6" r="1.35" fill="currentColor" stroke="none" />
      <circle cx="18.9" cy="14.6" r="1.35" fill="currentColor" stroke="none" />
      <ellipse cx="15.4" cy="19.8" rx="1.8" ry="2.2" />
    </>
  ),
};

/**
 * 汐月 AI 头像
 * @param mood - 当前状态，决定表情和微动动画
 * @returns 头像元素（图片 或 内联 SVG）
 */
export function AssaAvatar({ mood, onClick }: { mood: AgentMood; onClick?: () => void }): ReactElement {
  const imgSrc = AVATAR_IMAGE_MAP[mood];
  const moodClass = `mood-${mood}`;
  const interactive = typeof onClick === 'function';
  const a11y = interactive
    ? {
      role: 'button' as const,
      tabIndex: 0,
      title: '打开汐月对话',
      'aria-label': '打开汐月对话',
      onClick,
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      },
    }
    : {};

  // 图片模式：配置了路径就用图片（正式美术资源，7 种状态全部已配置）
  if (imgSrc) {
    return (
      <img
        className={`assa-avatar ${moodClass}${interactive ? ' assa-avatar--clickable' : ''}`}
        src={imgSrc}
        alt=""
        draggable={false}
        {...a11y}
        onError={(e) => {
          const el = e.currentTarget;
          if (el.dataset.fallback === '1') return;
          el.dataset.fallback = '1';
          el.src = AVATAR_IMAGE_MAP.happy ?? imgSrc;
        }}
      />
    );
  }

  // SVG 模式：单色 currentColor + filter invert 主题适配（兜底，图片加载失败时用）
  return (
    <svg
      className={`assa-avatar ${moodClass}${interactive ? ' assa-avatar--clickable' : ''}`}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={!interactive}
      focusable="false"
      {...a11y}
    >
      {/* 头像圆框：标识这是一个「角色 / 人物」 */}
      <circle cx="15.4" cy="16.2" r="10.6" />
      {/* 面部：眼 + 嘴，随状态变化 */}
      {FACE[mood]}
      {/* AI sparkle：恒定不变的 AI 身份标识 */}
      <path
        d="M27.2 3.4l.78 1.98 1.98.78-1.98.78-.78 1.98-.78-1.98-1.98-.78 1.98-.78z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
