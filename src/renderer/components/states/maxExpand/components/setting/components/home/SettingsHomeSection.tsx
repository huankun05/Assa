/**
 * 设置主页：玻璃卡片分类入口 + 全局搜索（复用 SEARCHABLE_SETTINGS）
 */
import { useMemo, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SEARCHABLE_SETTINGS,
  type AppSettingsPageKey,
  type MusicSettingsPageKey,
  type NetworkSettingsPageKey,
  type SettingsSidebarTabKey,
} from '../../utils/settingsConfig';
import {
  SETTINGS_CATEGORIES,
  type SettingsCategoryId,
  type SettingsCategoryDest,
} from '../../config/settingsCategories';

export interface SettingsHomeSectionProps {
  onOpenCategory: (id: SettingsCategoryId) => void;
  onOpenDest: (dest: SettingsCategoryDest) => void;
}

export function SettingsHomeSection({
  onOpenCategory,
  onOpenDest,
}: SettingsHomeSectionProps): ReactElement {
  const { t, i18n } = useTranslation();
  const [query, setQuery] = useState('');

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    return SEARCHABLE_SETTINGS.map((item) => {
      const label = item.labelKey ? t(item.labelKey, { defaultValue: item.label }) : item.label;
      const desc = item.descKey ? t(item.descKey, { defaultValue: item.desc }) : item.desc;
      return { ...item, label, desc };
    }).filter((item) => item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q)).slice(0, 24);
  }, [query, i18n.language, t]);

  const openSearchHit = (hit: {
    tab: SettingsSidebarTabKey;
    appPage?: AppSettingsPageKey;
    musicPage?: MusicSettingsPageKey;
    networkPage?: NetworkSettingsPageKey;
  }): void => {
    onOpenDest({
      tab: hit.tab,
      appPage: hit.appPage,
      musicPage: hit.musicPage,
      networkPage: hit.networkPage,
    });
    setQuery('');
  };

  return (
    <div className="settings-home">
      <div className="max-expand-settings-title settings-home-title">
        {t('settings.home.title', { defaultValue: '设置' })}
      </div>
      <p className="settings-home-desc">
        {t('settings.home.desc', { defaultValue: '搜索配置项，或按分类进入。' })}
      </p>

      <div className="settings-home-search">
        <svg className="settings-home-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          className="settings-home-search-input"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('settings.home.searchPlaceholder', { defaultValue: '搜索设置…' })}
        />
        {query && (
          <button type="button" className="settings-home-search-clear" onClick={() => setQuery('')} aria-label="清除">
            ×
          </button>
        )}
        {searchResults && (
          <div className="settings-home-search-results">
            {searchResults.length === 0 ? (
              <div className="settings-home-search-empty">没有匹配的设置</div>
            ) : (
              searchResults.map((hit, idx) => (
                <button
                  key={`${hit.label}-${idx}`}
                  type="button"
                  className="settings-home-search-item"
                  onClick={() => openSearchHit(hit)}
                >
                  <span className="settings-home-search-item-title">{hit.label}</span>
                  <span className="settings-home-search-item-desc">{hit.desc}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="settings-home-grid">
        {SETTINGS_CATEGORIES.filter((c) => c.id !== 'home').map((cat) => (
          <button
            key={cat.id}
            type="button"
            className="settings-home-cat-card"
            onClick={() => onOpenCategory(cat.id)}
          >
            <span className="settings-home-cat-icon-wrap">
              <img className="settings-home-cat-icon" src={cat.icon} alt="" />
            </span>
            <span className="settings-home-cat-label">{cat.label}</span>
            <span className="settings-home-cat-desc">{cat.desc}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
