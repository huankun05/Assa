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
 * @file XiyueTab.tsx
 * @description Hover 汐月 AI 页（左：头像 + 两行文案 ｜ 右：语音 / 文字两个入口）
 *
 * 布局：头像与文案水平排列（而非上下），这样在 60px 岛高下也能塞进两行文案，
 *      且与 LyricsTab「封面 + 歌词」结构同构。
 *
 * ⚠ 高度硬约束：hover 态灵动岛只有 60px（pill 态 72px），.xiyue-tab 带
 *   `contain: layout paint`，超出会被裁掉。当前行高 34px，60px 岛上下各留 13px，安全。
 *
 * @author 鸡哥
 */

import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../../../store/slices';
import { getXiyueVisibleName, getXiyueVisibleNameSync } from '../../../../../../utils/xiyueIdentity';
import {
  getSubtitle,
  MOOD_LABEL,
  type AgentMood,
} from '../config/xiyueMoodConfig';
import { XiyueAvatar } from './XiyueAvatar';
import { ChatBubbleIcon, MicrophoneIcon } from './XiyueActionIcons';
import '../../../../../../styles/hover/xiyue-tab.css';

/** 打开独立聊天窗口（复用 StandaloneWindow 架构，chat tab） */
function openStandaloneChatWindow(): void {
  window.api.openStandaloneWindow('chat').catch(() => {});
}

/**
 * Hover 汐月 AI 页
 * @description 左：状态头像 + 「名字·状态」主行 + 副行问候语；右：语音 / 文字聊天入口。
 *              mood 目前固定为 happy，后续接入 agent 真实状态后从 store 读取即可。
 * @returns 汐月 AI Tab 元素
 */
export function XiyueTab(): ReactElement {
  const { t } = useTranslation();
  const setAgentVoiceInput = useIslandStore((s) => s.setAgentVoiceInput);
  const [visibleName, setVisibleName] = useState<string>(getXiyueVisibleNameSync());

  // TODO(agent-state): 接入真实 agent 状态后改为从 store 读取，例如
  // const mood = useIslandStore((s) => s.agentMood) ?? 'happy';
  const mood: AgentMood = 'happy';

  useEffect(() => {
    getXiyueVisibleName().then(setVisibleName).catch(() => {});
  }, []);

  return (
    <div className="xiyue-tab">
      {/* 左：头像 + 两行文案 */}
      <div className="xiyue-identity">
        <XiyueAvatar mood={mood} />
        <div className="xiyue-text-block">
          <span className="xiyue-name">
            {visibleName}
            <span className="xiyue-name-sep">·</span>
            {MOOD_LABEL[mood]}
            {/* 状态点：颜色 + 呼吸频率随状态变化（绿=在线 / 蓝=思考 / 黄=待澄清 / 红=收音） */}
            <span
              className={`xiyue-status-dot xiyue-status-dot--${mood}`}
              title={MOOD_LABEL[mood]}
              aria-hidden="true"
            />
          </span>
          <span className="xiyue-sub" title={getSubtitle(mood)}>
            {getSubtitle(mood)}
          </span>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="xiyue-divider" />

      {/* 右：语音 / 文字聊天两个入口 */}
      <div className="xiyue-actions">
        <button
          className="xiyue-action-btn"
          onClick={() => setAgentVoiceInput()}
          title={t('hover.xiyue.voice', { defaultValue: '语音对话' })}
          aria-label={t('hover.xiyue.voice', { defaultValue: '语音对话' })}
        >
          <MicrophoneIcon />
        </button>
        <button
          className="xiyue-action-btn"
          onClick={() => openStandaloneChatWindow()}
          title={t('hover.xiyue.openChat', { defaultValue: '文字对话' })}
          aria-label={t('hover.xiyue.openChat', { defaultValue: '文字对话' })}
        >
          <ChatBubbleIcon />
        </button>
      </div>
    </div>
  );
}
