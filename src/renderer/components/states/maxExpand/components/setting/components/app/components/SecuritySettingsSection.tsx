/**
 * @file SecuritySettingsSection.tsx
 * @description AI 信任等级 + 工具审计 + 记忆只读（M-A1/M-A3）。
 */

import { useEffect, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DEFAULT_TRUST_LEVEL,
  TRUST_LEVEL_CARDS,
  type TrustLevelInternal,
} from '../../../../../../../../utils/security/permissionCards';

interface AuditRow {
  t?: string;
  tool?: string;
  gate?: string;
  success?: boolean;
  userConfirmed?: boolean;
  error?: string;
  source?: string;
}

interface MemoryRow {
  id?: number | string;
  content?: string;
  category?: string;
  layer?: number | string;
}

export function SecuritySettingsSection(): ReactElement {
  const { t } = useTranslation();
  const [trustLevel, setTrustLevel] = useState<TrustLevelInternal>(DEFAULT_TRUST_LEVEL);
  const [auditRows, setAuditRows] = useState<AuditRow[]>([]);
  const [memories, setMemories] = useState<MemoryRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [sessionPass, setSessionPass] = useState(false);
  const [browserOn, setBrowserOn] = useState(false);
  const [visibleName, setVisibleName] = useState('');
  const [inputName, setInputName] = useState('');
  const [savingName, setSavingName] = useState(false);

  const loadMemories = (): void => {
    window.api?.assaMemoryList?.()
      .then((res) => setMemories((res?.items ?? []) as MemoryRow[]))
      .catch(() => setMemories([]));
  };

  const loadAudit = (): void => {
    window.api?.assaAuditLogList?.(30)
      .then((rows) => setAuditRows((rows ?? []) as AuditRow[]))
      .catch(() => setAuditRows([]));
  };

  useEffect(() => {
    window.api?.assaTrustLevelGet?.()
      .then((level) => setTrustLevel(Math.max(0, Math.min(3, level)) as TrustLevelInternal))
      .catch(() => {});
    loadAudit();
    loadMemories();
    window.api?.assaSessionPassGet?.().then(setSessionPass).catch(() => {});
    window.api?.assaBrowserEnabledGet?.().then(setBrowserOn).catch(() => {});
    window.api?.assaVisibleNameGet?.()
      .then((name) => {
        setVisibleName(name);
        setInputName(name);
      })
      .catch(() => {});
  }, []);

  const currentCard = TRUST_LEVEL_CARDS.find((c) => c.level === trustLevel);

  const onSelect = (level: TrustLevelInternal): void => {
    if (busy || level === trustLevel) return;
    setBusy(true);
    setTrustLevel(level);
    window.api?.assaTrustLevelSet?.(level)
      .then((next) => setTrustLevel(Math.max(0, Math.min(3, next)) as TrustLevelInternal))
      .catch(() => {})
      .finally(() => setBusy(false));
  };

  const onSaveName = (): void => {
    if (savingName || inputName.trim() === visibleName) return;
    setSavingName(true);
    window.api?.assaVisibleNameSet?.(inputName.trim())
      .then((name) => {
        setVisibleName(name);
        setInputName(name);
      })
      .catch(() => {})
      .finally(() => setSavingName(false));
  };

  return (
    <div className="max-expand-settings-section">
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title">
            {t('settings.aiName.title', { defaultValue: 'AI 名字' })}
          </div>
          <div className="settings-card-subtitle">
            {t('settings.aiName.hint', {
              defaultValue: '设置 AI 助手的显示名，修改后即时生效。留空则恢复默认“汐月”。',
            })}
          </div>
        </div>
        <div className="settings-card-inline-row">
          <input
            type="text"
            className="settings-field-input"
            value={inputName}
            placeholder={t('settings.aiName.placeholder', { defaultValue: '例如：汐月' })}
            onChange={(e) => setInputName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveName();
            }}
            disabled={savingName}
          />
          <button
            className="settings-card-action-btn"
            type="button"
            disabled={savingName || inputName.trim() === visibleName}
            onClick={onSaveName}
          >
            {savingName
              ? t('settings.aiName.saving', { defaultValue: '保存中…' })
              : t('settings.aiName.save', { defaultValue: '保存' })}
          </button>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title">
            {t('settings.aiSecurity.trustTitle', { defaultValue: 'AI 信任等级' })}
          </div>
          <div className="settings-card-subtitle">
            {t('settings.aiSecurity.trustHint', {
              defaultValue: '决定 Assa 自动执行工具与读取数据的范围。改动立即生效，无需重启。',
            })}
          </div>
        </div>
        <div className="settings-ai-trust-grid">
          {TRUST_LEVEL_CARDS.map((card) => (
            <button
              key={card.level}
              type="button"
              className={`settings-lyrics-source-btn settings-ai-trust-card${trustLevel === card.level ? ' active' : ''}`}
              onClick={() => onSelect(card.level)}
            >
              <span className="settings-ai-trust-name">{card.name}</span>
              <span className="settings-ai-trust-summary">{card.summary}</span>
            </button>
          ))}
        </div>
        {currentCard && (
          <div className="settings-ai-trust-detail">
            <div>{currentCard.canAct}</div>
            <div>{currentCard.canSee}</div>
            <div>{currentCard.confirmPolicy}</div>
            <div className="settings-ai-trust-risk">{currentCard.riskNote}</div>
          </div>
        )}
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title">
            {t('settings.audit.title', { defaultValue: '工具审计记录' })}
          </div>
          <div className="settings-card-subtitle">
            {t('settings.audit.hint', {
              defaultValue: '最近工具调用（只读）。日志保存在本机 userData/logs。',
            })}
          </div>
        </div>
        <div className="settings-card-inline-row">
          <button className="settings-card-action-btn" type="button" onClick={loadAudit}>
            {t('settings.audit.refresh', { defaultValue: '刷新' })}
          </button>
        </div>
        {auditRows.length === 0 ? (
          <div className="settings-hide-selected-empty">
            {t('settings.audit.empty', { defaultValue: '暂无工具调用记录' })}
          </div>
        ) : (
          <div className="settings-audit-list">
            {auditRows.map((row, i) => (
              <div className="settings-audit-row" key={`${row.t ?? i}-${row.tool ?? i}`}>
                <span className="settings-audit-time">{String(row.t ?? '').slice(11, 19)}</span>
                <span className="settings-audit-tool">{row.tool ?? '—'}</span>
                <span className={`settings-audit-ok${row.success === false ? ' fail' : ''}`}>
                  {row.success === false ? '失败' : '成功'}
                </span>
                {row.userConfirmed ? (
                  <span className="settings-audit-ok">已确认</span>
                ) : null}
                {row.error ? <span className="settings-audit-err">{row.error}</span> : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title">
            {t('settings.memory.title', { defaultValue: 'AI 记忆（只读）' })}
          </div>
          <div className="settings-card-subtitle">
            {t('settings.memory.hint', {
              defaultValue: '对话中自动沉淀的工作记忆摘要；完整删除能力后续提供。',
            })}
          </div>
        </div>
        <div className="settings-card-inline-row">
          <button
            className="settings-card-action-btn"
            type="button"
            onClick={() => {
              window.api?.assaMemoryClear?.().then(() => loadMemories()).catch(() => {});
            }}
          >
            {t('settings.memory.clear', { defaultValue: '清空记忆' })}
          </button>
        </div>
        {memories.length === 0 ? (
          <div className="settings-hide-selected-empty">
            {t('settings.memory.empty', { defaultValue: '暂无记忆。多聊几句后会出现在这里。' })}
          </div>
        ) : (
          <div className="settings-audit-list">
            {memories.slice(-40).reverse().map((m, i) => (
              <div className="settings-audit-row" key={String(m.id ?? i)}>
                <span className="settings-audit-tool">{m.content ?? '—'}</span>
                {m.category ? <span className="settings-audit-time">{String(m.category)}</span> : null}
                <button
                  className="settings-card-action-btn"
                  type="button"
                  onClick={() => {
                    const id = Number(m.id);
                    if (Number.isFinite(id)) {
                      window.api?.assaMemoryDelete?.(id).then(() => loadMemories()).catch(() => {});
                    }
                  }}
                >
                  {t('settings.memory.delete', { defaultValue: '删除' })}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title">
            {t('settings.sessionPass.title', { defaultValue: '会话通行证' })}
          </div>
          <div className="settings-card-subtitle">
            {t('settings.sessionPass.hint', {
              defaultValue: '开启后，本会话内非删除/非命令类需确认操作可自动通过；删除与命令仍需点允许。重启应用后自动关闭。',
            })}
          </div>
        </div>
        <div className="settings-card-inline-row">
          <label className="settings-card-check">
            <input
              type="checkbox"
              checked={sessionPass}
              onChange={(e) => {
                setSessionPass(e.target.checked);
                window.api?.assaSessionPassSet?.(e.target.checked).catch(() => {});
              }}
            />
            {t('settings.sessionPass.toggle', { defaultValue: '启用会话通行证' })}
          </label>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <div className="settings-card-title">
            {t('settings.browser.title', { defaultValue: '浏览器自动化' })}
          </div>
          <div className="settings-card-subtitle">
            {t('settings.browser.hint', {
              defaultValue: '默认关闭。开启后模型可提议 browser.* 工具，仍需信任等级与确认策略约束。',
            })}
          </div>
        </div>
        <div className="settings-card-inline-row">
          <label className="settings-card-check">
            <input
              type="checkbox"
              checked={browserOn}
              onChange={(e) => {
                setBrowserOn(e.target.checked);
                window.api?.assaBrowserEnabledSet?.(e.target.checked).catch(() => {});
              }}
            />
            {t('settings.browser.toggle', { defaultValue: '允许浏览器工具（需重启对话/侧车会话后完全生效）' })}
          </label>
        </div>
      </div>
    </div>
  );
}
