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
 * @file WallpaperLocalSection.tsx
 * @description 壁纸页本地区：内置预设 + 我的壁纸（保存/切换/删除）+ 导入图片/视频。
 * @author 鸡哥
 */

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { BUILTIN_WALLPAPERS } from '../../../../../../../assets/wallpaper/builtinWallpapers';

export interface LocalWallpaperItem {
  id: string;
  name: string;
  type: 'image' | 'video';
  /** data URL 或 asset URL（本地库仅存可复用引用） */
  src: string;
  opacity?: number;
}

interface WallpaperLocalSectionProps {
  bgMediaType: 'image' | 'video' | null;
  bgMediaPreviewUrl: string | null;
  onSelectBuiltin: (src: string, opacity: number) => void;
  onSelectImage: () => Promise<void> | void;
  onSelectVideo: () => Promise<void> | void;
  onClear: () => void;
  /** 应用任意 URL（本地库视频/图片） */
  onApplyUrl?: (url: string, type: 'image' | 'video') => void;
}

const LIBRARY_KEY = 'island-wallpaper-library';

function normalizeLibrary(raw: unknown): LocalWallpaperItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is LocalWallpaperItem => {
      if (!item || typeof item !== 'object') return false;
      const row = item as Partial<LocalWallpaperItem>;
      return typeof row.id === 'string'
        && typeof row.name === 'string'
        && typeof row.src === 'string'
        && (row.type === 'image' || row.type === 'video');
    })
    .map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      src: item.src,
      opacity: typeof item.opacity === 'number' ? item.opacity : undefined,
    }));
}

/**
 * 本地壁纸区：内置预设 + 我的壁纸
 */
export function WallpaperLocalSection({
  bgMediaType,
  bgMediaPreviewUrl,
  onSelectBuiltin,
  onSelectImage,
  onSelectVideo,
  onClear,
  onApplyUrl,
}: WallpaperLocalSectionProps): ReactElement {
  const { t } = useTranslation();
  const [library, setLibrary] = useState<LocalWallpaperItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    window.api.storeRead(LIBRARY_KEY).then((value: unknown) => {
      if (!cancelled) setLibrary(normalizeLibrary(value));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const persistLibrary = useCallback((next: LocalWallpaperItem[]) => {
    // 视频 data URL 过大时不入库，避免撑爆 store
    const safe = next.filter((item) => item.type !== 'video' || item.src.length < 400_000);
    setLibrary(safe);
    void window.api.storeWrite(LIBRARY_KEY, safe).catch(() => {});
  }, []);

  const registerCurrent = useCallback(() => {
    if (!bgMediaPreviewUrl || !bgMediaType) return;
    const item: LocalWallpaperItem = {
      id: `local_${Date.now().toString(36)}`,
      name: t('settings.wallpaper.local.untitled', { defaultValue: '自定义壁纸' }),
      type: bgMediaType,
      src: bgMediaPreviewUrl,
    };
    // 去重：同 src 不重复写入
    if (library.some((row) => row.src === item.src)) return;
    persistLibrary([item, ...library].slice(0, 40));
  }, [bgMediaPreviewUrl, bgMediaType, library, persistLibrary, t]);

  const applyLocal = (item: LocalWallpaperItem): void => {
    if (item.type === 'image') {
      onSelectBuiltin(item.src, item.opacity ?? 30);
    } else if (onApplyUrl) {
      onApplyUrl(item.src, 'video');
    }
  };

  const removeLocal = (id: string): void => {
    persistLibrary(library.filter((item) => item.id !== id));
  };

  return (
    <div className="settings-cards" style={{ marginBottom: 12 }}>
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title">
            {t('settings.wallpaper.local.title', { defaultValue: '本地壁纸' })}
          </div>
          <div className="settings-card-subtitle">
            {t('settings.wallpaper.local.hint', {
              defaultValue: '内置预设 + 我的壁纸。导入或应用后会保存到这里，可快速切换。',
            })}
          </div>
        </div>

        <div className="settings-card-subgroup">
          <div className="settings-card-subgroup-title">
            {t('settings.wallpaper.local.builtin', { defaultValue: '预设壁纸' })}
          </div>
          <div className="settings-bg-gallery">
            {BUILTIN_WALLPAPERS.map((wp) => (
              <button
                key={wp.id}
                className={`settings-bg-gallery-item ${bgMediaType === 'image' && bgMediaPreviewUrl === wp.src ? 'active' : ''}`}
                type="button"
                onClick={() => onSelectBuiltin(wp.src, wp.defaultOpacity)}
                title={wp.name}
              >
                <img src={wp.src} alt={wp.name} className="settings-bg-gallery-img" />
                <span className="settings-bg-gallery-name">{wp.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings-card-subgroup">
          <div className="settings-card-subgroup-title">
            {t('settings.wallpaper.local.import', { defaultValue: '导入 / 当前' })}
          </div>
          <div className="settings-hotkey-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="settings-hotkey-btn" type="button" onClick={() => { onSelectImage().catch(() => {}); }}>
              {t('settings.wallpaper.local.importImage', { defaultValue: '导入图片' })}
            </button>
            <button className="settings-hotkey-btn" type="button" onClick={() => { onSelectVideo().catch(() => {}); }}>
              {t('settings.wallpaper.local.importVideo', { defaultValue: '导入视频' })}
            </button>
            {(bgMediaType === 'image' || bgMediaType === 'video') && (
              <>
                <button className="settings-hotkey-btn" type="button" onClick={registerCurrent}>
                  {t('settings.wallpaper.local.saveCurrent', { defaultValue: '保存到我的壁纸' })}
                </button>
                <button className="settings-hotkey-btn" type="button" onClick={onClear}>
                  {t('settings.wallpaper.local.clear', { defaultValue: '清除背景' })}
                </button>
              </>
            )}
          </div>
          {bgMediaType && bgMediaPreviewUrl && (
            <div className="settings-music-hint">
              {bgMediaType === 'video'
                ? t('settings.wallpaper.local.currentVideo', { defaultValue: '当前：视频背景（可在主题外观调播放参数）' })
                : t('settings.wallpaper.local.currentImage', { defaultValue: '当前：图片背景' })}
            </div>
          )}
        </div>

        <div className="settings-card-subgroup">
          <div className="settings-card-subgroup-title">
            {t('settings.wallpaper.local.mine', { defaultValue: '我的壁纸（{{count}}）', count: library.length })}
          </div>
          {library.length === 0 ? (
            <div className="settings-music-hint">
              {t('settings.wallpaper.local.empty', { defaultValue: '暂无保存的壁纸；使用预设或导入后可点「保存到我的壁纸」' })}
            </div>
          ) : (
            <div className="settings-bg-gallery">
              {library.map((item) => (
                <div key={item.id} className="settings-bg-gallery-item" style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="settings-bg-gallery-item"
                    style={{ width: '100%', border: 0, background: 'transparent', padding: 0, cursor: 'pointer' }}
                    onClick={() => applyLocal(item)}
                    title={item.name}
                  >
                    {item.type === 'image' ? (
                      <img src={item.src} alt={item.name} className="settings-bg-gallery-img" />
                    ) : (
                      <div className="settings-bg-gallery-img" style={{ display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.06)' }}>
                        <span style={{ fontSize: 11 }}>Video</span>
                      </div>
                    )}
                    <span className="settings-bg-gallery-name">{item.name}</span>
                  </button>
                  <button
                    type="button"
                    className="settings-hotkey-btn"
                    style={{ position: 'absolute', top: 4, right: 4, padding: '2px 6px', fontSize: 11 }}
                    onClick={() => removeLocal(item.id)}
                    title={t('settings.wallpaper.local.remove', { defaultValue: '删除' })}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
