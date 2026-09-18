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
 * @description 控制中心按钮 · 所见即所得：图标条拖拽实时排序（岛同步）+ 点击显隐。
 * @author 鸡哥
 */

import { useCallback, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../../../../../store/slices';
import {
  CONTROL_CENTER_ALWAYS_VISIBLE,
  CONTROL_CENTER_BUTTON_META,
  CONTROL_CENTER_MAX_VISIBLE,
  DEFAULT_CONTROL_CENTER_BUTTONS,
  getVisibleControlCenterButtons,
  mergeControlCenterButtons,
} from '../../../../../../../../components/config/controlCenterButtons';

export function ControlCenterSettingsPage(): ReactElement {
  const { t } = useTranslation();
  const { controlCenterButtons, setControlCenterButtons } = useIslandStore();
  const [dragId, setDragId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const didDragRef = useRef(false);

  const config = mergeControlCenterButtons(controlCenterButtons ?? DEFAULT_CONTROL_CENTER_BUTTONS);
  const visibleBar = getVisibleControlCenterButtons(controlCenterButtons ?? DEFAULT_CONTROL_CENTER_BUTTONS);
  const visibleIds = new Set(visibleBar.map((item) => item.id));
  const hiddenItems = config.filter((item) => !visibleIds.has(item.id));
  const visibleCount = visibleBar.length;

  const getLabel = useCallback((id: string): string => {
    const meta = CONTROL_CENTER_BUTTON_META[id as keyof typeof CONTROL_CENTER_BUTTON_META];
    return meta ? t(meta.labelKey, { defaultValue: meta.defaultLabel }) : id;
  }, [t]);

  const getIcon = (id: string): string => {
    const meta = CONTROL_CENTER_BUTTON_META[id as keyof typeof CONTROL_CENTER_BUTTON_META];
    return meta?.icon || '';
  };

  const isFixed = (id: string): boolean => CONTROL_CENTER_ALWAYS_VISIBLE.includes(id as never);

  /**
   * 拖到目标位时立刻 reorder 写入 store → 岛控制中心实时同步
   * @param targetId - 目标按钮 id
   */
  const liveReorderTo = (targetId: string): void => {
    const sourceId = dragIdRef.current;
    if (!sourceId || sourceId === targetId) return;
    const sourceIdx = config.findIndex((item) => item.id === sourceId);
    const targetIdx = config.findIndex((item) => item.id === targetId);
    if (sourceIdx < 0 || targetIdx < 0 || sourceIdx === targetIdx) return;
    const updated = [...config];
    const [moved] = updated.splice(sourceIdx, 1);
    updated.splice(targetIdx, 0, moved);
    setControlCenterButtons(updated);
  };

  const handleDragStart = (id: string): void => {
    dragIdRef.current = id;
    setDragId(id);
    didDragRef.current = false;
  };

  const handleDragOverItem = (e: React.DragEvent, id: string): void => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    didDragRef.current = true;
    if (dragIdRef.current && dragIdRef.current !== id) {
      liveReorderTo(id);
    }
  };

  const handleDragEnd = (): void => {
    dragIdRef.current = null;
    setDragId(null);
    // 稍后再允许 click（避免拖完误触发「移除」）
    window.setTimeout(() => { didDragRef.current = false; }, 80);
  };

  const hideFromBar = (id: string): void => {
    if (isFixed(id)) return;
    const next = config.map((item) => (
      item.id === id ? { ...item, visible: false } : item
    ));
    if (!next.some((item) => item.visible && !isFixed(item.id))) {
      const firstOther = next.find((item) => !isFixed(item.id));
      if (firstOther) firstOther.visible = true;
    }
    setControlCenterButtons(next);
  };

  const showInBar = (id: string): void => {
    if (visibleCount >= CONTROL_CENTER_MAX_VISIBLE) return;
    const next = config.map((item) => (
      item.id === id ? { ...item, visible: true } : item
    ));
    setControlCenterButtons(next);
  };

  return (
    <div className="max-expand-settings-section">
      <div className="settings-cards">
        <div className="settings-card">
          <div className="settings-card-header">
            <div className="settings-card-title">
              {t('settings.app.controlCenter.title', { defaultValue: '控制中心按钮' })}
            </div>
            <div className="settings-card-subtitle">
              {t('settings.app.controlCenter.hint', {
                defaultValue: '拖动图标调整顺序；点击图标从条上移除（设置/页面管理固定）。最多 {{max}} 个，当前 {{count}}。',
                count: visibleCount,
                max: CONTROL_CENTER_MAX_VISIBLE,
              })}
            </div>
          </div>

          <div
            className={`cc-wysiwyg-bar${dragId ? ' is-dragging' : ''}`}
            aria-label={t('settings.app.controlCenter.previewBar', { defaultValue: '控制中心预览（可拖拽）' })}
          >
            {visibleBar.map((item) => {
              const fixed = isFixed(item.id);
              const label = getLabel(item.id);
              const dragging = dragId === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={[
                    'cc-wysiwyg-icon',
                    dragging ? 'is-dragging' : '',
                    fixed ? 'is-fixed' : '',
                  ].filter(Boolean).join(' ')}
                  draggable
                  title={fixed
                    ? t('settings.app.controlCenter.alwaysVisible', { defaultValue: '固定显示，不可移除' })
                    : t('settings.app.controlCenter.clickHide', { defaultValue: '点击从条上移除' })}
                  aria-label={label}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', item.id);
                    handleDragStart(item.id);
                  }}
                  onDragOver={(e) => handleDragOverItem(e, item.id)}
                  onDragEnd={handleDragEnd}
                  onClick={() => {
                    if (didDragRef.current) return;
                    hideFromBar(item.id);
                  }}
                >
                  <img src={getIcon(item.id)} alt="" className="cc-wysiwyg-img" draggable={false} />
                  <span className="cc-wysiwyg-label">{label}</span>
                </button>
              );
            })}
            {visibleBar.length === 0 && (
              <div className="cc-wysiwyg-empty">
                {t('settings.app.controlCenter.emptyBar', { defaultValue: '条上无按钮，请从下方添加' })}
              </div>
            )}
          </div>

          <div className="cc-wysiwyg-hint">
            {t('settings.app.controlCenter.poolHint', {
              defaultValue: '未显示（点击加入控制中心）：最多同时显示 {{max}} 个。',
              max: CONTROL_CENTER_MAX_VISIBLE,
            })}
          </div>

          <div className="cc-wysiwyg-pool">
            {hiddenItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="cc-wysiwyg-icon is-hidden"
                disabled={visibleCount >= CONTROL_CENTER_MAX_VISIBLE}
                title={t('settings.app.controlCenter.clickShow', { defaultValue: '点击加入控制中心' })}
                aria-label={getLabel(item.id)}
                onClick={() => showInBar(item.id)}
              >
                <img src={getIcon(item.id)} alt="" className="cc-wysiwyg-img" draggable={false} />
                <span className="cc-wysiwyg-label">{getLabel(item.id)}</span>
              </button>
            ))}
            {hiddenItems.length === 0 && (
              <div className="cc-wysiwyg-empty">
                {t('settings.app.controlCenter.allShown', { defaultValue: '全部按钮已在控制中心显示' })}
              </div>
            )}
          </div>

          <div className="settings-card-body" style={{ alignItems: 'flex-end', marginTop: 10 }}>
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
