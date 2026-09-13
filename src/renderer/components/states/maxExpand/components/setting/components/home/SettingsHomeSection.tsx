/**
 * 设置主页：常用设置（按使用频率）+ 全部分类 + 顶栏搜索
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
  type SettingsCategoryDest,
  type SettingsCategoryId,
} from '../../config/settingsCategories';
import {
  getTopSettingsUsageIds,
  settingsUsageId,
} from '../../config/settingsUsage';

export interface SettingsHomeSectionProps {
  onOpenCategory: (id: SettingsCategoryId) => void;
  onOpenDest: (dest: SettingsCategoryDest) => void;
  /** 依赖：打开详情后父级刷新常用列表 */
  usageTick?: number;
}

interface FlatItem {
  id: string;
  label: string;
  desc: string;
  icon?: string;
  dest: SettingsCategoryDest;
  categoryId: SettingsCategoryId;
}

function flattenItems(): FlatItem[] {
  const out: FlatItem[] = [];
  for (const cat of SETTINGS_CATEGORIES) {
    if (!cat.items) continue;
    for (const item of cat.items) {
      out.push({
        id: settingsUsageId(item.dest),
        label: item.label,
        desc: item.desc,
        icon: item.icon,
        dest: item.dest,
        categoryId: cat.id,
      });
    }
  }
  return out;
}

/** 冷启动无数据时的默认常用（与 settingsUsageId 格式一致：tab:app:music:network） */
const DEFAULT_HOT_IDS = [
  'app:theme::',
  'app:ai-security::',
  'app:behavior::',
  'music:::',
];

export function SettingsHomeSection({
  onOpenCategory,
  onOpenDest,
  usageTick = 0,
}: SettingsHomeSectionProps): ReactElement {
  const { t, i18n } = useTranslation();
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [usageVersion, setUsageVersion] = useState(0);

  useEffect(() => {
    setUsageVersion((v) => v + 1);
  }, [usageTick]);

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
  const allItems = useMemo(() => flattenItems(), []);

  const hotItems = useMemo(() => {
    void usageVersion;
    const topIds = getTopSettingsUsageIds(4);
    const byId = new Map(allItems.map((x) => [x.id, x]));
    const picked: FlatItem[] = [];
    for (const id of topIds) {
      const hit = byId.get(id);
      if (hit) picked.push(hit);
    }
    for (const id of DEFAULT_HOT_IDS) {
      if (picked.length >= 4) break;
      const hit = byId.get(id);
      if (hit && !picked.some((p) => p.id === hit.id)) picked.push(hit);
    }
    // 仍不足时用全量前 4，保证常用区不空白
    for (const item of allItems) {
      if (picked.length >= 4) break;
      if (!picked.some((p) => p.id === item.id)) picked.push(item);
    }
    return picked.slice(0, 4);
  }, [allItems, usageVersion]);

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
              {t('settings.home.desc', { defaultValue: '搜索配置，或按分类进入' })}
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
            {t('settings.home.hot', { defaultValue: '常用设置' })}
          </div>
          <div className="settings-quick-grid">
            {hotItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="settings-quick-item"
                onClick={() => onOpenDest(item.dest)}
              >
                <span className="settings-quick-icon" aria-hidden="true">
                  {item.icon ? (
                    <span className="icon-mono" style={mono(item.icon)} />
                  ) : null}
                </span>
                <span className="settings-quick-text">
                  <strong>{item.label}</strong>
                  <span>{item.desc}</span>
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
