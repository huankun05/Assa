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
 * @file LyricsTab.tsx
 * @description 歌曲 Tab（hover 音乐展板）
 * @description 实时反映 SMTC 正在播放的曲目（网易云音乐 / QQ音乐 / 汽水音乐等）：
 *              左：专辑封面；中：播放中显示实时歌词行 + 歌名·歌手，未播放显示歌名 + 歌手；
 *              右：喜欢(♥) 与 上一曲/播放暂停/下一曲。
 * @author 鸡哥
 */

import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useIslandStore from '../../../../../../store/slices';
import { SvgIcon } from '../../../../../../utils/SvgIcon';
import { useMediaLike } from '../../../../../hooks/useMediaLike';
import { useCurrentLyric } from '../../../../lyrics/hooks/useCurrentLyric';
import { truncateByVisualWidth } from '../utils/lyricUtils';
import { SilkyWave } from './SilkyWave';
import { MusicBgWavePreview } from '../../../../maxExpand/components/setting/components/app/preview/MusicBgWavePreview';
import { HOVER_MUSIC_BG_STYLE_STORE_KEY } from '../../../../maxExpand/components/setting/config/settingsTabConfig';

type HoverMusicBgStyle = 'silky' | 'wave';

/**
 * 喜欢按钮图标
 * @description 内联 SVG 以便按状态控制填充色：未收藏为描边心形，已收藏为红色实心心形
 * @param filled - 是否已收藏
 */
function HeartIcon({ filled }: { filled: boolean }): ReactElement {
  return (
    <svg
      className="lrc-heart-icon"
      viewBox="0 0 24 24"
      width="15"
      height="15"
      aria-hidden="true"
      focusable="false"
    >
      {/*
        用内联 style 而非 fill 属性：lrc.css 里的 `.lrc-media-btn svg { fill: currentColor }`
        优先级高于 SVG 表现属性，只有内联样式才能覆盖它。
      */}
      <path
        d="M12 20.6 4.7 13.5a4.9 4.9 0 0 1 0-7 4.9 4.9 0 0 1 6.9 0l.4.4.4-.4a4.9 4.9 0 0 1 6.9 0 4.9 4.9 0 0 1 0 7Z"
        style={{ fill: filled ? 'currentColor' : 'none' }}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * 歌曲 Tab 内容
 * @description 实时展示 SMTC 当前播放曲目，并提供喜欢与播放控制
 * @returns 歌曲 Tab 元素
 */
export function LyricsTab(): ReactElement {
  const { t } = useTranslation();

  const isMusicPlaying = useIslandStore((state) => state.isMusicPlaying);
  const isPlaying = useIslandStore((state) => state.isPlaying);
  const mediaInfo = useIslandStore((state) => state.mediaInfo);
  const coverImage = useIslandStore((state) => state.coverImage);
  const dominantColor = useIslandStore((state) => state.dominantColor);
  const syncedLyrics = useIslandStore((state) => state.syncedLyrics);
  const lyricsLoading = useIslandStore((state) => state.lyricsLoading);
  const currentPositionMs = useIslandStore((state) => state.currentPositionMs);

  const [bgStyle, setBgStyle] = useState<HoverMusicBgStyle>('silky');

  const { currentText, hasLyrics, isIntro } = useCurrentLyric(
    syncedLyrics,
    lyricsLoading,
    currentPositionMs,
  );
  const { liked, toggle: toggleLike } = useMediaLike(mediaInfo.title, mediaInfo.artist, mediaInfo.album);

  useEffect(() => {
    window.api.storeRead(HOVER_MUSIC_BG_STYLE_STORE_KEY).then((v) => {
      if (v === 'silky' || v === 'wave') setBgStyle(v);
    }).catch(() => {});
  }, []);

  const handlePlayPause = () => window.api?.mediaPlayPause();
  const handlePrev = () => window.api?.mediaPrev();
  const handleNext = () => window.api?.mediaNext();

  const titleText = truncateByVisualWidth(
    mediaInfo.title || t('hover.music.unknownTitle', { defaultValue: '未知歌曲' }),
    45,
  );
  const artistText = truncateByVisualWidth(
    mediaInfo.artist || t('hover.music.unknownArtist', { defaultValue: '未知艺术家' }),
    50,
  );

  /** 播放中且已拿到当前行歌词时，主行显示歌词；前奏（尚未到第一句）时回退为歌名 */
  const showLyric = isMusicPlaying && hasLyrics && !isIntro && Boolean(currentText);
  // 未播放也常驻显示歌名/歌手（无任何媒体数据时显示「未知歌曲/未知歌手」）
  const primaryText = showLyric
    ? truncateByVisualWidth(currentText, 45)
    : titleText;
  const secondaryText = showLyric
    ? `${titleText} · ${artistText}`
    : artistText;
  /** 完全没有任何媒体数据时置灰 */
  const hasMedia = Boolean(mediaInfo.title);

  // dominantColor 范围 0-255，SilkyWave 和 MusicBgWavePreview 都使用 0-255 范围
  const waveColor = dominantColor ?? [0, 0, 0];

  return (
    <div className={`lrc-tab-wrapper ${isPlaying ? 'playing' : ''}`}>
      <div className="lrc-vinyl-disc">
        <div
          className="lrc-vinyl-cover"
          style={coverImage ? { backgroundImage: `url(${coverImage})` } : undefined}
        />
      </div>

      <div className="lrc-info-section">
        <div className={`lrc-primary ${!hasMedia ? 'inactive' : ''}`}>
          {primaryText}
        </div>
        <div className="lrc-secondary">{secondaryText}</div>
      </div>

      <div className="lrc-media-controls">
        <button
          className={`lrc-media-btn lrc-like-btn ${liked ? 'is-liked' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleLike(); }}
          title={liked ? t('hover.music.unlike', { defaultValue: '取消喜欢' }) : t('hover.music.like', { defaultValue: '喜欢' })}
          aria-pressed={liked}
          disabled={!hasMedia}
        >
          <HeartIcon filled={liked} />
        </button>

        <div className="lrc-media-play-group">
          <button
            className="lrc-media-btn"
            onClick={(e) => { e.stopPropagation(); handlePrev(); }}
            title={t('hover.music.prev', { defaultValue: '上一曲' })}
            disabled={!hasMedia}
          >
            <img src={SvgIcon.PREVIOUS_SONG} alt={t('hover.music.prev', { defaultValue: '上一曲' })} className="lrc-media-btn-icon lrc-media-btn-icon--sm" />
          </button>
          <button
            className="lrc-media-btn lrc-play-btn"
            onClick={(e) => { e.stopPropagation(); handlePlayPause(); }}
            title={isPlaying ? t('hover.music.pause', { defaultValue: '暂停' }) : t('hover.music.play', { defaultValue: '播放' })}
            disabled={!hasMedia}
          >
            {isPlaying ? (
              <img src={SvgIcon.PAUSE} alt={t('hover.music.pause', { defaultValue: '暂停' })} className="lrc-media-btn-icon" />
            ) : (
              <img src={SvgIcon.CONTINUE} alt={t('hover.music.play', { defaultValue: '播放' })} className="lrc-media-btn-icon" />
            )}
          </button>
          <button
            className="lrc-media-btn"
            onClick={(e) => { e.stopPropagation(); handleNext(); }}
            title={t('hover.music.next', { defaultValue: '下一曲' })}
            disabled={!hasMedia}
          >
            <img src={SvgIcon.NEXT_SONG} alt={t('hover.music.next', { defaultValue: '下一曲' })} className="lrc-media-btn-icon lrc-media-btn-icon--sm" />
          </button>
        </div>
      </div>

      <div className="lrc-wave-container">
        {bgStyle === 'wave' ? (
          <MusicBgWavePreview color={waveColor} playing={isPlaying} />
        ) : (
          <SilkyWave color={waveColor} playing={isPlaying} />
        )}
      </div>
    </div>
  );
}
