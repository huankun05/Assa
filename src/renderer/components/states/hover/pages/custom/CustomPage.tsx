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
 * @file CustomPage.tsx
 * @description 自定义页面内容组件（Hover 状态内渲染）。
 * @author 鸡哥
 */

import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../../store/slices';

interface CustomPageProps {
  /** 自定义页 id（不含 'custom:' 前缀） */
  tabId: string;
}

/**
 * 自定义页面内容组件。
 * template=url 内嵌 iframe；template=blank 渲染空白组件容器占位。
 * @param props - 页面渲染参数。
 * @returns 自定义页面节点。
 */
export function CustomPage({ tabId }: CustomPageProps): ReactElement {
  const { t } = useTranslation();
  const def = useIslandStore((s) => s.customPages.find((p) => p.id === tabId));

  if (!def) {
    return (
      <div className="custom-page custom-page-empty">
        {t('hover.custom.missing', { defaultValue: '页面不存在或已删除' })}
      </div>
    );
  }

  if (def.template === 'blank') {
    return (
      <div className="custom-page custom-page-blank">
        <div className="custom-page-blank-hint">{def.title}</div>
        <div className="custom-page-blank-sub">
          {t('hover.custom.blankHint', { defaultValue: '空白组件容器（可在此挂载自定义组件）' })}
        </div>
      </div>
    );
  }

  if (!def.url) {
    return (
      <div className="custom-page custom-page-empty">
        {t('hover.custom.noUrl', { defaultValue: '未配置网址' })}
      </div>
    );
  }

  return (
    <div className="custom-page custom-page-url">
      <iframe
        className="custom-page-iframe"
        src={def.url}
        title={def.title}
        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        allow="fullscreen"
      />
    </div>
  );
}
