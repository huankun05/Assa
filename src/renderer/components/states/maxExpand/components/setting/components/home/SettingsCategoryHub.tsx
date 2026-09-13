/**
 * 分类子项列表：单栏钻取的中间层
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
}

export function SettingsCategoryHub({
  category,
  onOpenItem,
}: SettingsCategoryHubProps): ReactElement {
  const { t } = useTranslation();

  return (
    <div className="settings-category-hub">
      <div className="max-expand-settings-title settings-category-hub-title">
        <img className="settings-category-hub-icon" src={category.icon} alt="" />
        {category.label}
      </div>
      <p className="settings-category-hub-desc">{category.desc}</p>
      <div className="settings-category-hub-list">
        {(category.items ?? []).map((item) => (
          <button
            key={item.id}
            type="button"
            className="settings-category-hub-item"
            onClick={() => onOpenItem(item.dest)}
          >
            {item.icon ? <img className="settings-category-hub-item-icon" src={item.icon} alt="" /> : null}
            <span className="settings-category-hub-item-text">
              <span className="settings-category-hub-item-label">{item.label}</span>
              <span className="settings-category-hub-item-desc">{item.desc}</span>
            </span>
            <span className="settings-category-hub-item-chevron" aria-hidden="true">›</span>
          </button>
        ))}
      </div>
    </div>
  );
}
