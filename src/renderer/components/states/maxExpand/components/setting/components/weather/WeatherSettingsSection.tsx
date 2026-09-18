/*
 * eIsland - A sleek, Apple Dynamic Island inspired floating widget for Windows, built with Electron.
 * https://github.com/JNTMTMTM/eIsland
 *
 * Copyright (C) 2026 JNTMTMTM
 * Copyright (C) 2026 pyisland.com
 *
 * Original author: JNTMTMTM[](https://github.com/JNTMTMTM)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

/**
 * @file WeatherSettingsSection.tsx
 * @description 设置页面 - 天气设置区块
 * @author 鸡哥
 */

import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { WeatherSettingsPageKey } from '../../utils/settingsConfig';
import type { WeatherLocationPriority, WeatherProvider } from '../../../../../../../store/utils/storage';
import type { DistrictCascadeOption, DistrictSearchCandidate } from '../../../../../../../api/weather/types/District';
import {
  searchDistrictLocations,
  fetchDistrictChildrenByAdcode,
  CHINA_PROVINCES,
} from '../../../../../../../api/weather/adcodeApi';
import { SvgIcon } from '../../../../../../../utils/SvgIcon';
import { SettingsPageNavigation, SettingsPageNavigationToggle } from '../SettingsPageNavigation';
import { SettingsSelect } from '../common/SettingsSelect';

interface WeatherMessage {
  type: 'error' | 'success';
  text: string;
}

interface WeatherSettingsSectionProps {
  currentWeatherSettingsPageLabel: string;
  weatherSettingsPage: WeatherSettingsPageKey;
  weatherLocationPriorityOptions: Array<{ value: WeatherLocationPriority; label: string }>;
  weatherLocationPriority: WeatherLocationPriority;
  applyWeatherLocationPriority: (value: WeatherLocationPriority) => Promise<void>;
  setWeatherLocationConfigMessage: (message: WeatherMessage | null) => void;
  weatherCustomCityInput: string;
  setWeatherCustomCityInput: (value: string) => void;
  weatherCustomAdcode: string;
  setWeatherCustomAdcode: (value: string) => void;
  testWeatherCustomLocation: () => Promise<void>;
  setWeatherCustomLocationTesting: (value: boolean) => void;
  setWeatherCustomLocationTestMessage: (message: WeatherMessage | null) => void;
  weatherCustomLocationTesting: boolean;
  saveWeatherLocationSettings: () => Promise<void>;
  weatherLocationConfigMessage: WeatherMessage | null;
  weatherCustomLocationTestMessage: WeatherMessage | null;
  weatherProviderOptions: Array<{ value: WeatherProvider; label: string }>;
  weatherPrimaryProvider: WeatherProvider;
  isProUser: boolean;
  setWeatherPrimaryProvider: (value: WeatherProvider) => void;
  saveWeatherProviderConfig: (payload: { primaryProvider: WeatherProvider }) => void;
  weatherAlertEnabled: boolean;
  setWeatherAlertEnabled: (value: boolean) => void;
  weatherSettingsPages: WeatherSettingsPageKey[];
  weatherSettingsPageLabels: Record<WeatherSettingsPageKey, string>;
  setWeatherSettingsPage: (page: WeatherSettingsPageKey) => void;
}

/**
 * 渲染天气设置区块
 * @param props - 天气设置区域所需参数
 * @returns 天气设置区域
 */
export function WeatherSettingsSection(props: WeatherSettingsSectionProps): ReactElement {
  const { t } = useTranslation();
  const [pageNavigationExpanded, setPageNavigationExpanded] = useState(false);
  const [districtCandidates, setDistrictCandidates] = useState<DistrictSearchCandidate[]>([]);
  const [showCandidates, setShowCandidates] = useState(false);
  const [searchingDistricts, setSearchingDistricts] = useState(false);
  const districtSearchTimerRef = useRef<number | null>(null);
  const districtSearchSeqRef = useRef(0);
  /** 输入方式：关键字联想 / 省市县级联 */
  const [locationInputMode, setLocationInputMode] = useState<'search' | 'cascade'>('search');
  const [cascadeCities, setCascadeCities] = useState<DistrictCascadeOption[]>([]);
  const [cascadeDistricts, setCascadeDistricts] = useState<DistrictCascadeOption[]>([]);
  const [cascadeProvince, setCascadeProvince] = useState('');
  const [cascadeCity, setCascadeCity] = useState('');
  const [cascadeDistrict, setCascadeDistrict] = useState('');
  const [cascadeLoading, setCascadeLoading] = useState(false);
  const locationPriorityKeyMap: Record<WeatherLocationPriority, string> = {
    ip: 'settings.weather.options.locationPriority.ip',
    custom: 'settings.weather.options.locationPriority.custom',
  };
  const providerPriorityKeyMap: Record<WeatherProvider, string> = {
    'open-meteo': 'settings.weather.options.providerPriority.openMeteo',
    uapi: 'settings.weather.options.providerPriority.uapi',
    'qweather-pro': 'settings.weather.options.providerPriority.qweatherPro',
  };
  const {
    currentWeatherSettingsPageLabel,
    weatherSettingsPage,
    weatherLocationPriorityOptions,
    weatherLocationPriority,
    applyWeatherLocationPriority,
    setWeatherLocationConfigMessage,
    weatherCustomCityInput,
    setWeatherCustomCityInput,
    weatherCustomAdcode,
    setWeatherCustomAdcode,
    testWeatherCustomLocation,
    setWeatherCustomLocationTesting,
    setWeatherCustomLocationTestMessage,
    weatherCustomLocationTesting,
    saveWeatherLocationSettings,
    weatherLocationConfigMessage,
    weatherCustomLocationTestMessage,
    weatherProviderOptions,
    weatherPrimaryProvider,
    isProUser,
    setWeatherPrimaryProvider,
    saveWeatherProviderConfig,
    weatherAlertEnabled,
    setWeatherAlertEnabled,
    weatherSettingsPages,
    weatherSettingsPageLabels,
    setWeatherSettingsPage,
  } = props;

  // 区级联想：输入防抖搜索，候选可点选（大城市场景下比只输「北京市」更准）
  useEffect(() => {
    if (districtSearchTimerRef.current !== null) {
      window.clearTimeout(districtSearchTimerRef.current);
      districtSearchTimerRef.current = null;
    }
    const keyword = weatherCustomCityInput.trim();
    if (keyword.length < 2) {
      setDistrictCandidates([]);
      setShowCandidates(false);
      setSearchingDistricts(false);
      return;
    }
    setSearchingDistricts(true);
    const seq = ++districtSearchSeqRef.current;
    districtSearchTimerRef.current = window.setTimeout(() => {
      searchDistrictLocations(keyword)
        .then((list) => {
          if (seq !== districtSearchSeqRef.current) return;
          setDistrictCandidates(list);
          setShowCandidates(list.length > 0);
        })
        .catch(() => {
          if (seq !== districtSearchSeqRef.current) return;
          setDistrictCandidates([]);
          setShowCandidates(false);
        })
        .finally(() => {
          if (seq !== districtSearchSeqRef.current) return;
          setSearchingDistricts(false);
        });
    }, 320);
    return () => {
      if (districtSearchTimerRef.current !== null) {
        window.clearTimeout(districtSearchTimerRef.current);
        districtSearchTimerRef.current = null;
      }
    };
  }, [weatherCustomCityInput]);

  // 级联：选省 → 拉市；选市 → 拉区
  useEffect(() => {
    let cancelled = false;
    setCascadeCities([]);
    setCascadeDistricts([]);
    setCascadeCity('');
    setCascadeDistrict('');
    if (!cascadeProvince) return;
    setCascadeLoading(true);
    fetchDistrictChildrenByAdcode(cascadeProvince, 1)
      .then((list) => {
        if (cancelled) return;
        setCascadeCities(list);
      })
      .catch(() => {
        if (cancelled) return;
        setCascadeCities([]);
      })
      .finally(() => {
        if (!cancelled) setCascadeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cascadeProvince]);

  useEffect(() => {
    let cancelled = false;
    setCascadeDistricts([]);
    setCascadeDistrict('');
    if (!cascadeCity) return;
    setCascadeLoading(true);
    fetchDistrictChildrenByAdcode(cascadeCity, 1)
      .then((list) => {
        if (cancelled) return;
        setCascadeDistricts(list);
      })
      .catch(() => {
        if (cancelled) return;
        setCascadeDistricts([]);
      })
      .finally(() => {
        if (!cancelled) setCascadeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cascadeCity]);

  /** 应用级联选中节点：写入关键字输入 + adcode，保存时走精确解析 */
  const applyCascadeSelection = (option: DistrictCascadeOption | null): void => {
    if (!option) return;
    setWeatherCustomCityInput(option.name);
    setWeatherCustomAdcode(option.adcode);
    setWeatherLocationConfigMessage(null);
  };

  return (
    <div className="max-expand-settings-section">
      <div className="max-expand-settings-title settings-app-title-line">
        <span>{t('settings.labels.weather', { defaultValue: '天气配置' })}</span>
        <span className="settings-app-title-sub">- {currentWeatherSettingsPageLabel}</span>
        <SettingsPageNavigationToggle
          expanded={pageNavigationExpanded}
          label={t(pageNavigationExpanded ? 'settings.navigation.collapse' : 'settings.navigation.expand')}
          onToggle={() => setPageNavigationExpanded((current) => !current)}
        />
      </div>

      <div className="settings-app-pages-layout settings-weather-pages-layout">
        <div className="settings-app-page-main">
          {weatherSettingsPage === 'location' && (
            <div className="settings-cards">

              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-title">{t('settings.weather.locationPriority.title', { defaultValue: '定位来源优先级' })}</div>
                  <div className="settings-card-subtitle">{t('settings.weather.locationPriority.hint', { defaultValue: '选择天气定位优先使用 IP 自动定位或自定义位置' })}</div>
                </div>
                <div className="settings-lyrics-source-options">
                  {weatherLocationPriorityOptions.map((opt) => (
                    <button
                      key={opt.value}
                      className={`settings-lyrics-source-btn ${weatherLocationPriority === opt.value ? 'active' : ''}`}
                      type="button"
                      onClick={() => {
                        applyWeatherLocationPriority(opt.value).catch((error: unknown) => {
                          setWeatherLocationConfigMessage({
                            type: 'error',
                            text: t('settings.weather.messages.switchPriorityFailed', {
                              defaultValue: '切换优先级失败：{{error}}',
                              error: error instanceof Error ? error.message : t('settings.common.unknownError', { defaultValue: '未知错误' }),
                            }),
                          });
                        });
                      }}
                    >
                      {t(locationPriorityKeyMap[opt.value], { defaultValue: opt.label })}
                    </button>
                  ))}
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-title">{t('settings.weather.customCityTitle', { defaultValue: '自定义位置' })}</div>
                  <div className="settings-card-subtitle">{t('settings.weather.customCityHint', { defaultValue: '仅在“自定义位置优先”生效。可关键字联想（海淀区），也可省→市→区级联下拉。' })}</div>
                </div>
                <div className="settings-lyrics-source-options" style={{ marginBottom: 10 }}>
                  <button
                    type="button"
                    className={`settings-lyrics-source-btn${locationInputMode === 'search' ? ' active' : ''}`}
                    onClick={() => setLocationInputMode('search')}
                  >
                    {t('settings.weather.locationMode.search', { defaultValue: '关键字搜索' })}
                  </button>
                  <button
                    type="button"
                    className={`settings-lyrics-source-btn${locationInputMode === 'cascade' ? ' active' : ''}`}
                    onClick={() => setLocationInputMode('cascade')}
                  >
                    {t('settings.weather.locationMode.cascade', { defaultValue: '省市县级联' })}
                  </button>
                </div>

                {locationInputMode === 'search' && (
                  <div className="settings-hotkey-row">
                    <label className="settings-field" style={{ flex: 1, position: 'relative' }}>
                      <span className="settings-field-label">{t('settings.weather.cityName', { defaultValue: '城市 / 区县' })}</span>
                      <input
                        className="settings-field-input"
                        type="text"
                        placeholder={t('settings.weather.cityPlaceholder', { defaultValue: '例如：海淀区 / 杭州 / Tokyo' })}
                        value={weatherCustomCityInput}
                        onChange={(e) => {
                          setWeatherCustomCityInput(e.target.value);
                          setWeatherCustomAdcode('');
                        }}
                        onFocus={() => {
                          if (districtCandidates.length) setShowCandidates(true);
                        }}
                        onBlur={() => {
                          window.setTimeout(() => setShowCandidates(false), 120);
                        }}
                      />
                      {(showCandidates || searchingDistricts) && (
                        <div className="settings-weather-district-suggestions" role="listbox">
                          {searchingDistricts && !districtCandidates.length && (
                            <div className="settings-weather-district-suggestion-item is-muted">
                              {t('settings.weather.districtSearching', { defaultValue: '搜索中…' })}
                            </div>
                          )}
                          {districtCandidates.map((item, index) => (
                            <button
                              key={`${item.adcode ?? item.latitude}-${item.longitude}-${index}`}
                              type="button"
                              className="settings-weather-district-suggestion-item"
                              role="option"
                              aria-selected={false}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                setWeatherCustomCityInput(item.city);
                                setWeatherCustomAdcode(item.adcode ?? '');
                                setShowCandidates(false);
                                setWeatherLocationConfigMessage(null);
                              }}
                            >
                              <span className="settings-weather-district-suggestion-name">{item.city}</span>
                              <span className="settings-weather-district-suggestion-meta">
                                {item.label}
                                {item.level ? ` · ${item.level}` : ''}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </label>
                  </div>
                )}

                {locationInputMode === 'cascade' && (
                  <div className="settings-weather-cascade-row">
                    <SettingsSelect
                      label={t('settings.weather.cascade.province', { defaultValue: '省 / 直辖市' })}
                      value={cascadeProvince}
                      options={CHINA_PROVINCES.map((p) => ({ value: p.adcode, label: p.name }))}
                      onChange={(v) => {
                        const opt = CHINA_PROVINCES.find((p) => p.adcode === v);
                        setCascadeProvince(v);
                        if (opt) {
                          setWeatherCustomCityInput(opt.name);
                          setWeatherCustomAdcode(opt.adcode);
                        }
                      }}
                    />
                    <SettingsSelect
                      label={t('settings.weather.cascade.city', { defaultValue: '市' })}
                      value={cascadeCity}
                      options={cascadeCities.map((c) => ({ value: c.adcode, label: c.name }))}
                      onChange={(v) => {
                        const opt = cascadeCities.find((c) => c.adcode === v);
                        setCascadeCity(v);
                        if (opt) applyCascadeSelection(opt);
                      }}
                    />
                    <SettingsSelect
                      label={t('settings.weather.cascade.district', { defaultValue: '区 / 县' })}
                      value={cascadeDistrict}
                      options={cascadeDistricts.map((d) => ({ value: d.adcode, label: d.name }))}
                      onChange={(v) => {
                        const opt = cascadeDistricts.find((d) => d.adcode === v);
                        setCascadeDistrict(v);
                        if (opt) applyCascadeSelection(opt);
                      }}
                    />
                    {cascadeLoading && (
                      <span className="settings-weather-district-suggestion-meta" style={{ alignSelf: 'flex-end', paddingBottom: 8 }}>
                        {t('settings.weather.districtSearching', { defaultValue: '搜索中…' })}
                      </span>
                    )}
                  </div>
                )}

                <div className="settings-hotkey-row">
                  <button
                    className="settings-hotkey-btn"
                    type="button"
                    onClick={() => {
                      testWeatherCustomLocation().catch((error: unknown) => {
                        setWeatherCustomLocationTesting(false);
                        setWeatherCustomLocationTestMessage({
                          type: 'error',
                          text: t('settings.weather.messages.testFailed', {
                            defaultValue: '测试失败：{{error}}',
                            error: error instanceof Error ? error.message : t('settings.common.unknownError', { defaultValue: '未知错误' }),
                          }),
                        });
                      });
                    }}
                    disabled={weatherCustomLocationTesting}
                  >
                    {weatherCustomLocationTesting
                      ? t('settings.weather.testing', { defaultValue: '测试中...' })
                      : t('settings.weather.testCustomLocation', { defaultValue: '测试自定义位置（双接口）' })}
                  </button>
                  <button
                    className="settings-hotkey-btn"
                    type="button"
                    onClick={() => {
                      saveWeatherLocationSettings().catch((error: unknown) => {
                        setWeatherLocationConfigMessage({
                          type: 'error',
                          text: t('settings.common.saveFailed', {
                            defaultValue: '保存失败：{{error}}',
                            error: error instanceof Error ? error.message : t('settings.common.unknownError', { defaultValue: '未知错误' }),
                          }),
                        });
                      });
                    }}
                  >
                    {t('settings.weather.saveLocation', { defaultValue: '保存定位配置' })}
                  </button>
                </div>
                {weatherLocationConfigMessage && (
                  <div className="settings-music-hint" style={{ color: weatherLocationConfigMessage.type === 'error' ? '#ff7f7f' : '#7be495' }}>
                    {weatherLocationConfigMessage.text}
                  </div>
                )}
                {weatherCustomLocationTestMessage && (
                  <div className="settings-music-hint" style={{ color: weatherCustomLocationTestMessage.type === 'error' ? '#ff7f7f' : '#7be495' }}>
                    {weatherCustomLocationTestMessage.text}
                  </div>
                )}
              </div>

            </div>
          )}

          {weatherSettingsPage === 'provider' && (
            <div className="settings-cards">
              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-title">{t('settings.weather.providerPriority.title', { defaultValue: '天气接口优先级' })}</div>
                  <div className="settings-card-subtitle">{t('settings.weather.providerPriority.hint', { defaultValue: '可选择优先使用 Open-Meteo 或 UAPI，失败时自动切换到另一源' })}</div>
                </div>
                <div className="settings-lyrics-source-options">
                  {weatherProviderOptions.map((opt) => (
                    (() => {
                      const isQweatherPro = opt.value === 'qweather-pro';
                      const disabled = isQweatherPro && !isProUser;
                      return (
                    <button
                      key={opt.value}
                      className={`settings-lyrics-source-btn ${weatherPrimaryProvider === opt.value ? 'active' : ''}`}
                      type="button"
                      disabled={disabled}
                      title={disabled ? t('settings.weather.proOnlyHint', { defaultValue: '当前账户不可用' }) : undefined}
                      onClick={() => {
                        if (disabled) return;
                        setWeatherPrimaryProvider(opt.value);
                        saveWeatherProviderConfig({ primaryProvider: opt.value });
                      }}
                    >
                      {isQweatherPro && (
                        <span
                          className="settings-weather-provider-pro-badge"
                          title={t('settings.weather.proOnlyHint', { defaultValue: '当前账户不可用' })}
                        >
                          <img
                            src={SvgIcon.PRO}
                            alt="PRO"
                            width={14}
                            height={14}
                          />
                        </span>
                      )}
                      {t(providerPriorityKeyMap[opt.value], { defaultValue: opt.label })}
                    </button>
                      );
                    })()
                  ))}
                </div>
              </div>

              <div className="settings-card">
                <div className="settings-card-header">
                  <div className="settings-card-title">{t('settings.weather.alert.title', { defaultValue: '启动天气预警提醒' })}</div>
                  <div className="settings-card-subtitle">{t('settings.weather.alert.hint', { defaultValue: '应用启动自动检查更新前，先请求和风天气预警并提示；确认关闭后再继续检查更新。' })}</div>
                </div>
                <div className="settings-card-inline-row">
                  <label
                    className="settings-card-check"
                    title={!isProUser ? t('settings.weather.proOnlyHint', { defaultValue: '当前账户不可用' }) : undefined}
                  >
                    <input
                      type="checkbox"
                      checked={weatherAlertEnabled}
                      disabled={!isProUser}
                      onChange={(e) => {
                        if (!isProUser) return;
                        setWeatherAlertEnabled(e.target.checked);
                      }}
                    />
                    <span
                      className="settings-weather-provider-pro-badge"
                      title={t('settings.weather.proOnlyHint', { defaultValue: '当前账户不可用' })}
                    >
                      <img
                        src={SvgIcon.PRO}
                        alt="PRO"
                        width={14}
                        height={14}
                      />
                    </span>
                    {t('settings.weather.alert.enabled', { defaultValue: '开启预警提醒' })}
                  </label>
                </div>
              </div>

            </div>
          )}
        </div>

        <SettingsPageNavigation
          activePage={weatherSettingsPage}
          expanded={pageNavigationExpanded}
          pages={weatherSettingsPages}
          pageLabels={weatherSettingsPageLabels}
          navigationLabel={t('settings.weather.pagination')}
          onSelectPage={setWeatherSettingsPage}
        />
      </div>
    </div>
  );
}
