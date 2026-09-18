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
 * @file adcodeApi.ts
 * @description Adcode 国内外行政区域查询接口
 * @author 鸡哥
 */

import { loadNetworkConfig } from '../../store/utils/storage';
import { logger } from '../../utils/logger';
import i18n from '../../i18n';
import type {
  DistrictQueryParams,
  DistrictItem,
  DistrictResolvedLocation,
  DistrictQueryResult,
  DistrictCascadeOption,
} from './types/District';

export type {
  DistrictQueryParams,
  DistrictItem,
  DistrictResolvedLocation,
  DistrictQueryResult,
  DistrictCascadeOption,
};

/** 中国大陆省级 adcode 固定表（接口无法一键列出全部省，级联第一级用此表） */
export const CHINA_PROVINCES: DistrictCascadeOption[] = [
  { adcode: '110000', name: '北京市' },
  { adcode: '120000', name: '天津市' },
  { adcode: '130000', name: '河北省' },
  { adcode: '140000', name: '山西省' },
  { adcode: '150000', name: '内蒙古自治区' },
  { adcode: '210000', name: '辽宁省' },
  { adcode: '220000', name: '吉林省' },
  { adcode: '230000', name: '黑龙江省' },
  { adcode: '310000', name: '上海市' },
  { adcode: '320000', name: '江苏省' },
  { adcode: '330000', name: '浙江省' },
  { adcode: '340000', name: '安徽省' },
  { adcode: '350000', name: '福建省' },
  { adcode: '360000', name: '江西省' },
  { adcode: '370000', name: '山东省' },
  { adcode: '410000', name: '河南省' },
  { adcode: '420000', name: '湖北省' },
  { adcode: '430000', name: '湖南省' },
  { adcode: '440000', name: '广东省' },
  { adcode: '450000', name: '广西壮族自治区' },
  { adcode: '460000', name: '海南省' },
  { adcode: '500000', name: '重庆市' },
  { adcode: '510000', name: '四川省' },
  { adcode: '520000', name: '贵州省' },
  { adcode: '530000', name: '云南省' },
  { adcode: '540000', name: '西藏自治区' },
  { adcode: '610000', name: '陕西省' },
  { adcode: '620000', name: '甘肃省' },
  { adcode: '630000', name: '青海省' },
  { adcode: '640000', name: '宁夏回族自治区' },
  { adcode: '650000', name: '新疆维吾尔自治区' },
  { adcode: '710000', name: '台湾省' },
  { adcode: '810000', name: '香港特别行政区' },
  { adcode: '820000', name: '澳门特别行政区' },
];

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function parseCoordinateObject(value: unknown): { latitude: number; longitude: number } | null {
  if (!value || typeof value !== 'object') return null;
  const obj = value as Record<string, unknown>;
  const latitude = toFiniteNumber(obj.lat) ?? toFiniteNumber(obj.latitude);
  const longitude = toFiniteNumber(obj.lng) ?? toFiniteNumber(obj.lon) ?? toFiniteNumber(obj.longitude);
  if (latitude === null || longitude === null) return null;
  return { latitude, longitude };
}

function parseCoordinateText(value: unknown): { latitude: number; longitude: number } | null {
  if (typeof value !== 'string') return null;
  const parts = value.split(',').map((part) => part.trim());
  if (parts.length < 2) return null;
  const first = toFiniteNumber(parts[0]);
  const second = toFiniteNumber(parts[1]);
  if (first === null || second === null) return null;

  if (Math.abs(first) <= 90 && Math.abs(second) <= 180) {
    return { latitude: first, longitude: second };
  }
  if (Math.abs(first) <= 180 && Math.abs(second) <= 90) {
    return { latitude: second, longitude: first };
  }
  return null;
}

function extractDistrictItems(result: DistrictQueryResult): DistrictItem[] {
  if (Array.isArray(result.results)) return result.results;
  const payload = result.data;
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>;
    if (Array.isArray(objectPayload.list)) return objectPayload.list as DistrictItem[];
    if (Array.isArray(objectPayload.results)) return objectPayload.results as DistrictItem[];
  }
  return [];
}

function resolveDistrictCoordinates(item: DistrictItem): { latitude: number; longitude: number } | null {
  const latitude = toFiniteNumber(item.lat) ?? toFiniteNumber(item.latitude);
  const longitude = toFiniteNumber(item.lng) ?? toFiniteNumber(item.lon) ?? toFiniteNumber(item.longitude);
  if (latitude !== null && longitude !== null) return { latitude, longitude };

  const fromCenter = parseCoordinateText(item.center);
  if (fromCenter) return fromCenter;
  const fromCenterObject = parseCoordinateObject(item.center);
  if (fromCenterObject) return fromCenterObject;
  const fromLocation = parseCoordinateText(item.location);
  if (fromLocation) return fromLocation;
  return null;
}

/**
 * Adcode 国内外行政区域查询（UAPI）
 * @docs 文档: https://uapis.cn/docs/api-reference/get-misc-district
 */
export async function fetchDistrictByAdcode(params: DistrictQueryParams): Promise<DistrictQueryResult> {
  const { timeoutMs } = loadNetworkConfig();

  const query = new URLSearchParams();
  if (params.adcode?.trim()) query.set('adcode', params.adcode.trim());
  const keywordText = params.keyword?.trim() || params.keywords?.trim() || '';
  if (keywordText) {
    query.set('keyword', keywordText);
    query.set('keywords', keywordText);
  }
  if (typeof params.subdistrict === 'number') query.set('subdistrict', String(params.subdistrict));
  if (typeof params.page === 'number' && params.page > 0) query.set('page', String(Math.floor(params.page)));
  if (typeof params.pageSize === 'number' && params.pageSize > 0) query.set('page_size', String(Math.floor(params.pageSize)));

  if (![...query.keys()].length) {
    throw new Error(i18n.t('settings.weather.adcode.missingParams', { defaultValue: 'District API 缺少查询参数（adcode 或 keyword）' }));
  }

  const url = `https://uapis.cn/api/v1/misc/district?${query.toString()}`;
  logger.info('[AdcodeApi] request', { url, timeoutMs, query: Object.fromEntries(query.entries()) });

  const resp = await window.api.netFetch(url, { timeoutMs });
  logger.info('[AdcodeApi] response', { url, status: resp.status, ok: resp.ok, body: resp.body });

  if (!resp.ok) {
    throw new Error(i18n.t('settings.weather.adcode.httpError', {
      defaultValue: 'Adcode API HTTP {{status}}：{{body}}',
      status: resp.status,
      body: resp.body.slice(0, 200),
    }));
  }

  if (resp.body.trimStart().startsWith('<')) {
    throw new Error(i18n.t('settings.weather.adcode.nonJson', { defaultValue: 'Adcode API 返回了非 JSON 内容，请检查网络环境' }));
  }

  const parsed = JSON.parse(resp.body) as DistrictQueryResult;
  if (typeof parsed.code === 'number' && parsed.code !== 200) {
    throw new Error(parsed.msg || parsed.message || i18n.t('settings.weather.adcode.errorCode', {
      defaultValue: 'Adcode API 返回错误码 {{code}}',
      code: parsed.code,
    }));
  }

  return parsed;
}

/** 层级优先级：区县 > 市 > 省 > 街道（更精确的行政区优先） */
function levelRank(level?: string): number {
  if (level === 'district') return 3;
  if (level === 'city') return 2;
  if (level === 'province') return 1;
  if (level === 'street') return 0;
  return 1.5;
}

function buildDistrictCandidate(item: DistrictItem, keyword: string): DistrictSearchCandidate | null {
  const coords = resolveDistrictCoordinates(item);
  if (!coords) return null;
  const name = typeof item.name === 'string' ? item.name : keyword;
  const province = typeof item.province === 'string' ? item.province : '';
  const district = typeof item.district === 'string' ? item.district : '';
  const city = typeof item.city === 'string' ? item.city : '';
  const parent = province || city || district;
  const label = parent && parent !== name ? `${name} · ${parent}` : name;
  return {
    latitude: coords.latitude,
    longitude: coords.longitude,
    city: name,
    adcode: typeof item.adcode === 'string' ? item.adcode : undefined,
    level: typeof item.level === 'string' ? item.level : undefined,
    province: province || undefined,
    district: district || undefined,
    label,
  };
}

function scoreCandidate(candidate: DistrictSearchCandidate, keyword: string): number {
  const name = candidate.city.toLowerCase();
  const normalized = keyword.toLowerCase();
  let score = name === normalized ? 100 : (name.includes(normalized) ? 50 : 10);
  score += levelRank(candidate.level) * 5;
  return score;
}

/**
 * 关键字搜索行政区域候选（支持区级），按精确度排序
 */
export async function searchDistrictLocations(keyword: string): Promise<DistrictSearchCandidate[]> {
  const text = keyword.trim();
  if (!text) return [];

  const result = await fetchDistrictByAdcode({ keyword: text, subdistrict: 0, page: 1, pageSize: 20 });
  const list = extractDistrictItems(result);
  const candidates = list
    .map((item) => buildDistrictCandidate(item, text))
    .filter((value): value is DistrictSearchCandidate => Boolean(value))
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, text) }))
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.candidate);

  // 同名去重（保留分数更高的一条已由排序保证）
  const seen = new Set<string>();
  const unique: DistrictSearchCandidate[] = [];
  for (const c of candidates) {
    const key = `${c.city}|${c.adcode ?? `${c.latitude},${c.longitude}`}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }
  return unique;
}

/**
 * 通过城市/区县关键字查询并解析经纬度
 * 大城市请尽量输入「海淀区 / 朝阳区」等区名，精度更高
 */
export async function resolveDistrictLocationByKeyword(keyword: string): Promise<DistrictResolvedLocation> {
  const text = keyword.trim();
  if (!text) throw new Error(i18n.t('settings.weather.adcode.emptyKeyword', { defaultValue: '请输入城市名称' }));

  const result = await fetchDistrictByAdcode({ keyword: text, subdistrict: 0, page: 1, pageSize: 20 });
  const list = extractDistrictItems(result);
  if (!list.length) {
    throw new Error(i18n.t('settings.weather.adcode.notFound', { defaultValue: '未查询到该城市，请尝试更完整名称' }));
  }

  const candidates = list
    .map((item) => buildDistrictCandidate(item, text))
    .filter((value): value is DistrictSearchCandidate => Boolean(value));
  if (!candidates.length) {
    throw new Error(i18n.t('settings.weather.adcode.noCoords', { defaultValue: '查询结果缺少经纬度信息' }));
  }

  const best = candidates
    .map((candidate) => ({ candidate, score: scoreCandidate(candidate, text) }))
    .sort((a, b) => b.score - a.score)[0].candidate;

  return {
    latitude: best.latitude,
    longitude: best.longitude,
    city: best.city,
    adcode: best.adcode,
    level: best.level,
    province: best.province,
    district: best.district,
  };
}

/**
 * 按 adcode 拉取下一级行政区（用于省市县级联）
 * @param adcode - 父级编码
 * @param subdistrict - 子级深度 1 即可
 */
export async function fetchDistrictChildrenByAdcode(
  adcode: string,
  subdistrict: 1 | 2 = 1,
): Promise<DistrictCascadeOption[]> {
  const code = adcode.trim();
  if (!code) return [];
  const result = await fetchDistrictByAdcode({ adcode: code, subdistrict, page: 1, pageSize: 100 });
  const list = extractDistrictItems(result);
  // 去掉与父级同码的自身节点
  return list
    .filter((item) => {
      const itemCode = typeof item.adcode === 'string' ? item.adcode : '';
      const name = typeof item.name === 'string' ? item.name : '';
      if (!itemCode || !name) return false;
      if (itemCode === code) return false;
      const level = typeof item.level === 'string' ? item.level : '';
      return level === 'city' || level === 'district' || level === 'province';
    })
    .map((item) => ({
      adcode: typeof item.adcode === 'string' ? item.adcode : '',
      name: typeof item.name === 'string' ? item.name : '',
      level: typeof item.level === 'string' ? item.level : undefined,
    }))
    .filter((item) => item.adcode && item.name)
    .sort((a, b) => a.adcode.localeCompare(b.adcode));
}

/**
 * 按 adcode 精确定位（级联选择后保存用，避免同名区县歧义）
 */
export async function resolveLocationByAdcode(adcode: string): Promise<DistrictResolvedLocation> {
  const code = adcode.trim();
  if (!code) throw new Error(i18n.t('settings.weather.adcode.emptyKeyword', { defaultValue: '请输入城市名称' }));

  const result = await fetchDistrictByAdcode({ adcode: code, subdistrict: 0, page: 1, pageSize: 5 });
  const list = extractDistrictItems(result);
  const exact = list.find((item) => (typeof item.adcode === 'string' ? item.adcode : '') === code) ?? list[0];
  if (!exact) {
    throw new Error(i18n.t('settings.weather.adcode.notFound', { defaultValue: '未查询到该城市，请尝试更完整名称' }));
  }
  const candidate = buildDistrictCandidate(exact, typeof exact.name === 'string' ? exact.name : code);
  if (!candidate) {
    throw new Error(i18n.t('settings.weather.adcode.noCoords', { defaultValue: '查询结果缺少经纬度信息' }));
  }
  return {
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    city: candidate.city,
    adcode: candidate.adcode,
    level: candidate.level,
    province: candidate.province,
    district: candidate.district,
  };
}
