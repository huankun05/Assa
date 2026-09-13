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

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function applyObjectPosition(el: HTMLElement | null, x: number, y: number): void {
  if (!el) return;
  el.style.objectPosition = `${x}% ${y}%`;
}

function syncIslandLayer(x: number, y: number, stateId: PreviewStateId): void {
  const layer = document.getElementById('island-bg-layer');
  if (layer) {
    layer.style.backgroundPosition = `${x}% ${y}%`;
    layer.style.backgroundSize = 'cover';
  }
  window.dispatchEvent(new CustomEvent(LOCAL_ISLAND_BG_SYNC_EVENT, {
    detail: { posX: x, posY: y, stateId },
  }));
}

function persistStatePos(stateId: PreviewStateId, x: number, y: number): void {
  const keys = getIslandBgPositionKeys(stateId);
  void window.api.storeWrite(keys.x, x);
  void window.api.storeWrite(keys.y, y);
  void window.api.storeWrite('island-bg-position-x', x);
  void window.api.storeWrite('island-bg-position-y', y);
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
  const [pos, setPos] = useState<PosMap>({
    idle: { x: 50, y: 50 },
    hover: { x: 50, y: 50 },
    expand: { x: 50, y: 50 },
    maxExpand: { x: 50, y: 50 },
  });
  const mediaRef = useRef<HTMLElement | null>(null);
  const draggingRef = useRef(false);
  const draftRef = useRef({ x: 50, y: 50 });

  const current = PREVIEW_STATES.find((s) => s.id === stateId) ?? PREVIEW_STATES[1];
  const cur = pos[stateId];

  useEffect(() => {
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
      const next: PosMap = {
        idle: { x: 50, y: 50 },
        hover: { x: 50, y: 50 },
        expand: { x: 50, y: 50 },
        maxExpand: { x: 50, y: 50 },
      };
      for (const r of rows) next[r.id] = { x: r.x, y: r.y };
      setPos(next);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    draftRef.current = { x: cur.x, y: cur.y };
    applyObjectPosition(mediaRef.current, cur.x, cur.y);
    syncIslandLayer(cur.x, cur.y, stateId);
  }, [stateId, cur.x, cur.y]);

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
    // 与 object-position 一致：下=Y 增大（显示更靠下的画面），上=Y 减小
    const y = clampPct(((e.clientY - rect.top) / Math.max(1, rect.height)) * 100);
    draftRef.current = { x, y };
    // 只改 DOM，不 setState，避免拖拽中重渲染/回读
    applyObjectPosition(mediaRef.current, x, y);
  };

  const onPointerUp = (): void => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    const { x, y } = draftRef.current;
    setPos((prev) => ({ ...prev, [stateId]: { x, y } }));
    syncIslandLayer(x, y, stateId);
    persistStatePos(stateId, x, y);
  };

  const onSlider = (axis: 'x' | 'y', raw: number): void => {
    const v = clampPct(raw);
    const next = axis === 'x' ? { x: v, y: cur.y } : { x: cur.x, y: v };
    draftRef.current = next;
    setPos((prev) => ({ ...prev, [stateId]: next }));
    applyObjectPosition(mediaRef.current, next.x, next.y);
    syncIslandLayer(next.x, next.y, stateId);
    persistStatePos(stateId, next.x, next.y);
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
              ref={(el) => { mediaRef.current = el; }}
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
              ref={(el) => { mediaRef.current = el; }}
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
            onChange={(e) => onSlider('x', Number(e.target.value))}
          />
        </label>
        <label className="settings-field">
          <span className="settings-field-label">垂直 {cur.y}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={cur.y}
            onChange={(e) => onSlider('y', Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          className="settings-card-action-btn"
          onClick={() => {
            draftRef.current = { x: 50, y: 50 };
            setPos((prev) => ({ ...prev, [stateId]: { x: 50, y: 50 } }));
            applyObjectPosition(mediaRef.current, 50, 50);
            syncIslandLayer(50, 50, stateId);
            persistStatePos(stateId, 50, 50);
          }}
        >
          {t('settings.app.theme.bgResetPos', { defaultValue: '居中' })}
        </button>
      </div>
    </div>
  );
}
