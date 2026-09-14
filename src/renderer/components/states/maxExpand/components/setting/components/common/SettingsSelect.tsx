/**
 * 设置用圆角自定义下拉（替代原生 select，Windows 系统弹层无法圆角）
 */
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';

export interface SettingsSelectOption {
  value: string;
  label: string;
}

export interface SettingsSelectProps {
  value: string;
  options: SettingsSelectOption[];
  onChange: (value: string) => void;
  label?: string;
}

export function SettingsSelect({
  value,
  options,
  onChange,
  label,
}: SettingsSelectProps): ReactElement {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
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
  }, [open]);

  return (
    <div className="settings-field" style={{ position: 'relative' }} ref={boxRef}>
      {label ? <span className="settings-field-label">{label}</span> : null}
      <button
        type="button"
        className="settings-field-input settings-display-select-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="settings-display-select-label">
          {current?.label ?? value || t('settings.select.placeholder', { defaultValue: '请选择' })}
        </span>
        <span className="settings-display-select-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="settings-display-menu" role="listbox">
          {options.map((item) => (
            <li key={item.value}>
              <button
                type="button"
                role="option"
                aria-selected={item.value === value}
                className={`settings-display-menu-item${item.value === value ? ' active' : ''}`}
                onClick={() => {
                  onChange(item.value);
                  setOpen(false);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
