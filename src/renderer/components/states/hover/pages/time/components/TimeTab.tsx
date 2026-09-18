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
 * @file TimeTab.tsx
 * @description 时间 Tab 重构为"纯控制中心按钮栏"：仅放置可点击按钮，不含编辑框/只读文本。
 * 按钮来自可配置"按钮池"（store 中的 controlCenterButtons），顺序与显隐在设置「控制中心按钮」页调节。
 * @author 鸡哥
 */

import type React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SvgIcon } from '../../../../../../utils/SvgIcon';
import { openStandaloneTab } from '../../../../../../components/config/standaloneWindowKeys';
import { DEFAULT_CONTROL_CENTER_BUTTONS, getVisibleControlCenterButtons } from '../../../../../../components/config/controlCenterButtons';
import useIslandStore from '../../../../../../store/slices';
import type { ControlCenterButtonId } from '../../../../../../store/types';
import { ControlCenterPopover } from './ControlCenterPopover';
import { useActionButtons } from '../hooks/useActionButtons';
import { useToolButtons } from '../hooks/useToolButtons';
import type { ControlPanelType, TimeTabProps } from '../types/timeTabTypes';

/** 单个控制中心按钮的渲染定义（图标 + 文案 + 点击行为） */
type ControlButtonDef = {
  /** 图标路径 */
  icon: string;
  /** 国际化文案 key */
  labelKey: string;
  /** 国际化兜底文案 */
  defaultLabel: string;
  /** 点击行为 */
  onClick: () => void;
  /** 若为浮层类按钮（亮度/音量），记录其浮层类型以便设置 aria-pressed */
  popoverFor?: ControlPanelType;
};

/**
 * 时间 Tab 内容（纯控制中心按钮栏）
 * @description 一排可点击按钮：隐藏、退出、亮度、音量、截图、任务管理器、工具箱、计算器、翻译。
 * 亮度/音量点击后在按钮栏上方弹出 ControlCenterPopover 浮层（鼠标移开整个灵动岛即退回控制中心面板）。
 * 时间显示已迁移至第一档常驻，倒计时已迁移至 pomodoro 页，故本组件不再展示文本/编辑框。
 * 按钮集合由 store 的 controlCenterButtons 配置驱动（顺序 + 显隐可在设置中调节）。
 * @param props - 组件入参（fullTimeStr / lunarStr 由 HoverForm 传入，本组件 intentionally 忽略；onPopoverChange 用于通知外层隐藏 toolbar）
 * @returns 时间 Tab 元素
 */
export function TimeTab({
  fullTimeStr: _fullTimeStr,
  lunarStr: _lunarStr,
  onPopoverChange,
}: TimeTabProps & { onPopoverChange?: (active: boolean) => void }): React.ReactElement {
  const { t } = useTranslation();
  const { controlCenterButtons } = useIslandStore();
  // 当前激活的浮层面板；null 表示无浮层
  const [activePanel, setActivePanel] = useState<ControlPanelType | null>(null);

  // 浮层激活状态变化时通知外层（用于隐藏右侧 toolbar 避免穿透显示）
  useEffect(() => {
    onPopoverChange?.(activePanel !== null);
  }, [activePanel, onPopoverChange]);

  // 复用现有隐藏/退出与截图/任务管理器的逻辑
  const { handleHide, handleQuit } = useActionButtons();
  const { handleScreenshot, handleTaskManager } = useToolButtons();

  // 切换亮度/音量浮层：再次点击同一按钮则关闭
  const togglePanel = useCallback((panel: ControlPanelType) => {
    setActivePanel((current) => (current === panel ? null : panel));
  }, []);

  // 关闭浮层（鼠标离开浮层时调用）
  const closePanel = useCallback(() => {
    setActivePanel(null);
  }, []);

  // 按钮池注册表：id → 图标 / 文案 / 点击行为。顺序与显隐由 store 配置控制，此处仅确定"存在哪些按钮及各自行为"。
  const buttonRegistry = useMemo<Record<ControlCenterButtonId, ControlButtonDef>>(() => ({
    hide: { icon: SvgIcon.HIDE, labelKey: 'hover.actions.hideIsland', defaultLabel: '隐藏灵动岛', onClick: handleHide },
    quit: { icon: SvgIcon.POWER_OFF, labelKey: 'hover.actions.quitIsland', defaultLabel: '退出灵动岛', onClick: handleQuit },
    brightness: { icon: SvgIcon.BRIGHTNESS, labelKey: 'hover.media.brightness', defaultLabel: '亮度', onClick: () => togglePanel('brightness'), popoverFor: 'brightness' },
    volume: { icon: SvgIcon.VOLUME, labelKey: 'hover.media.volume', defaultLabel: '音量', onClick: () => togglePanel('volume'), popoverFor: 'volume' },
    screenshot: { icon: SvgIcon.SCREENSHOT, labelKey: 'hover.tools.screenshot', defaultLabel: '截图', onClick: () => void handleScreenshot() },
    taskManager: { icon: SvgIcon.TASK_MANAGER, labelKey: 'hover.tools.taskManager', defaultLabel: '任务管理器', onClick: handleTaskManager },
    toolbox: { icon: SvgIcon.PLUGIN, labelKey: 'hover.tools.toolbox', defaultLabel: '工具箱', onClick: () => openStandaloneTab('toolbox') },
    calculator: { icon: SvgIcon.CALCULATOR, labelKey: 'hover.tools.calculator', defaultLabel: '计算器', onClick: () => window.api.openCalculator() },
    translate: { icon: SvgIcon.LANGUAGE, labelKey: 'hover.tools.translate', defaultLabel: '翻译', onClick: () => openStandaloneTab('translate') },
    fileSearch: { icon: SvgIcon.SEARCH, labelKey: 'hover.tools.fileSearch', defaultLabel: '文件查找', onClick: () => openStandaloneTab('localFileSearch') },
    managePages: { icon: SvgIcon.MANAGE_PAGES, labelKey: 'hover.nav.managePages', defaultLabel: '管理页面', onClick: () => openStandaloneTab('customPages') },
    settings: { icon: SvgIcon.SETTING, labelKey: 'hover.nav.settings', defaultLabel: '设置', onClick: () => void window.api?.openSettingsWindow?.().catch(() => {}) },
  }), [handleHide, handleQuit, handleScreenshot, handleTaskManager, togglePanel, openStandaloneTab]);

  return (
    // 整行容器：浮层激活时只显示图标 + 紧凑滑条 + 数值（按钮栏彻底替换）；
    // 鼠标移开整个灵动岛（移出此容器）即退回控制中心面板
    <div
      className="time-tab-wrapper"
      onMouseLeave={closePanel}
    >
      {activePanel === null ? (
        // 未激活：渲染控制中心按钮栏（按 store 配置顺序渲染可见按钮）
        <div
          className="control-center-bar"
          style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center' }}
        >
          {getVisibleControlCenterButtons(controlCenterButtons ?? DEFAULT_CONTROL_CENTER_BUTTONS)
            .map((c) => {
              const def = buttonRegistry[c.id];
              if (!def) return null;
              const label = t(def.labelKey, { defaultValue: def.defaultLabel });
              // 亮度/音量按钮根据浮层激活态设置 aria-pressed
              const isPressed = def.popoverFor ? activePanel === def.popoverFor : undefined;

              return (
                <button
                  key={c.id}
                  className="action-btn"
                  onClick={def.onClick}
                  title={label}
                  aria-label={label}
                  aria-pressed={isPressed}
                >
                  <img src={def.icon} alt={label} className="action-btn-icon" />
                </button>
              );
            })}
        </div>
      ) : (
        // 激活：渲染紧凑的亮度/音量控制条（图标 + 滑条 + 数值，与原控制中心 ☀ 后那一段同款视觉）
        <ControlCenterPopover activePanel={activePanel} onClose={closePanel} />
      )}
    </div>
  );
}
