/**
 * 壁纸分状态预览：各岛状态独立位置 + 拖拽调整 + 裁剪框示意
 */
import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  getIslandBgPositionKeys,
  LOCAL_ISLAND_BG_SYNC_EVENT,
} from '../../../config/settingsTabConfig';

type PreviewStateId = 'idle' | 'hover' | 'expand' | 'maxExpand';
type PosMap = Record<PreviewStateId, { x: number; y: number }>;

interface PreviewStateDef {
  id: PreviewStateId;
  label: string;
  w: number;
  h: number;
  radius: number;
}

const PREVIEW_STATES: PreviewStateDef[] = [
  { id: 'idle', label: '空闲', w: 260, h: 42, radius: 21 },
  { id: 'hover', label: '悬停', w: 500, h: 60, radius: 0 },
  { id: 'expand', label: '展开', w: 860, h: 150, radius: 18 },
  { id: 'maxExpand', label: '全展开', w: 860, h: 400, radius: 18 },
];

const PREVIEW_W = 560;
const PREVIEW_PAD = 8;
const DEFAULT_POS: PosMap = {
  idle: { x: 50, y: 50 },
  hover: { x: 50, y: 50 },
  expand: { x: 50, y: 50 },
  maxExpand: { x: 50, y: 50 },
};

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export interface BgStatePreviewProps {
  mediaType: 'image' | 'video' | null;
  previewUrl: string | null;
  videoFit: 'cover' | 'contain';
  opacity: number;
  blur: number;
}

export function BgStatePreview({
  mediaType,
  previewUrl,
  videoFit,
  opacity,
  blur,
}: BgStatePreviewProps): ReactElement | null {
  const { t } = useTranslation();
  const [stateId, setStateId] = useState<PreviewStateId>('hover');
  const [pos, setPos] = useState<PosMap>(DEFAULT_POS);
  const draggingRef = useRef(false);
  const loadedRef = useRef(false);

  const current = PREVIEW_STATES.find((s) => s.id === stateId) ?? PREVIEW_STATES[1];
  const cur = pos[stateId];

  /** 仅挂载时读一次 store，拖拽过程中不回读，避免重置 */
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let cancelled = false;
    void Promise.all(
      PREVIEW_STATES.map(async (s) => {
        const keys = getIslandBgPositionKeys(s.id);
        const [x, y] = await Promise.all([
          window.api.storeRead(keys.x),
          window.api.storeRead(keys.y),
        ]);
        return {
          id: s.id as PreviewStateId,
          x: typeof x === 'number' ? clampPct(x) : 50,
          y: typeof y === 'number' ? clampPct(y) : 50,
        };
      }),
    ).then((rows) => {
      if (cancelled) return;
      setPos((prev) => {
        const next = { ...prev };
        for (const r of rows) next[r.id] = { x: r.x, y: r.y };
        return next;
      });
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const applyLive = useCallback((x: number, y: number) => {
    const el = document.getElementById('island-bg-layer');
    if (el) {
      el.style.backgroundPosition = `${x}% ${y}%`;
      el.style.backgroundSize = 'cover';
    }
    window.dispatchEvent(new CustomEvent(LOCAL_ISLAND_BG_SYNC_EVENT, {
      detail: { posX: x, posY: y, stateId },
    }));
  }, [stateId]);

  const persistPos = useCallback((id: PreviewStateId, x: number, y: number) => {
    const keys = getIslandBgPositionKeys(id);
    void window.api.storeWrite(keys.x, x);
    void window.api.storeWrite(keys.y, y);
    void window.api.storeWrite('island-bg-position-x', x);
    void window.api.storeWrite('island-bg-position-y', y);
  }, []);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!mediaType || !previewUrl) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    draggingRef.current = true;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const x = clampPct(((e.clientX - rect.left) / Math.max(1, rect.width)) * 100);
    const yRaw = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
    const y = clampPct(100 - yRaw);
    setPos((prev) => ({ ...prev, [stateId]: { x, y } }));
    applyLive(x, y);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const p = pos[stateId];
    persistPos(stateId, p.x, p.y);
  };

  if (!mediaType || !previewUrl) return null;

  const scale = (PREVIEW_W - PREVIEW_PAD * 2) / current.w;
  const frameW = Math.round(current.w * scale);
  const frameH = Math.round(current.h * scale);
  const posStyle: CSSProperties = {
    objectFit: videoFit,
    objectPosition: `${cur.x}% ${cur.y}%`,
    opacity: Math.max(0, Math.min(100, opacity)) / 100,
    filter: blur > 0 ? `blur(${blur}px)` : 'none',
  };

  return (
    <div className="settings-bg-state-preview">
      <div className="settings-bg-state-tabs" role="tablist">
        {PREVIEW_STATES.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={stateId === s.id}
            className={`settings-bg-state-tab${stateId === s.id ? ' active' : ''}`}
            onClick={() => setStateId(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="settings-bg-state-stage" style={{ width: PREVIEW_W }}>
        <div
          className="settings-bg-state-canvas"
          style={{
            width: frameW + PREVIEW_PAD * 2,
            height: frameH + PREVIEW_PAD * 2,
            borderRadius: Math.max(8, current.radius * scale),
          }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          title={t('settings.app.theme.bgDragHint', { defaultValue: '拖拽调整背景位置' })}
        >
          {mediaType === 'video' ? (
            <video
              src={previewUrl}
              className="settings-bg-state-media"
              style={posStyle}
              autoPlay
              muted
              loop
              playsInline
            />
          ) : (
            <img
              src={previewUrl}
              alt=""
              className="settings-bg-state-media"
              style={posStyle}
              draggable={false}
            />
          )}
          <div
            className="settings-bg-state-viewport"
            style={{
              width: frameW,
              height: frameH,
              borderRadius: current.radius * scale,
            }}
          />
          <span className="settings-bg-state-badge">
            {current.label} · {current.w}×{current.h}
          </span>
        </div>
      </div>

      <div className="settings-bg-state-controls">
        <label className="settings-field">
          <span className="settings-field-label">水平 {cur.x}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={cur.x}
            onChange={(e) => {
              const v = clampPct(Number(e.target.value));
              const next = { x: v, y: cur.y };
              setPos((prev) => ({ ...prev, [stateId]: next }));
              applyLive(next.x, next.y);
              persistPos(stateId, next.x, next.y);
            }}
          />
        </label>
        <label className="settings-field">
          <span className="settings-field-label">垂直 {cur.y}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={cur.y}
            onChange={(e) => {
              const v = clampPct(Number(e.target.value));
              const next = { x: cur.x, y: v };
              setPos((prev) => ({ ...prev, [stateId]: next }));
              applyLive(next.x, next.y);
              persistPos(stateId, next.x, next.y);
            }}
          />
        </label>
        <button
          type="button"
          className="settings-card-action-btn"
          onClick={() => {
            setPos((prev) => ({ ...prev, [stateId]: { x: 50, y: 50 } }));
            applyLive(50, 50);
            persistPos(stateId, 50, 50);
          }}
        >
          {t('settings.app.theme.bgResetPos', { defaultValue: '居中' })}
        </button>
      </div>
    </div>
  );
}
