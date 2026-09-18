/*
 * Assa - 浏览器音源识别工具
 * 用于把「网页播放」（浏览器进程）与本地音乐播放器区分开。
 * 灵动岛的音乐识别只面向本地桌面播放器（网易云/QQ音乐/汽水音乐/酷狗…），
 * 浏览器网页播放的 SMTC 元数据往往来自标签页标题（如「抖音 - 记录美好生活」），
 * 拿脏标题去匹配歌词/喜欢状态会得到错乱结果，因此默认不在识别范畴内。
 */

/** 浏览器 AUMID / 进程名关键词（小写匹配，子串包含即可命中） */
export const BROWSER_SOURCE_PATTERNS: readonly string[] = [
  'chrome',
  'msedge',
  'microsoftedge',
  'firefox',
  'mozilla',
  'opera',
  'brave',
  'vivaldi',
  'chromium',
  '360',
  'qqbrowser',
  'sogou',
  'iexplore',
  'maxthon',
  'yandex',
];

/**
 * 判断给定 sourceAppId（SMTC 的 AUMID 或进程标识）是否属于浏览器。
 * @param sourceAppId - SMTC 会话的 sourceAppId，可能为空
 * @returns true 表示浏览器网页播放，应从音乐识别中排除
 */
export function isBrowserSource(sourceAppId: string | undefined | null): boolean {
  if (!sourceAppId) return false;
  const id = sourceAppId.toLowerCase();
  return BROWSER_SOURCE_PATTERNS.some((pattern) => id.includes(pattern));
}
