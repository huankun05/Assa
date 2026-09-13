/**
 * 设置页打开频次：用于「常用设置」排序（次数 + 时间衰减，旧的自然沉底）
 */
export type SettingsUsageMap = Record<string, { count: number; lastAt: number }>;

const STORAGE_KEY = 'xiyue-settings-usage-v1';
const DECAY_HALF_LIFE_DAYS = 7;

function readMap(): SettingsUsageMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as SettingsUsageMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeMap(map: SettingsUsageMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

export function settingsUsageId(dest: {
  tab: string;
  appPage?: string;
  musicPage?: string;
  networkPage?: string;
}): string {
  return [dest.tab, dest.appPage ?? '', dest.musicPage ?? '', dest.networkPage ?? ''].join(':');
}

/** 打开一次：count+1，lastAt=now；次数持续累加，排序靠衰减分 */
export function trackSettingsOpen(dest: {
  tab: string;
  appPage?: string;
  musicPage?: string;
  networkPage?: string;
}): void {
  const id = settingsUsageId(dest);
  const map = readMap();
  const prev = map[id] ?? { count: 0, lastAt: 0 };
  map[id] = { count: prev.count + 1, lastAt: Date.now() };
  writeMap(map);
}

function score(entry: { count: number; lastAt: number }, now: number): number {
  if (!entry.count) return 0;
  const ageDays = Math.max(0, (now - entry.lastAt) / 86_400_000);
  const decay = Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS);
  return entry.count * decay;
}

/** 按加权分取 Top N 的 usageId */
export function getTopSettingsUsageIds(n: number): string[] {
  const now = Date.now();
  const map = readMap();
  return Object.entries(map)
    .map(([id, entry]) => ({ id, s: score(entry, now) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((x) => x.id);
}
