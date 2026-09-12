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
 * @file SettingsTab.tsx
 * @description Expanded 设置 Tab：明确打开独立设置窗（DESIGN_SYSTEM §4A）
 * @author 鸡哥
 */

import type React from 'react';
import { useTranslation } from 'react-i18next';

/**
 * 设置 Tab
 * @description 不在大面板内嵌完整设置；点击打开独立设置窗
 */
export function SettingsTab(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <div className="expand-tab-panel expand-settings-entry">
      <button
        type="button"
        className="settings-card-action-btn"
        onClick={() => { window.api.openSettingsWindow().catch(() => {}); }}
      >
        {t('expanded.settingsTab.openWindow', { defaultValue: '打开设置窗口' })}
      </button>
      <p className="expand-settings-entry-hint">
        {t('expanded.settingsTab.hint', { defaultValue: '完整设置在独立窗口中进行' })}
      </p>
    </div>
  );
}
