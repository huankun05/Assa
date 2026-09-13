/**
 * 分类子项列表：与主页同一套 page-header + menu-icon-item
 */
import { useEffect, useRef, type CSSProperties, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type {
  SettingsCategory,
  SettingsCategoryDest,
} from '../../config/settingsCategories';

export interface SettingsCategoryHubProps {
  category: SettingsCategory;
  onOpenItem: (dest: SettingsCategoryDest) => void;
  onBack: () => void;
}

export function SettingsCategoryHub({
  category,
  onOpenItem,
  onBack,
}: SettingsCategoryHubProps): ReactElement {
  const { t } = useTranslation();
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    headerRef.current?.classList.remove('settings-page-header-enter');
    void headerRef.current?.offsetWidth;
    headerRef.current?.classList.add('settings-page-header-enter');
  }, [category.id]);

  return (
    <div className="settings-root">
      <div className="settings-layout">
        <header ref={headerRef} className="page-header settings-page-header-enter">
          <button
            type="button"
            className="page-header-back"
            onClick={onBack}
            aria-label={t('settings.home.backHome', { defaultValue: '返回主页' })}
          >
            ‹
          </button>
          <h1 className="page-header-title-wrap">
            <span className="page-header-kicker">{category.desc}</span>
            <span className="page-header-title">{category.label}</span>
          </h1>
        </header>

        <div className="settings-scroll scrollbar-none">
          <div className="settings-menu-list settings-menu-list--page">
            {(category.items ?? []).map((item, index) => (
              <button
                key={item.id}
                type="button"
                className="menu-icon-item"
                style={{
                  animation: 'fade-in-up 250ms ease forwards',
                  animationDelay: `${index * 50}ms`,
                  opacity: 0,
                }}
                onClick={() => onOpenItem(item.dest)}
              >
                <div className="menu-icon-item-content">
                  <div className="menu-icon-item-title">{item.label}</div>
                  <div className="menu-icon-item-description">
                    <span>{item.desc}</span>
                  </div>
                </div>
                {item.icon ? (
                  <span
                    className="menu-icon-item-icon icon-mono"
                    style={{ '--icon-url': `url(${item.icon})` } as CSSProperties}
                    aria-hidden="true"
                  />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
