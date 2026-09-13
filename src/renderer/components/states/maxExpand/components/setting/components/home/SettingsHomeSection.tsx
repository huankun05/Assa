/**
 * 设置主页：desk-pet 式全宽入口卡 + 页头搜索
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
    })
      .filter((item) => item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q))
      .slice(0, 20);
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
    <div className="settings-page">
      <header className="settings-page-header">
        <div className="settings-page-header-title-block">
          <span className="settings-page-header-kicker">Settings</span>
          <h1 className="settings-page-header-title">
            {t('settings.home.title', { defaultValue: '设置' })}
          </h1>
        </div>
        <div className="settings-page-header-actions">
          <div className="settings-search">
            <svg className="settings-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              className="settings-search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('settings.home.searchPlaceholder', { defaultValue: '搜索设置…' })}
            />
            {query && (
              <button
                type="button"
                className="settings-search-clear"
                onClick={() => setQuery('')}
                aria-label="清除"
              >
                ×
              </button>
            )}
            {searchResults && (
              <div className="settings-search-results">
                {searchResults.length === 0 ? (
                  <div className="settings-search-empty">没有匹配的设置</div>
                ) : (
                  searchResults.map((hit, idx) => (
                    <button
                      key={`${hit.label}-${idx}`}
                      type="button"
                      className="settings-search-hit"
                      onClick={() => openSearchHit(hit)}
                    >
                      <span className="settings-search-hit-title">{hit.label}</span>
                      <span className="settings-search-hit-desc">{hit.desc}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="settings-page-body settings-page-body--scroll">
        <p className="settings-page-lead">
          {t('settings.home.desc', { defaultValue: '搜索配置项，或按分类进入。' })}
        </p>
        <div className="settings-menu-list">
          {SETTINGS_CATEGORIES.filter((c) => c.id !== 'home').map((cat, index) => (
            <button
              key={cat.id}
              type="button"
              className="settings-menu-item"
              style={{ animationDelay: `${index * 40}ms` }}
              onClick={() => onOpenCategory(cat.id)}
            >
              <span className="settings-menu-item-content">
                <span className="settings-menu-item-title">{cat.label}</span>
                <span className="settings-menu-item-desc">{cat.desc}</span>
              </span>
              <img className="settings-menu-item-icon" src={cat.icon} alt="" aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
