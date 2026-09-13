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
  const [posX, setPosX] = useState(50);
  const [posY, setPosY] = useState(50);
  const draggingRef = useRef(false);
  const persistTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const current = PREVIEW_STATES.find((s) => s.id === stateId) ?? PREVIEW_STATES[1];

  /** 切换状态时加载该状态独立位置（各状态互不影响） */
  useEffect(() => {
    let cancelled = false;
    const keys = getIslandBgPositionKeys(stateId);
    void Promise.all([
      window.api.storeRead(keys.x),
      window.api.storeRead(keys.y),
    ]).then(([x, y]) => {
      if (cancelled) return;
      setPosX(typeof x === 'number' ? clampPct(x) : 50);
      setPosY(typeof y === 'number' ? clampPct(y) : 50);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [stateId]);

  const applyPosition = useCallback((x: number, y: number, persist: boolean) => {
    const el = document.getElementById('island-bg-layer');
    if (el) {
      el.style.backgroundPosition = `${x}% ${y}%`;
      el.style.backgroundSize = 'cover';
    }
    window.dispatchEvent(new CustomEvent(LOCAL_ISLAND_BG_SYNC_EVENT, {
      detail: { posX: x, posY: y, stateId },
    }));
    window.api.settingsPreview('store:island-bg-position-x', x).catch(() => {});
    window.api.settingsPreview('store:island-bg-position-y', y).catch(() => {});
    if (persist) {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      persistTimerRef.current = setTimeout(() => {
        const keys = getIslandBgPositionKeys(stateId);
        void window.api.storeWrite(keys.x, x);
        void window.api.storeWrite(keys.y, y);
        // 同步全局键，便于当前岛实例立即应用
        void window.api.storeWrite('island-bg-position-x', x);
        void window.api.storeWrite('island-bg-position-y', y);
        persistTimerRef.current = null;
      }, 200);
    }
  }, [stateId]);

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!mediaType || !previewUrl) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    draggingRef.current = true;
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>): void => {
    if (!draggingRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = clampPct(((e.clientX - rect.left) / Math.max(1, rect.width)) * 100);
    // 拖拽方向与 object-position 垂直方向相反：向下拖 → 看到图上方
    const yRaw = ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100;
    const y = clampPct(100 - yRaw);
    setPosX(x);
    setPosY(y);
    applyPosition(x, y, true);
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLDivElement>): void => {
    draggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  if (!mediaType || !previewUrl) return null;

  const scale = (PREVIEW_W - PREVIEW_PAD * 2) / current.w;
  const frameW = Math.round(current.w * scale);
  const frameH = Math.round(current.h * scale);
  const posStyle: CSSProperties = {
    objectFit: videoFit,
    objectPosition: `${posX}% ${posY}%`,
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
              key={`${previewUrl}-${stateId}`}
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
              key={`${previewUrl}-${stateId}`}
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
          <span className="settings-field-label">水平 {posX}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={posX}
            onChange={(e) => {
              const v = clampPct(Number(e.target.value));
              setPosX(v);
              applyPosition(v, posY, true);
            }}
          />
        </label>
        <label className="settings-field">
          <span className="settings-field-label">垂直 {posY}%</span>
          <input
            type="range"
            min={0}
            max={100}
            value={posY}
            onChange={(e) => {
              const v = clampPct(Number(e.target.value));
              setPosY(v);
              applyPosition(posX, v, true);
            }}
          />
        </label>
        <button
          type="button"
          className="settings-card-action-btn"
          onClick={() => {
            setPosX(50);
            setPosY(50);
            applyPosition(50, 50, true);
          }}
        >
          {t('settings.app.theme.bgResetPos', { defaultValue: '居中' })}
        </button>
      </div>
    </div>
  );
}
