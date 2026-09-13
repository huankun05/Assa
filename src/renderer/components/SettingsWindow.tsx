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
 * @file SettingsWindow.tsx
 * @description 设置独立窗口根组件。
 * 设置作为「元功能」（配置一切），与待办/相册/工具箱等业务面板分离成独立窗口，职责清晰、互不拖累。
 * 窗口复用统一的 cw-* 样式（deep 深色壳 + 顶部标题栏 + 内容视口），保持视觉一致性。
 * @author 鸡哥
 */

import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { SettingsTab } from './states/maxExpand/components/SettingsTab';
import windowIcon from '../../../resources/icon/xiyue.svg';

const MAC_CONTROLS_KEY = 'standalone-window-mac-controls';

/**
 * 设置独立窗口根组件
 * @returns 设置窗口 React 节点
 */
export function SettingsWindow(): ReactElement {
  const { t } = useTranslation();
  const [macControls, setMacControls] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        window.api.windowClose();
      }
    };
    window.addEventListener('keydown', onKey);
    void window.api.storeRead(MAC_CONTROLS_KEY).then((v) => {
      if (typeof v === 'boolean') setMacControls(v);
    }).catch(() => {});
    const unsub = window.api.onSettingsChanged?.((channel: string, value: unknown) => {
      if (channel === `store:${MAC_CONTROLS_KEY}` && typeof value === 'boolean') setMacControls(value);
    });
    const timer = window.setTimeout(() => setReady(true), 280);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
      unsub?.();
    };
  }, []);

  return (
    <div className="cw-root settings-window">
      {!ready && (
        <div className="settings-window-loading" aria-busy="true">
          <div className="settings-window-spinner" />
          <span>{t('settings.loading', { defaultValue: '加载中…' })}</span>
        </div>
      )}
      <div className="cw-chrome" style={ready ? undefined : { opacity: 0.45 }}>
        <img className="cw-window-icon" src={windowIcon} alt="" aria-hidden="true" />
        <div className="cw-chrome__drag" />
        <div className={`cw-chrome__controls${macControls ? ' cw-chrome__controls--mac' : ''}`}>
          {macControls ? (
            <>
              <button className="cw-ctrl cw-ctrl--mac cw-ctrl--mac-minimize" type="button" title={t('standalone.controls.minimize')} onClick={() => window.api.windowMinimize()}>
                <span className="cw-ctrl-dot" />
              </button>
              <button className="cw-ctrl cw-ctrl--mac cw-ctrl--mac-maximize" type="button" title={t('standalone.controls.maximize')} onClick={() => window.api.windowMaximize()}>
                <span className="cw-ctrl-dot" />
              </button>
              <button className="cw-ctrl cw-ctrl--mac cw-ctrl--mac-close" type="button" title={t('standalone.controls.close')} onClick={() => window.api.windowClose()}>
                <span className="cw-ctrl-dot" />
              </button>
            </>
          ) : (
            <>
              <button className="cw-ctrl" type="button" title={t('standalone.controls.minimize')} onClick={() => window.api.windowMinimize()}>
                <svg width="10" height="1" viewBox="0 0 10 1"><rect width="10" height="1" fill="currentColor" /></svg>
              </button>
              <button className="cw-ctrl cw-ctrl--close" type="button" title={t('standalone.controls.close')} onClick={() => window.api.windowClose()}>
                <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
              </button>
            </>
          )}
        </div>
      </div>

      <div className="cw-viewport" style={ready ? undefined : { opacity: 0.35, pointerEvents: 'none' }}>
        <SettingsTab />
      </div>
    </div>
  );
}