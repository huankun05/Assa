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
 * @description 自定义页面管理器（独立窗口内渲染）。
 * @author 鸡哥
 */

import { useState } from 'react';
import type { ReactElement } from 'react';
import useIslandStore from '../../../../../store/slices';

/**
 * 自定义页面管理器：新增（内嵌网页 / 空白容器）、删除、改网址。
 * 新增的页面会自动出现在灵动岛 Hover 导航点中。
 * @returns 管理器节点。
 */
export function CustomPageManager(): ReactElement {
  const customPages = useIslandStore((s) => s.customPages);
  const addCustomPage = useIslandStore((s) => s.addCustomPage);
  const removeCustomPage = useIslandStore((s) => s.removeCustomPage);
  const updateCustomPage = useIslandStore((s) => s.updateCustomPage);

  const [title, setTitle] = useState('');
  const [template, setTemplate] = useState<'url' | 'blank'>('url');
  const [url, setUrl] = useState('');

  const handleAdd = (): void => {
    const t2 = title.trim();
    if (!t2) return;
    const id = `p_${Date.now().toString(36)}`;
    addCustomPage({
      id,
      title: t2,
      template,
      url: template === 'url' ? url.trim() || undefined : undefined,
    });
    setTitle('');
    setUrl('');
    setTemplate('url');
  };

  return (
    <div className="cw-custom-manager">
      <h2 className="cw-custom-manager-title">自定义页面管理</h2>
      <p className="cw-custom-manager-desc">新增的页面会出现在灵动岛 Hover 导航点中，可左右滑动或点击切换；按 ESC 关闭本窗口。</p>

      <div className="cw-custom-add">
        <input
          className="cw-input"
          placeholder="页面标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="cw-custom-template">
          <label className="cw-radio">
            <input type="radio" checked={template === 'url'} onChange={() => setTemplate('url')} />
            <span>内嵌网页</span>
          </label>
          <label className="cw-radio">
            <input type="radio" checked={template === 'blank'} onChange={() => setTemplate('blank')} />
            <span>空白容器</span>
          </label>
        </div>
        {template === 'url' && (
          <input
            className="cw-input"
            placeholder="网址 (https://...)"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        )}
        <button className="cw-btn cw-btn-primary" onClick={handleAdd}>添加页面</button>
      </div>

      <ul className="cw-custom-list">
        {customPages.length === 0 && <li className="cw-custom-empty">暂无自定义页面</li>}
        {customPages.map((p) => (
          <li key={p.id} className="cw-custom-item">
            <div className="cw-custom-item-info">
              <span className="cw-custom-item-title">{p.title}</span>
              <span className="cw-custom-item-meta">
                {p.template === 'url' ? (p.url || '未配置网址') : '空白容器'}
              </span>
            </div>
            <div className="cw-custom-item-actions">
              {p.template === 'url' && (
                <button
                  className="cw-btn"
                  onClick={() => {
                    const nu = window.prompt('修改网址', p.url ?? '');
                    if (nu !== null) updateCustomPage(p.id, { url: nu.trim() || undefined });
                  }}
                >
                  改网址
                </button>
              )}
              <button
                className="cw-btn cw-btn-danger"
                onClick={() => {
                  if (window.confirm(`确定删除页面「${p.title}」？`)) removeCustomPage(p.id);
                }}
              >
                删除
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
