/**
 * 实测网易云歌词获取链路（与 Xiyue netease.ts provider 一致的请求）
 */
const HEADERS = {
  Referer: 'https://music.163.com',
  'User-Agent': 'Mozilla/5.0',
  'Content-Type': 'application/x-www-form-urlencoded',
};

async function searchNetease(query) {
  const resp = await fetch('https://music.163.com/api/search/get/web', {
    method: 'POST',
    headers: HEADERS,
    body: `s=${encodeURIComponent(query)}&type=1&limit=5&offset=0`,
  });
  const json = await resp.json();
  const songs = json?.result?.songs ?? [];
  return songs.map((s) => ({ id: s.id, name: s.name, artists: (s.artists || []).map((a) => a.name).join('/') }));
}

async function fetchLyric(songId) {
  const resp = await fetch('https://interface3.music.163.com/api/song/lyric/v1', {
    method: 'POST',
    headers: HEADERS,
    body: `id=${songId}&lv=-1&kv=-1&tv=-1&rv=-1&yv=-1&ytv=-1&yrv=-1`,
  });
  const json = await resp.json();
  const lrc = json?.lrc?.lyric ?? '';
  const yrc = json?.yrc?.lyric ?? '';
  const lines = lrc.split('\n').filter((l) => l.trim() && !/^\[.*(offset|by:|length)/i.test(l));
  return { lrcPreview: lines.slice(0, 6), lrcLineCount: lines.length, hasYrc: Boolean(yrc) };
}

const VIP_CASES = [
  { q: '晴天 周杰伦', desc: 'VIP 版权歌曲' },
  { q: '泡沫 邓紫棋', desc: '热门歌曲' },
];

for (const { q, desc } of VIP_CASES) {
  console.log('=== 搜索:', q, `(${desc})`);
  try {
    const songs = await searchNetease(q);
    console.log('  结果数:', songs.length);
    console.log('  songs[0]:', JSON.stringify(songs[0]));
    if (songs[0]) {
      const lyric = await fetchLyric(songs[0].id);
      console.log('  歌词行数:', lyric.lrcLineCount, '| YRC:', lyric.hasYrc);
      console.log('  歌词前几行:', JSON.stringify(lyric.lrcPreview, null, 1));
    }
  } catch (e) {
    console.log('  失败:', e.message);
  }
}

console.log('=== LRCLIB 可达性测试');
try {
  const r = await fetch('https://lrclib.net/api/search?track_name=10%20Minutes&artist_name=%E6%9D%8E%E5%AD%9D%E5%88%A9', { headers: { 'User-Agent': 'DynamicIsland/1.0' } });
  const j = await r.json();
  console.log('  status:', r.status, '| 结果数:', Array.isArray(j) ? j.length : j);
  if (Array.isArray(j) && j[0]) {
    console.log('  首条:', j[0].trackName, '-', j[0].artistName, '| synced:', Boolean(j[0].syncedLyrics));
  }
} catch (e) {
  console.log('  失败:', e.message);
}

