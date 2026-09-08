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
 * @file ControlCenterSettingsPage.tsx
 * @description 设置页面 - 控制中心（Hover 时间页）按钮池配置：显隐开关 + 拖拽/上下排序 + 恢复默认。
 * 视觉风格与设置页其它卡片保持一致：使用 .settings-lyrics-source-btn 作为操作按钮、.settings-card-check 作为显隐开关。
 * 数据直接读写 store 的 controlCenterButtons。
 * @author 鸡哥
 */

import { useCallback, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../../../../../store/slices';
import { CONTROL_CENTER_BUTTON_META, DEFAULT_CONTROL_CENTER_BUTTONS } from '../../../../../../../../components/config/controlCenterButtons';
import { SvgIcon } from '../../../../../../../../utils/SvgIcon';

/**
 * 渲染控制中心按钮池配置页面
 * @returns 控制中心按钮配置页面
 */
export function ControlCenterSettingsPage(): ReactElement {
  const { t } = useTranslation();
  const { controlCenterButtons, setControlCenterButtons } = useIslandStore();
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);

  const config = controlCenterButtons ?? DEFAULT_CONTROL_CENTER_BUTTONS;

  const getLabel = useCallback((id: string): string => {
    const meta = CONTROL_CENTER_BUTTON_META[id as keyof typeof CONTROL_CENTER_BUTTON_META];
    return meta ? t(meta.labelKey, { defaultValue: meta.defaultLabel }) : id;
  }, [t]);

  const handleDragStart = (idx: number): void => {
    dragIdxRef.current = idx;
  };

  const handleDragOver = (e: React.DragEvent, idx: number): void => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleDragLeave = (): void => {
    setDragOverIdx(null);
  };

  const handleDrop = (targetIdx: number): void => {
    const sourceIdx = dragIdxRef.current;
    if (sourceIdx === null || sourceIdx === targetIdx) {
      setDragOverIdx(null);
      dragIdxRef.current = null;
      return;
    }
    const updated = [...config];
    const [moved] = updated.splice(sourceIdx, 1);
    updated.splice(targetIdx, 0, moved);
    setControlCenterButtons(updated);
    setDragOverIdx(null);
    dragIdxRef.current = null;
  };

  const handleDragEnd = (): void => {
    setDragOverIdx(null);
    dragIdxRef.current = null;
  };

  const toggleVisible = (idx: number): void => {
    const updated = [...config];
    updated[idx] = { ...updated[idx], visible: !updated[idx].visible };
    setControlCenterButtons(updated);
  };

  const moveItem = (idx: number, direction: 'up' | 'down'): void => {
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= config.length) return;
    const updated = [...config];
    [updated[idx], updated[targetIdx]] = [updated[targetIdx], updated[idx]];
    setControlCenterButtons(updated);
  };

  const visibleCount = config.filter((item) => item.visible).length;

  return (
    <div className="max-expand-settings-section">
      <div className="settings-cards">
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">{t('settings.app.controlCenter.title', { defaultValue: '控制中心按钮' })}</div>
            <div className="settings-card-subtitle">
              {t('settings.app.controlCenter.hint', { defaultValue: '勾选要在 Hover 控制中心（时间页）显示的按钮，拖拽或上下调整顺序。当前显示 {{count}} / {{total}} 个按钮。', count: visibleCount, total: config.length })}
            </div>
          </div>
          <div className="maxexpand-layout-list">
            {config.map((item, idx) => (
              <div
                key={item.id}
                className={`maxexpand-layout-item${dragOverIdx === idx ? ' maxexpand-layout-item--drag-over' : ''}${!item.visible ? ' maxexpand-layout-item--disabled' : ''}`}
                draggable
                onDragStart={() => handleDragStart(idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(idx)}
                onDragEnd={handleDragEnd}
              >
                <img src={SvgIcon.DRAG} alt="" className="maxexpand-layout-item-handle-icon" />
                <span className="maxexpand-layout-item-index">{idx + 1}</span>
                <span className="maxexpand-layout-item-label">{getLabel(item.id)}</span>
                <div className="settings-card-inline-row" style={{ marginLeft: 'auto' }}>
                  <button
                    className="settings-lyrics-source-btn"
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveItem(idx, 'up')}
                    title={t('settings.app.controlCenter.moveUp', { defaultValue: '上移' })}
                  >
                    <img src={SvgIcon.MOVE_UP} alt="" className="settings-inline-icon" />
                  </button>
                  <button
                    className="settings-lyrics-source-btn"
                    type="button"
                    disabled={idx === config.length - 1}
                    onClick={() => moveItem(idx, 'down')}
                    title={t('settings.app.controlCenter.moveDown', { defaultValue: '下移' })}
                  >
                    <img src={SvgIcon.MOVE_DOWN} alt="" className="settings-inline-icon" />
                  </button>
                  <label className="settings-card-check" title={item.visible
                    ? t('settings.app.controlCenter.hideBtn', { defaultValue: '隐藏此按钮' })
                    : t('settings.app.controlCenter.showBtn', { defaultValue: '显示此按钮' })
                  }>
                    <input
                      type="checkbox"
                      checked={item.visible}
                      onChange={() => toggleVisible(idx)}
                    />
                    {item.visible
                      ? t('settings.app.controlCenter.shownLabel', { defaultValue: '显示' })
                      : t('settings.app.controlCenter.hiddenLabel', { defaultValue: '隐藏' })}
                  </label>
                </div>
              </div>
            ))}
          </div>
          <div className="settings-card-body" style={{ alignItems: 'flex-end' }}>
            <button
              className="settings-card-action-btn"
              type="button"
              onClick={() => setControlCenterButtons([...DEFAULT_CONTROL_CENTER_BUTTONS])}
              title={t('settings.app.controlCenter.resetDefault', { defaultValue: '恢复默认' })}
            >
              {t('settings.app.controlCenter.resetDefault', { defaultValue: '恢复默认' })}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
