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
 * @file CustomPageManager.tsx
 * @description 页面管理：收纳栏式分组（点击展开），管独立窗 Tab / 控制中心按钮 / 岛布局与自定义页。
 * @author 鸡哥
 */

import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../../store/slices';
import { TAB_LIST } from '../../../../../components/config/standaloneWindowConfig';
import { STANDALONE_TAB_LAYOUT_KEY } from '../../../../../components/config/standaloneWindowKeys';
import { ControlCenterSettingsPage } from '../setting/components/app/components/ControlCenterSettingsPage';
import { ExpandLayoutSettingsPage } from '../setting/components/app/components/ExpandLayoutSettingsPage';
import { MaxExpandLayoutSettingsPage } from '../setting/components/app/components/MaxExpandLayoutSettingsPage';
import {
  DEFAULT_EXPAND_NAV_LAYOUT,
  DEFAULT_MAXEXPAND_NAV_LAYOUT,
  EXPAND_NAV_LAYOUT_STORE_KEY,
  MAXEXPAND_NAV_LAYOUT_STORE_KEY,
  normalizeExpandNavLayoutConfig,
  normalizeMaxExpandNavLayoutConfig,
  type ExpandNavLayoutConfig,
  type MaxExpandNavLayoutConfig,
} from '../setting/utils/settingsConfig';

type SectionId = 'tabs' | 'controlCenter' | 'expand' | 'maxExpand' | 'customPages';

interface SectionMeta {
  id: SectionId;
  titleKey: string;
  defaultTitle: string;
  hintKey: string;
  defaultHint: string;
}

const SECTIONS: SectionMeta[] = [
  {
    id: 'tabs',
    titleKey: 'settings.customPages.tabsTitle',
    defaultTitle: '窗口 Tab 显示',
    hintKey: 'settings.customPages.tabsHint',
    defaultHint: '控制独立窗口顶部有哪些功能页',
  },
  {
    id: 'controlCenter',
    titleKey: 'settings.app.controlCenter.title',
    defaultTitle: '控制中心按钮',
    hintKey: 'settings.customPages.ccHint',
    defaultHint: 'Hover 控制中心条上显示哪些按钮、顺序与显隐',
  },
  {
    id: 'expand',
    titleKey: 'settings.app.expandLayout.title',
    defaultTitle: '展开态布局',
    hintKey: 'settings.customPages.expandLayoutHint',
    defaultHint: '展开态（第二档）显示哪些页面与顺序',
  },
  {
    id: 'maxExpand',
    titleKey: 'settings.app.maxExpandLayout.title',
    defaultTitle: '全展开布局',
    hintKey: 'settings.customPages.maxExpandLayoutHint',
    defaultHint: '最大展开态页面顺序与可见性',
  },
  {
    id: 'customPages',
    titleKey: 'settings.customPages.customPagesTitle',
    defaultTitle: '岛自定义页',
    hintKey: 'settings.customPages.customPagesHint',
    defaultHint: '内嵌网页 / 空白容器，出现在岛 Hover 导航点',
  },
];

/**
 * 页面管理：默认收起，点击分组标题展开。
 */
export function CustomPageManager(): ReactElement {
  const { t } = useTranslation();
  const customPages = useIslandStore((s) => s.customPages);
  const addCustomPage = useIslandStore((s) => s.addCustomPage);
  const removeCustomPage = useIslandStore((s) => s.removeCustomPage);
  const updateCustomPage = useIslandStore((s) => s.updateCustomPage);
  const standaloneTabLayout = useIslandStore((s) => s.standaloneTabLayout);
  const setStandaloneTabLayout = useIslandStore((s) => s.setStandaloneTabLayout);

  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<'url' | 'blank'>('url');
  const [url, setUrl] = useState('');
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);
  const [expandNavLayout, setExpandNavLayout] = useState<ExpandNavLayoutConfig>(DEFAULT_EXPAND_NAV_LAYOUT);
  const [maxExpandNavLayout, setMaxExpandNavLayout] = useState<MaxExpandNavLayoutConfig>(DEFAULT_MAXEXPAND_NAV_LAYOUT);
  /** 默认只展开第一个收纳栏 */
  const [openSections, setOpenSections] = useState<Set<SectionId>>(() => new Set<SectionId>(['tabs']));

  const toggleSection = (id: SectionId): void => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    let cancelled = false;
    window.api.storeRead(EXPAND_NAV_LAYOUT_STORE_KEY).then((data: unknown) => {
      if (!cancelled) setExpandNavLayout(normalizeExpandNavLayoutConfig(data));
    }).catch(() => {});
    window.api.storeRead(MAXEXPAND_NAV_LAYOUT_STORE_KEY).then((data: unknown) => {
      if (!cancelled) setMaxExpandNavLayout(normalizeMaxExpandNavLayoutConfig(data));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const updateExpandNavLayout = (layout: ExpandNavLayoutConfig): void => {
    const normalized = normalizeExpandNavLayoutConfig(layout);
    setExpandNavLayout(normalized);
    window.api.storeWrite(EXPAND_NAV_LAYOUT_STORE_KEY, normalized).catch(() => {});
    window.dispatchEvent(new CustomEvent('expand-nav-layout-changed', { detail: normalized }));
  };

  const updateMaxExpandNavLayout = (layout: MaxExpandNavLayoutConfig): void => {
    const normalized = normalizeMaxExpandNavLayoutConfig(layout);
    setMaxExpandNavLayout(normalized);
    window.api.storeWrite(MAXEXPAND_NAV_LAYOUT_STORE_KEY, normalized).catch(() => {});
    window.dispatchEvent(new CustomEvent('maxexpand-nav-layout-changed', { detail: normalized }));
  };

  useEffect(() => {
    let cancelled = false;
    window.api.storeRead(STANDALONE_TAB_LAYOUT_KEY).then((value: unknown) => {
      if (cancelled || !Array.isArray(value)) return;
      const seen = new Set<string>();
      const layout = value
        .filter((item): item is { id: string; visible: boolean } => Boolean(item) && typeof (item as { id?: unknown }).id === 'string')
        .map((item) => ({ id: item.id, visible: item.visible !== false }));
      layout.forEach((item) => seen.add(item.id));
      TAB_LIST.forEach((tab) => {
        if (!seen.has(tab.key)) layout.push({ id: tab.key, visible: true });
      });
      setStandaloneTabLayout(layout);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [setStandaloneTabLayout]);

  const tabLabel = (id: string): string => {
    const found = TAB_LIST.find((tab) => tab.key === id);
    return found ? t(found.labelKey) : id;
  };

  const toggleTab = (id: string): void => {
    const next = standaloneTabLayout.map((item) => (
      item.id === id ? { ...item, visible: !item.visible } : item
    ));
    if (!next.some((item) => item.visible)) return;
    setStandaloneTabLayout(next);
  };

  const handleTabDragStart = (idx: number): void => {
    dragIdxRef.current = idx;
  };

  const handleTabDragOver = (e: React.DragEvent, idx: number): void => {
    e.preventDefault();
    setDragOverIdx(idx);
  };

  const handleTabDrop = (targetIdx: number): void => {
    const sourceIdx = dragIdxRef.current;
    setDragOverIdx(null);
    dragIdxRef.current = null;
    if (sourceIdx === null || sourceIdx === targetIdx) return;
    const next = [...standaloneTabLayout];
    const [moved] = next.splice(sourceIdx, 1);
    next.splice(targetIdx, 0, moved);
    setStandaloneTabLayout(next);
  };

  const handleAdd = (): void => {
    const nextTitle = title.trim();
    if (!nextTitle) {
      setMessage({
        type: 'error',
        text: t('settings.customPages.messages.titleRequired', { defaultValue: '请先填写页面标题' }),
      });
      return;
    }
    const id = `p_${Date.now().toString(36)}`;
    addCustomPage({
      id,
      title: nextTitle,
      template,
      url: template === 'url' ? url.trim() || undefined : undefined,
    });
    setTitle('');
    setUrl('');
    setTemplate('url');
    setMessage({
      type: 'success',
      text: t('settings.customPages.messages.added', { defaultValue: '已添加' }),
    });
  };

  const renderSectionBody = (id: SectionId): ReactElement | null => {
    if (!openSections.has(id)) return null;
    if (id === 'tabs') {
      return (
        <ul className="cw-tab-layout-list">
          {(standaloneTabLayout.length ? standaloneTabLayout : TAB_LIST.map((tab) => ({ id: tab.key, visible: true })))
            .map((item, index) => (
              <li
                key={item.id}
                className={`cw-tab-layout-item${dragOverIdx === index ? ' is-dragover' : ''}`}
                draggable
                onDragStart={() => handleTabDragStart(index)}
                onDragOver={(e) => handleTabDragOver(e, index)}
                onDragLeave={() => setDragOverIdx(null)}
                onDrop={() => handleTabDrop(index)}
                onDragEnd={() => { setDragOverIdx(null); dragIdxRef.current = null; }}
              >
                <span className="cw-tab-layout-handle" aria-hidden="true">⋮⋮</span>
                <label className="cw-tab-layout-check">
                  <input
                    type="checkbox"
                    checked={item.visible}
                    onChange={() => toggleTab(item.id)}
                  />
                  <span>{tabLabel(item.id)}</span>
                </label>
              </li>
            ))}
        </ul>
      );
    }
    if (id === 'controlCenter') return <ControlCenterSettingsPage />;
    if (id === 'expand') {
      return (
        <ExpandLayoutSettingsPage
          expandNavLayout={expandNavLayout}
          updateExpandNavLayout={updateExpandNavLayout}
        />
      );
    }
    if (id === 'maxExpand') {
      return (
        <MaxExpandLayoutSettingsPage
          maxExpandNavLayout={maxExpandNavLayout}
          updateMaxExpandNavLayout={updateMaxExpandNavLayout}
        />
      );
    }
    if (id === 'customPages') {
      return (
        <>
          <div className="settings-hotkey-row">
            <label className="settings-field" style={{ flex: 1 }}>
              <span className="settings-field-label">
                {t('settings.customPages.titleLabel', { defaultValue: '页面标题' })}
              </span>
              <input
                className="settings-field-input"
                placeholder={t('settings.customPages.titlePlaceholder', { defaultValue: '例如：文档 / B站' })}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
          </div>
          <div className="settings-lyrics-source-options" style={{ marginBottom: 10 }}>
            <button
              type="button"
              className={`settings-lyrics-source-btn${template === 'url' ? ' active' : ''}`}
              onClick={() => setTemplate('url')}
            >
              {t('settings.customPages.templateUrl', { defaultValue: '内嵌网页' })}
            </button>
            <button
              type="button"
              className={`settings-lyrics-source-btn${template === 'blank' ? ' active' : ''}`}
              onClick={() => setTemplate('blank')}
            >
              {t('settings.customPages.templateBlank', { defaultValue: '空白容器' })}
            </button>
          </div>
          {template === 'url' && (
            <div className="settings-hotkey-row">
              <label className="settings-field" style={{ flex: 1 }}>
                <span className="settings-field-label">
                  {t('settings.customPages.urlLabel', { defaultValue: '网址' })}
                </span>
                <input
                  className="settings-field-input"
                  placeholder={t('settings.customPages.urlPlaceholder', { defaultValue: 'https://...' })}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </label>
            </div>
          )}
          <div className="settings-hotkey-row">
            <button className="settings-hotkey-btn" type="button" onClick={handleAdd}>
              {t('settings.customPages.addButton', { defaultValue: '添加页面' })}
            </button>
          </div>
          {message && (
            <div
              className="settings-music-hint"
              style={{ color: message.type === 'error' ? '#ff7f7f' : '#7be495' }}
            >
              {message.text}
            </div>
          )}
          <ul className="cw-page-list" style={{ marginTop: 10 }}>
            {customPages.length === 0 && (
              <li className="cw-page-empty">
                {t('settings.customPages.empty', { defaultValue: '暂无自定义页面' })}
              </li>
            )}
            {customPages.map((p) => (
              <li key={p.id} className="cw-page-item">
                <div className="cw-page-item-info">
                  <span className="cw-page-item-title">{p.title}</span>
                  <span className="cw-page-item-meta">
                    {p.template === 'url'
                      ? (p.url || t('settings.customPages.noUrl', { defaultValue: '未配置网址' }))
                      : t('settings.customPages.blankTag', { defaultValue: '空白容器' })}
                  </span>
                </div>
                <div className="cw-page-item-actions">
                  {p.template === 'url' && (
                    <button
                      className="settings-hotkey-btn"
                      type="button"
                      onClick={() => {
                        const nu = window.prompt(t('settings.customPages.editUrlPrompt', { defaultValue: '修改网址' }), p.url ?? '');
                        if (nu !== null) updateCustomPage(p.id, { url: nu.trim() || undefined });
                      }}
                    >
                      {t('settings.customPages.editUrl', { defaultValue: '改网址' })}
                    </button>
                  )}
                  <button
                    className="settings-hotkey-btn"
                    type="button"
                    onClick={() => {
                      if (window.confirm(t('settings.customPages.confirmDelete', { defaultValue: '确定删除页面「{{title}}」？', title: p.title }))) {
                        removeCustomPage(p.id);
                      }
                    }}
                  >
                    {t('settings.customPages.delete', { defaultValue: '删除' })}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      );
    }
    return null;
  };

  return (
    <div className="cw-page-manager">
      <div className="cw-page-manager-header">
        <h2 className="cw-page-manager-title">
          {t('settings.customPages.title', { defaultValue: '页面管理' })}
        </h2>
        <p className="cw-page-manager-desc">
          {t('settings.customPages.hubDesc', {
            defaultValue: '收纳「显示什么」：窗口 Tab、控制中心、岛布局与自定义页。点击分组展开。',
          })}
        </p>
      </div>

      <div className="cw-accordion">
        {SECTIONS.map((section) => {
          const open = openSections.has(section.id);
          return (
            <div key={section.id} className={`cw-accordion-item${open ? ' is-open' : ''}`}>
              <button
                type="button"
                className="cw-accordion-header"
                onClick={() => toggleSection(section.id)}
                aria-expanded={open}
              >
                <span className="cw-accordion-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
                <span className="cw-accordion-text">
                  <span className="cw-accordion-title">
                    {t(section.titleKey, { defaultValue: section.defaultTitle })}
                  </span>
                  <span className="cw-accordion-hint">
                    {t(section.hintKey, { defaultValue: section.defaultHint })}
                  </span>
                </span>
              </button>
              {open && (
                <div className="cw-accordion-body">
                  {renderSectionBody(section.id)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
