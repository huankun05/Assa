/**
 * 分类子项列表：settings-v2 行列表（小图标 + 说明 + chevron）
 */
import { type CSSProperties, type ReactElement } from 'react';
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

  return (
    <div className="settings-root settings-v2">
      <div className="settings-layout">
        <header className="settings-v2-topbar">
          <div className="settings-v2-topbar-main">
            <h1 className="settings-v2-title">{category.label}</h1>
            <p className="settings-v2-sub">{category.desc}</p>
          </div>
        </header>

        <div className="settings-v2-body settings-scroll scrollbar-none">
          <div className="settings-back-row">
            <button
              type="button"
              className="settings-back-btn"
              onClick={onBack}
              aria-label={t('settings.home.backHome', { defaultValue: '返回主页' })}
            >
              ‹
            </button>
            <div>
              <div className="settings-back-title">{category.label}</div>
              <div className="settings-back-desc">
                {t('settings.home.pickItem', { defaultValue: '点选子项进入详细设置' })}
              </div>
            </div>
          </div>

          <div className="settings-cat-card">
            {(category.items ?? []).map((item) => (
              <button
                key={item.id}
                type="button"
                className="settings-cat-row"
                onClick={() => onOpenItem(item.dest)}
              >
                {item.icon ? (
                  <span className="settings-cat-icon" aria-hidden="true">
                    <span
                      className="icon-mono"
                      style={{ '--icon-url': `url(${item.icon})` } as CSSProperties}
                    />
                  </span>
                ) : (
                  <span className="settings-cat-icon settings-cat-icon--empty" aria-hidden="true" />
                )}
                <span className="settings-cat-text">
                  <strong>{item.label}</strong>
                  <span>{item.desc}</span>
                </span>
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
