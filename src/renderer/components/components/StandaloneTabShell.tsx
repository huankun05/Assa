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
 * @file StandaloneTabShell.tsx
 * @description 独立窗 Tab 统一壳层：settings-v2 结构 + 可滚动视口，保证各业务页在设置风框架内展示。
 * @author 鸡哥
 */

import type { ReactElement, ReactNode } from 'react';

interface StandaloneTabShellProps {
  children: ReactNode;
}

/**
 * 独立窗内容壳：唯一滚动容器 + settings 墨色，子页不再各自 overflow:hidden 裁切。
 */
export function StandaloneTabShell({ children }: StandaloneTabShellProps): ReactElement {
  return (
    <div className="cw-panel-root settings-tab-panel" data-settings-shell="true">
      {children}
    </div>
  );
}
