/**
 * 设置主页：对齐 desk-pet SettingsLayout + PageHeader + IconItem 手感
 */
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
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
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return SEARCHABLE_SETTINGS.map((item) => {
      const label = item.labelKey ? t(item.labelKey, { defaultValue: item.label }) : item.label;
      const desc = item.descKey ? t(item.descKey, { defaultValue: item.desc }) : item.desc;
      return { ...item, label, desc };
    })
      .filter((item) => item.label.toLowerCase().includes(q) || item.desc.toLowerCase().includes(q))
      .slice(0, 12);
  }, [query, i18n.language, t]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const openDest = (dest: SettingsCategoryDest): void => {
    onOpenDest(dest);
    setQuery('');
    setOpen(false);
  };

  const openSearchHit = (hit: {
    tab: SettingsSidebarTabKey;
    appPage?: AppSettingsPageKey;
    musicPage?: MusicSettingsPageKey;
    networkPage?: NetworkSettingsPageKey;
  }): void => {
    openDest({
      tab: hit.tab,
      appPage: hit.appPage,
      musicPage: hit.musicPage,
      networkPage: hit.networkPage,
    });
  };

  const categories = SETTINGS_CATEGORIES.filter((c) => c.id !== 'home');

  return (
    <div className="settings-root">
      <div className="settings-layout">
        <header className="page-header settings-page-header-enter">
          <span className="page-header-back is-hidden" aria-hidden="true">‹</span>
          <h1 className="page-header-title-wrap">
            <span className="page-header-kicker">Settings</span>
            <span className="page-header-title">
              {t('settings.home.title', { defaultValue: '设置' })}
            </span>
          </h1>
          <div className="page-header-actions">
            <div className="settings-search-box" ref={boxRef}>
              <div className="settings-search-field">
                <span className="settings-search-icon" aria-hidden="true">⌕</span>
                <input
                  ref={inputRef}
                  className="settings-search-input"
                  type="text"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setOpen(true);
                    setActive(0);
                  }}
                  onFocus={() => setOpen(true)}
                  onKeyDown={(e) => {
                    if (!searchResults.length) return;
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setActive((a) => (a + 1) % searchResults.length);
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setActive((a) => (a - 1 + searchResults.length) % searchResults.length);
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      openSearchHit(searchResults[active]);
                    }
                  }}
                  placeholder={t('settings.home.searchPlaceholder', { defaultValue: '搜索设置…' })}
                />
                {query && (
                  <button
                    type="button"
                    className="settings-search-clear"
                    onClick={() => {
                      setQuery('');
                      setActive(0);
                      inputRef.current?.focus();
                    }}
                    aria-label="清空搜索"
                  >
                    ×
                  </button>
                )}
              </div>
              {open && query.trim() && (
                <div className="settings-search-dropdown">
                  {searchResults.length === 0 ? (
                    <div className="settings-search-empty">没有匹配的设置项</div>
                  ) : (
                    <ul className="settings-search-list">
                      {searchResults.map((hit, i) => (
                        <li key={`${hit.label}-${i}`}>
                          <button
                            type="button"
                            className={`settings-search-result${i === active ? ' is-active' : ''}`}
                            onClick={() => openSearchHit(hit)}
                            onMouseEnter={() => setActive(i)}
                          >
                            <span className="settings-search-result-text">
                              <span className="settings-search-result-title">{hit.label}</span>
                              <span className="settings-search-result-desc">{hit.desc}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="settings-scroll scrollbar-none">
          <div className="settings-menu-list settings-menu-list--page">
            {categories.map((cat, index) => (
              <button
                key={cat.id}
                type="button"
                className="menu-icon-item"
                style={{
                  animation: 'fade-in-up 250ms ease forwards',
                  animationDelay: `${index * 50}ms`,
                  opacity: 0,
                }}
                onClick={() => onOpenCategory(cat.id)}
              >
                <div className="menu-icon-item-content">
                  <div className="menu-icon-item-title">{cat.label}</div>
                  <div className="menu-icon-item-description">
                    <span>{cat.desc}</span>
                  </div>
                </div>
                <img className="menu-icon-item-icon" src={cat.icon} alt="" aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
