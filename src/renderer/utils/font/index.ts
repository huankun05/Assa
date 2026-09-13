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
 * @file index.ts
 * @description 字体管理工具：启动时初始化字体、注入 @font-face
 * @author 鸡哥
 */

/** 预设字体 CSS 映射 */
export const PRESET_FONTS: Record<string, string> = {
  'default': "'Microsoft YaHei', 'PingFang SC', -apple-system, sans-serif",
  'microsoft-yahei': "'Microsoft YaHei', sans-serif",
  'simhei': "'SimHei', sans-serif",
  'simsun': "'SimSun', serif",
  'kaiti': "'KaiTi', serif",
  'fangsong': "'FangSong', serif",
  'cascadia-code': "'Cascadia Code', 'JetBrains Mono', Consolas, monospace",
  'jetbrains-mono': "'JetBrains Mono', 'Cascadia Code', Consolas, monospace",
  'consolas': "Consolas, 'Courier New', monospace",
};

/** MIME 类型映射 */
const FONT_MIME_MAP: Record<string, string> = {
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

/** 自定义字体条目 */
interface CustomFont {
  name: string;
  path: string;
}

/**
 * 从 base64 数据注入 @font-face（复用已有 style 元素时会释放旧 Blob URL）
 * @param familyName - 字体族名称
 * @param base64Data - base64 编码的字体数据
 * @param ext - 文件扩展名
 * @returns CSS font-family 值
 */
export function injectFontFace(familyName: string, base64Data: string, ext: string): string {
  const mime = FONT_MIME_MAP[ext] || 'font/ttf';
  const binary = atob(base64Data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const blob = new Blob([bytes], { type: mime });
  const url = URL.createObjectURL(blob);

  const styleId = `custom-font-${familyName}`;
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    document.head.appendChild(style);
  } else {
    const previousUrl = style.dataset.fontUrl;
    if (previousUrl) URL.revokeObjectURL(previousUrl);
  }
  style.dataset.fontUrl = url;

  const format = ext === 'ttf' ? 'truetype' : ext === 'otf' ? 'opentype' : ext;
  style.textContent = `@font-face { font-family: '${familyName}'; src: url('${url}') format('${format}'); }`;

  return `'${familyName}', sans-serif`;
}

/** 加载自定义字体列表，返回 path → css 映射 */
async function loadCustomFonts(fonts: CustomFont[], prefix: string): Promise<Map<string, string>> {
  const entries = await Promise.all(
    fonts.map(async (font) => {
      try {
        const result = await window.api.readFontFile(font.path);
        if (result) {
          return [font.path, injectFontFace(`${prefix}-${font.name}`, result.data, result.ext)] as const;
        }
      } catch {
        /* skip */
      }
      return null;
    })
  );
  return new Map(entries.filter((e): e is NonNullable<typeof e> => e !== null));
}

/** 应用 UI 字体到当前文档（岛/设置窗通用） */
export async function applyUIFontFromStore(): Promise<void> {
  try {
    const [uiVal, uiCustom] = await Promise.all([
      window.api.storeRead('ui-font-family'),
      window.api.storeRead('ui-custom-fonts'),
    ]);
    const uiCustomArr = Array.isArray(uiCustom) ? uiCustom as CustomFont[] : [];
    if (typeof uiVal === 'string' && uiVal.startsWith('custom:')) {
      const map = await loadCustomFonts(uiCustomArr, 'eIsland-UI');
      const css = map.get(uiVal.slice(7));
      if (css) document.documentElement.style.setProperty('--island-ui-font', css);
    } else if (typeof uiVal === 'string') {
      const css = PRESET_FONTS[uiVal];
      if (css) document.documentElement.style.setProperty('--island-ui-font', css);
    }
  } catch {
    /* ignore */
  }
}

/** 应用歌词字体到当前文档 */
export async function applyLyricsFontFromStore(): Promise<void> {
  try {
    const [lyricsVal, lyricsCustom] = await Promise.all([
      window.api.storeRead('lyrics-font-family'),
      window.api.storeRead('lyrics-custom-fonts'),
    ]);
    const lyricsCustomArr = Array.isArray(lyricsCustom) ? lyricsCustom as CustomFont[] : [];
    if (typeof lyricsVal === 'string' && lyricsVal.startsWith('custom:')) {
      const map = await loadCustomFonts(lyricsCustomArr, 'eIsland-Lyrics');
      const css = map.get(lyricsVal.slice(7));
      if (css) document.documentElement.style.setProperty('--island-lyrics-font', css);
    } else if (typeof lyricsVal === 'string') {
      const css = PRESET_FONTS[lyricsVal];
      if (css) document.documentElement.style.setProperty('--island-lyrics-font', css);
    }
  } catch {
    /* ignore */
  }
}

/**
 * 启动时初始化字体（在 React 挂载前执行，避免首次渲染闪烁）
 */
export async function initFonts(): Promise<void> {
  await Promise.all([applyUIFontFromStore(), applyLyricsFontFromStore()]);
}
