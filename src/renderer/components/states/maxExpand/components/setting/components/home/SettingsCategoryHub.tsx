/**
 * 分类子项列表：全宽单列（desk-pet IconItem 同构）
 */
import type { ReactElement } from 'react';
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
    <div className="settings-page">
      <header className="settings-page-header">
        <button
          type="button"
          className="settings-page-back"
          onClick={onBack}
          aria-label={t('settings.nav.backToCategory', { defaultValue: '返回' })}
        >
          ‹
        </button>
        <div className="settings-page-header-title-block">
          <span className="settings-page-header-kicker">{category.desc}</span>
          <h1 className="settings-page-header-title">{category.label}</h1>
        </div>
      </header>

      <div className="settings-page-body settings-page-body--scroll">
        <div className="settings-menu-list">
          {(category.items ?? []).map((item, index) => (
            <button
              key={item.id}
              type="button"
              className="settings-menu-item"
              style={{ animationDelay: `${index * 40}ms` }}
              onClick={() => onOpenItem(item.dest)}
            >
              <span className="settings-menu-item-content">
                <span className="settings-menu-item-title">{item.label}</span>
                <span className="settings-menu-item-desc">{item.desc}</span>
              </span>
              {item.icon ? (
                <img className="settings-menu-item-icon" src={item.icon} alt="" aria-hidden="true" />
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
