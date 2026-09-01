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
 * but WITHOUT ANY WARRANTY, without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file XiyueTab.tsx
 * @description Hover 汐月 AI 页（双态：静默入口 / 语音态 / 文字态→独立聊天窗，原则）
 * @author 鸡哥
 */

import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../../../store/slices';
import { getXiyueVisibleName, getXiyueVisibleNameSync } from '../../../../../../utils/xiyueIdentity';

/** 打开独立聊天窗口（复用 StandaloneWindow 架构，chat tab） */
function openStandaloneChatWindow(): void {
  window.api.storeWrite('standalone-window-active-tab', 'chat').catch(() => {});
  window.api.openStandaloneWindow().catch(() => {});
}

/** Hover 汐月 AI 页 */
export function XiyueTab(): ReactElement {
  const { t } = useTranslation();
  const setAgentVoiceInput = useIslandStore((s) => s.setAgentVoiceInput);
  const [visibleName, setVisibleName] = useState<string>(getXiyueVisibleNameSync());

  useEffect(() => {
    getXiyueVisibleName().then(setVisibleName).catch(() => {});
  }, []);

  return (
    <div className="xiyue-tab">
      <button
        className="xiyue-entry"
        onClick={() => openStandaloneChatWindow()}
        aria-label={t('hover.xiyue.openChat', { defaultValue: `打开${visibleName} AI 对话` })}
      >
        {visibleName} AI
      </button>
      <p className="xiyue-hint">{t('hover.xiyue.hint', { defaultValue: '点击进入对话' })}</p>
      <button
        className="xiyue-voice"
        onClick={() => setAgentVoiceInput()}
        aria-label={t('hover.xiyue.voice', { defaultValue: '语音对话' })}
      >
        {t('hover.xiyue.voice', { defaultValue: '语音对话' })}
      </button>
    </div>
  );
}
