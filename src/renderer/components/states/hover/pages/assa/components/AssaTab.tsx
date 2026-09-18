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
 * @file AssaTab.tsx
 * @description Hover 汐月 AI 页（左：头像 + 两行文案 ｜ 右：语音 / 文字两个入口）
 *
 * 布局：头像与文案水平排列（而非上下），这样在 60px 岛高下也能塞进两行文案，
 *      且与 LyricsTab「封面 + 歌词」结构同构。
 *
 * ⚠ 高度硬约束：hover 态灵动岛只有 60px（pill 态 72px），.assa-tab 带
 *   `contain: layout paint`，超出会被裁掉。当前行高 34px，60px 岛上下各留 13px，安全。
 *
 * @author 鸡哥
 */

import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../../../store/slices';
import { getAssaVisibleName, getAssaVisibleNameSync } from '../../../../../../utils/assaIdentity';
import {
  getSubtitle,
  MOOD_LABEL,
  type AgentMood,
} from '../config/assaMoodConfig';
import { AssaAvatar } from './AssaAvatar';
import { ChatBubbleIcon, MicrophoneIcon } from './AssaActionIcons';
import '../../../../../../styles/hover/assa-tab.css';

/** 打开独立聊天窗口（复用 StandaloneWindow 架构，chat tab） */
function openStandaloneChatWindow(): void {
  window.api.openStandaloneWindow('chat').catch(() => {});
}

/**
 * Hover 汐月 AI 页
 * @description 左：状态头像 + 「名字·状态」主行 + 副行问候语；右：语音 / 文字聊天入口。
 *              mood 从 store.agentMood 读取；岛内 Agent 阶段变化会写入七态之一。
 * @returns 汐月 AI Tab 元素
 */
export function AssaTab(): ReactElement {
  const { t } = useTranslation();
  const setAgentVoiceInput = useIslandStore((s) => s.setAgentVoiceInput);
  const storeMood = useIslandStore((s) => s.agentMood);
  const [visibleName, setVisibleName] = useState<string>(getAssaVisibleNameSync());

  // 接 store 真实状态：岛内 Agent 阶段变化会写入 agentMood
  const mood: AgentMood = storeMood ?? 'happy';

  useEffect(() => {
    getAssaVisibleName().then(setVisibleName).catch(() => {});
    /** 情绪 → 头像：仅在 happy 时微调，不覆盖 agent 工作态（thinking/tool 等） */
    const timer = window.setInterval(() => {
      const s = useIslandStore.getState();
      if (s.state === 'agent' || s.state === 'stt') return;
      if (s.agentMood !== 'happy') return;
      window.api?.assaEmotionGet?.().then((emo) => {
        const label = emo?.mood || emo?.state || '';
        let next: AgentMood | null = null;
        if (/兴奋|开心/.test(label)) next = 'happy';
        else if (/平静/.test(label)) next = 'calm';
        else if (/焦虑|困惑|悲伤/.test(label)) next = 'confuse';
        if (next && next !== 'happy') {
          useIslandStore.getState().setAgentMood(next);
        }
      }).catch(() => {});
    }, 12000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="assa-tab">
      {/* 左：头像 + 两行文案 */}
      <div className="assa-identity">
        {/* 头像仅展示七态表情/微动；进聊天用右侧 💬。后续：点头像 → 角色详情面板（情绪/设定），不与聊天重复 */}
        <AssaAvatar mood={mood} />
        <div className="assa-text-block">
          <span className="assa-name">
            {visibleName}
            <span className="assa-name-sep">·</span>
            {MOOD_LABEL[mood]}
            {/* 状态点：颜色 + 呼吸频率随状态变化（绿=在线 / 蓝=思考 / 黄=待澄清 / 红=收音） */}
            <span
              className={`assa-status-dot assa-status-dot--${mood}`}
              title={MOOD_LABEL[mood]}
              aria-hidden="true"
            />
          </span>
          <span className="assa-sub" title={getSubtitle(mood)}>
            {getSubtitle(mood)}
          </span>
        </div>
      </div>

      {/* 分隔线 */}
      <div className="assa-divider" />

      {/* 右：语音 / 文字聊天两个入口 */}
      <div className="assa-actions">
        <button
          className="assa-action-btn"
          onClick={() => setAgentVoiceInput()}
          title={t('hover.assa.voice', { defaultValue: '语音对话' })}
          aria-label={t('hover.assa.voice', { defaultValue: '语音对话' })}
        >
          <MicrophoneIcon />
        </button>
        <button
          className="assa-action-btn"
          onClick={() => openStandaloneChatWindow()}
          title={t('hover.assa.openChat', { defaultValue: '文字对话' })}
          aria-label={t('hover.assa.openChat', { defaultValue: '文字对话' })}
        >
          <ChatBubbleIcon />
        </button>
      </div>
    </div>
  );
}
