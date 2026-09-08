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
 * @file ControlCenterPopover.tsx
 * @description 控制中心浮层：点击亮度/音量按钮后，在按钮栏位置覆盖显示滑块浮层
 * 不采用 position:absolute 定位，而是作为普通流式元素与按钮栏切换渲染。
 * 当 activePanel 非 null 时，外层 TimeTab 隐藏按钮栏，Popover 自然占据其位置。
 * @author 鸡哥
 */

import type React from 'react';
import { SvgIcon } from '../../../../../../utils/SvgIcon';
import { BrightnessControl } from './BrightnessControl';
import { VolumeControl } from './VolumeControl';
import type { ControlPanelType } from '../types/timeTabTypes';

/** 控制中心浮层 Props */
interface ControlCenterPopoverProps {
  /** 当前激活的面板：'brightness' | 'volume' | null（null 表示不展示浮层） */
  activePanel: ControlPanelType | null;
  /** 浮层收起回调（点击浮层内图标或鼠标移开灵动岛时触发） */
  onClose: () => void;
}

/**
 * 控制中心浮层组件
 * @description 浮层作为独立卡片显示在控制中心按钮栏上方，一行布局：
 *   左侧：🔆 / 🔊 图标（可点击关闭，即"再次点击亮度图标返回"）
 *   右侧：滑块 + 数值
 * 采用正常流布局（不 absolute），由外层 TimeTab 控制其出现在按钮栏上方，避免被 overflow 裁切。
 * 关闭时机：① 点击浮层内图标；② 鼠标移开整个灵动岛（由外层 time-tab-wrapper 的 onMouseLeave 触发）。
 * @param props - 激活面板与关闭回调
 * @returns 浮层元素；无激活面板时返回 null
 */
export function ControlCenterPopover({
  activePanel,
  onClose,
}: ControlCenterPopoverProps): React.ReactElement | null {
  // 无激活面板时不渲染，避免占据布局
  if (activePanel === null) {
    return null;
  }

  // 根据面板类型选择左侧图标（与控制中心按钮栏使用同一套图标）
  const iconSrc = activePanel === 'brightness' ? SvgIcon.BRIGHTNESS : SvgIcon.VOLUME;

  return (
    <div className="control-center-popover">
      {/* 左侧：功能图标（可点击关闭浮层，对应"再次点击亮度/音量图标返回控制中心"） */}
      <button
        type="button"
        className="control-center-popover-icon-btn"
        onClick={onClose}
        aria-label={activePanel === 'brightness' ? '关闭亮度调节' : '关闭音量调节'}
      >
        <img
          src={iconSrc}
          alt=""
          className="control-center-popover-icon"
        />
      </button>
      {/* 右侧：复用的亮度/音量滑块控件 */}
      <div className="control-center-popover-content">
        {activePanel === 'brightness' ? <BrightnessControl /> : <VolumeControl />}
      </div>
    </div>
  );
}