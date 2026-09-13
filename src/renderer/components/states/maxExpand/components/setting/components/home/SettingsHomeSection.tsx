/**
 * 设置主页：对齐 settings-ui-preview（快速入口 + 分类行列表 + 顶栏搜索）
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactElement } from 'react';
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

const QUICK_IDS: SettingsCategoryId[] = ['appearance', 'aiPrivacy', 'system', 'media'];

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
    setOpen(false);
  };

  const categories = SETTINGS_CATEGORIES.filter((c) => c.id !== 'home');
  const quickCats = QUICK_IDS
    .map((id) => categories.find((c) => c.id === id))
    .filter(Boolean) as typeof categories;

  const mono = (icon: string): CSSProperties =>
    ({ '--icon-url': `url(${icon})` }) as CSSProperties;

  return (
    <div className="settings-root settings-v2">
      <div className="settings-layout">
        <header className="settings-v2-topbar">
          <div className="settings-v2-topbar-main">
            <h1 className="settings-v2-title">
              {t('settings.home.title', { defaultValue: '设置' })}
            </h1>
            <p className="settings-v2-sub">
              {t('settings.home.desc', { defaultValue: '搜索配置，或从分类进入' })}
            </p>
          </div>
          <div className="settings-search-box" ref={boxRef}>
            <div className="settings-search-field">
              <svg className="settings-search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
                <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
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
        </header>

        <div className="settings-v2-body settings-scroll scrollbar-none">
          <div className="settings-v2-label">
            {t('settings.home.quick', { defaultValue: '快速入口' })}
          </div>
          <div className="settings-quick-grid">
            {quickCats.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="settings-quick-item"
                onClick={() => onOpenCategory(cat.id)}
              >
                <span className="settings-quick-icon" aria-hidden="true">
                  <span className="icon-mono" style={mono(cat.icon)} />
                </span>
                <span className="settings-quick-text">
                  <strong>{cat.label}</strong>
                  <span>{cat.desc.split('、')[0]}</span>
                </span>
              </button>
            ))}
          </div>

          <div className="settings-v2-label">
            {t('settings.home.allCats', { defaultValue: '全部分类' })}
          </div>
          <div className="settings-cat-card">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="settings-cat-row"
                onClick={() => onOpenCategory(cat.id)}
              >
                <span className="settings-cat-icon" aria-hidden="true">
                  <span className="icon-mono" style={mono(cat.icon)} />
                </span>
                <span className="settings-cat-text">
                  <strong>{cat.label}</strong>
                  <span>{cat.desc}</span>
                </span>
                {cat.items ? <span className="settings-cat-meta">{cat.items.length} 项</span> : null}
                <svg className="settings-cat-chev" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
