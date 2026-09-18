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
 * @file AssaActionIcons.tsx
 * @description 汐月 AI 页右侧两个入口的线性图标（语音 / 文字聊天）。
 *              统一使用 currentColor + 1.6 描边 + 圆角端点，与 Assa 的 SvgIcon 体系一致，
 *              可被 `filter: brightness(0) invert(var(--icon-invert))` 主题适配。
 * @author 鸡哥
 */

import type { ReactElement } from 'react';

/** 图标公共属性 */
const ICON_PROPS = {
  className: 'assa-action-icon',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: 'false',
} as const;

/**
 * 麦克风图标（语音对话入口）
 * @description 胶囊形麦克风头 + 弧形支架 + 底部横杆
 * @returns 麦克风 SVG
 */
export function MicrophoneIcon(): ReactElement {
  return (
    <svg {...ICON_PROPS}>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5.5 10.5v1a6.5 6.5 0 0 0 13 0v-1" />
      <path d="M12 18.4v3.1" />
      <path d="M8.6 21.5h6.8" />
    </svg>
  );
}

/**
 * 对话气泡图标（文字聊天入口）
 * @description 圆角气泡 + 左下尾巴 + 内部两行文字，语义上明确表达「文字聊天」而非单纯的「消息」
 * @returns 气泡 SVG
 */
export function ChatBubbleIcon(): ReactElement {
  return (
    <svg {...ICON_PROPS}>
      <path d="M20.5 13.6a2 2 0 0 1-2 2h-6.1l-4.2 3.6V15.6H6.5a2 2 0 0 1-2-2V6.4a2 2 0 0 1 2-2H18.5a2 2 0 0 1 2 2z" />
      <path d="M8.6 8.2h6.8" strokeWidth="1.5" />
      <path d="M8.6 11.4h4.3" strokeWidth="1.5" />
    </svg>
  );
}
