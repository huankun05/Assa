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
 * @file capture.js
 * @description 截图选区与涂鸦交互逻辑，负责选区绘制、马赛克/线条/矩形/画笔标注及结果导出
 * @author 鸡哥
 */

const { ipcRenderer, clipboard } = require('electron');

const bgCanvas = document.getElementById('bg-canvas');
const drawCanvas = document.getElementById('draw-canvas');
const tempCanvas = document.getElementById('temp-canvas');
const captureHole = document.getElementById('captureHole');
const captureHandles = document.getElementById('captureHandles');

const bgCtx = bgCanvas.getContext('2d');
const drawCtx = drawCanvas.getContext('2d');
const tempCtx = tempCanvas.getContext('2d');

const sizeInfo = document.getElementById('size-info');
const toolbar = document.getElementById('toolbar');
const captureSourceBadge = document.getElementById('captureSourceBadge');
const colorPicker = document.getElementById('colorPicker');
const sizePicker = document.getElementById('sizePicker');
const btnUndo = document.getElementById('btnUndo');
const btnOcr = document.getElementById('btnOcr');
const ocrProIcon = document.querySelector('.capture-ocr-pro-icon');
const ocrPanel = document.getElementById('ocrPanel');
const ocrText = document.getElementById('ocrText');
const btnOcrCopy = document.getElementById('btnOcrCopy');
const translateText = document.getElementById('translateText');
const btnTranslateCopy = document.getElementById('btnTranslateCopy');
const translateSection = document.getElementById('translateSection');
const btnOcrClose = document.getElementById('btnOcrClose');
const btnTranslate = document.getElementById('btnTranslate');
const btnTranslateLabel = document.getElementById('btnTranslateLabel');
const translateOverlay = document.getElementById('translateOverlay');
const translateMessage = document.getElementById('translateMessage');
const magnifier = document.getElementById('magnifier');
const magnifierCanvas = document.getElementById('magnifier-canvas');
const captureHint = document.getElementById('captureHint');

let bgImage = null;
let W = 0;
let H = 0;
let scaleFactor = 1;
let captureDisplays = [];
let captureVirtualScreen = null;
let capturePhysicalScreen = null;

let selX = 0;
let selY = 0;
let selW = 0;
let selH = 0;

const STATE = { IDLE: 0, DRAWING: 1, SELECTED: 2, MOVING: 3, RESIZING: 4, ANNOTATING: 5 };
let state = STATE.IDLE;

let startX = 0;
let startY = 0;
let moveOffX = 0;
let moveOffY = 0;
let resizeHandle = '';
let resizeAnchorX = 0;
let resizeAnchorY = 0;

let activeTool = 'select';
let drawingColor = '#ff4d4f';
let drawingSize = 4;
let annotStartX = 0;
let annotStartY = 0;
let penLastX = 0;
let penLastY = 0;

const HANDLE_SIZE = 5;
const HANDLE_HIT = 8;
/** 撤销历史最大步数（正常选区可达上限） */
const MAX_HISTORY = 10;
/**
 * 历史栈总内存预算（字节）。高分屏全屏选区单快照可达 ~20MB（DPR=2, 2880×1800×4），
 * 若仍允许 10 步会吃 ~200MB；按快照面积动态收缩上限，把峰值压在预算内。
 * 典型小选区（几百 KB~2MB）不受影响，仍可撤销 10 步。
 */
const HISTORY_BUDGET_BYTES = 128 * 1024 * 1024;
const historyStack = [];
let currentCaptureObjectUrl = '';
let captureLanguage = 'zh-CN';
let captureWindowRects = [];
let hoverWindowRect = null;
let pendingWindowClickRect = null;
let isTranslating = false;
let isRecognizing = false;
let ocrEngine = 'server';
let translateEngine = 'server';
let recognizedText = '';
let translatedText = '';
let translationCache = null;
let displayedImageVersion = 'original';

/** 放大镜状态：固定放大倍数（Snipaste 式，不循环切换）。
 * MAGNIFIER_SIZE 取 zoom 整数倍（46 源像素 × 4 = 184 CSS px），保证像素网格精确对齐。 */
const MAGNIFIER_ZOOM = 4;
const MAGNIFIER_SIZE = 184;
const magnifierCtx = magnifierCanvas ? magnifierCanvas.getContext('2d') : null;

const CAPTURE_I18N = {
  'zh-CN': {
    source: { plugin: '使用插件', js: '使用js' },
    tools: {
      select: '选区',
      mosaic: '马赛克',
      line: '直线',
      rect: '矩形',
      pen: '画笔',
      undo: '撤销',
      color: '颜色',
      size: '粗细',
      save: '保存',
      ocr: '文字识别',
      ocrResult: '文字识别结果',
      translateResult: '翻译结果',
      copyTranslation: '复制译文',
      recognizing: '识别中',
      ocrLoginRequired: '请先登录后再使用文字识别',
      copyText: '复制文本',
      copied: '已复制',
      close: '关闭',
      noTextFound: '未识别到文字',
      ocrFailed: '文字识别失败',
      ocrTimeout: '文字识别请求已取消或超时',
      imageTooLarge: '截图不能超过 10MB',
      invalidImageDimensions: '截图边长需为 15～8192 像素，且长宽比小于 50',
      translate: '图片翻译',
      showOriginal: '显示原文',
      showTranslation: '显示译文',
      translating: '翻译中',
      loginRequired: '请先登录 Pro 账号后再使用图片翻译',
      translateFailed: '图片翻译失败',
      invalidData: '无效的截图数据',
      submitFailed: '图片翻译任务提交失败',
      queryFailed: '查询图片翻译任务失败',
      noResultUrl: '服务端未返回翻译图片',
      timeout: '图片翻译等待超时，请稍后重试',
      aborted: '图片翻译请求已取消或超时',
      captureWindowClosed: '截图窗口已关闭',
      cancel: '取消',
      done: '完成',
      captureHint: '拖拽框选截图区域 · 悬停窗口可快速选中 · Enter 完成 · Esc 取消',
      captureInputText: '输入文字',
    },
  },
  'en-US': {
    source: { plugin: 'Using plugin', js: 'Using JS' },
    tools: {
      select: 'Select',
      mosaic: 'Mosaic',
      line: 'Line',
      rect: 'Rectangle',
      pen: 'Pen',
      undo: 'Undo',
      color: 'Color',
      size: 'Size',
      save: 'Save',
      ocr: 'Recognize text',
      ocrResult: 'Recognized text',
      translateResult: 'Translation',
      copyTranslation: 'Copy translation',
      recognizing: 'Recognizing',
      ocrLoginRequired: 'Please sign in to use text recognition',
      copyText: 'Copy text',
      copied: 'Copied',
      close: 'Close',
      noTextFound: 'No text recognized',
      ocrFailed: 'Text recognition failed',
      ocrTimeout: 'Text recognition was cancelled or timed out',
      imageTooLarge: 'Screenshot must not exceed 10MB',
      invalidImageDimensions: 'Image sides must be 15–8192 px with an aspect ratio below 50',
      translate: 'Translate',
      showOriginal: 'Show original',
      showTranslation: 'Show translation',
      translating: 'Translating',
      loginRequired: 'Please sign in to a Pro account to translate images',
      translateFailed: 'Image translation failed',
      invalidData: 'Invalid screenshot data',
      submitFailed: 'Failed to submit image translation task',
      queryFailed: 'Failed to query image translation task',
      noResultUrl: 'Server did not return translated image',
      timeout: 'Image translation timed out, please try again',
      aborted: 'Image translation request was cancelled or timed out',
      captureWindowClosed: 'Screenshot window was closed',
      cancel: 'Cancel',
      done: 'Done',
      captureHint: 'Drag to select a region · Hover a window to select it · Enter to finish · Esc to cancel',
      captureInputText: 'Enter text',
    },
  },
};

function normalizeCaptureLanguage(raw) {
  if (typeof raw !== 'string') return 'zh-CN';
  if (raw === 'en' || raw === 'en-US' || raw.startsWith('en-')) return 'en-US';
  return 'zh-CN';
}

function tCapture(key) {
  return CAPTURE_I18N[captureLanguage].tools[key] || CAPTURE_I18N['zh-CN'].tools[key] || key;
}

function applyCaptureLanguage(language) {
  captureLanguage = normalizeCaptureLanguage(language);
  document.documentElement.lang = captureLanguage;
  Array.from(document.querySelectorAll('[data-i18n]')).forEach((el) => {
    el.textContent = tCapture(el.dataset.i18n);
  });
  Array.from(document.querySelectorAll('[data-i18n-title]')).forEach((el) => {
    el.title = tCapture(el.dataset.i18nTitle);
  });
  Array.from(document.querySelectorAll('[data-i18n-aria-label]')).forEach((el) => {
    el.setAttribute('aria-label', tCapture(el.dataset.i18nAriaLabel));
  });
  updateTranslateButtonLabel();
  setCaptureSource(captureSourceBadge?.dataset.captureSource || 'js');
}

async function initCaptureLanguage() {
  try {
    const stored = await ipcRenderer.invoke('store:read', 'i18n-language');
    applyCaptureLanguage(stored);
  } catch {
    applyCaptureLanguage(navigator.language);
  }
}

void initCaptureLanguage();

async function initOcrEngine() {
  try {
    // 与 src/shared/storeKeys.ts 中 SCREENSHOT_OCR_ENGINE_STORE_KEY 保持一致。
    // store:read 未设置时返回 null → 一律落到本机 Tesseract（秒开），与设置页/storeConfig 默认值一致，
    // 只有用户显式选过 paddleocr/server 才用服务端（避免首装误走需登录的 server OCR）。
    const stored = await ipcRenderer.invoke('store:read', 'screenshot-ocr-engine');
    ocrEngine = stored === 'paddleocr' || stored === 'server' ? stored : 'local';
    // 与 src/shared/storeKeys.ts 中 SCREENSHOT_TRANSLATE_ENGINE_STORE_KEY 保持一致。
    // 未设置/null → 本机 Hy-MT2（免费离线）；'cloud' 也走本地服务 IPC（主进程按配置转发云端百度翻译）。
    const trStored = await ipcRenderer.invoke('store:read', 'screenshot-translate-engine');
    translateEngine = trStored === 'server' || trStored === 'cloud' ? trStored : 'local';
  } catch {
    ocrEngine = 'local';
    translateEngine = 'local';
  }
  if (ocrProIcon) {
    // 本机引擎（Tesseract / PaddleOCR）都不需要服务端会员标识
    ocrProIcon.style.display = ocrEngine === 'server' ? '' : 'none';
  }
  const translateProIcon = document.querySelector('.capture-translate-pro-icon');
  if (translateProIcon) {
    // 翻译按钮同理：本机 Hy-MT2 不需要服务端会员标识
    translateProIcon.style.display = translateEngine === 'server' ? '' : 'none';
  }
}

void initOcrEngine();

/** 当前窗口 DPR（高分屏 >1），canvas backing store 与 CSS 显示尺寸分离 */
let canvasDpr = 1;

/**
 * 设置 canvas 的 backing store 为物理分辨率、CSS 显示为逻辑分辨率，
 * 并让 2D context 以 DPR 缩放，使后续绘制代码可用逻辑坐标直接操作。
 */
function setupCanvasDpr(cv) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = window.innerWidth;
  const cssH = window.innerHeight;
  cv.width = Math.round(cssW * dpr);
  cv.height = Math.round(cssH * dpr);
  cv.style.width = `${cssW}px`;
  cv.style.height = `${cssH}px`;
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}

/**
 * 初始化各层画布尺寸
 * @description 在窗口尺寸变化后同步画布，保证坐标系统一致。
 * 背景层 bgCanvas 一次性绘制屏幕位图；标注/临时层按需重绘；
 * 遮罩与选区已 DOM 化（captureHole/captureHandles），不再占用 canvas 图层。
 */
function initCanvases() {
  canvasDpr = window.devicePixelRatio || 1;
  W = window.innerWidth;
  H = window.innerHeight;
  [bgCanvas, drawCanvas, tempCanvas].forEach(setupCanvasDpr);
  drawBackground();
  redrawFromHistoryTop();
  drawMask();
}

function drawBackground() {
  bgCtx.clearRect(0, 0, W, H);
  if (!bgImage) return;

  if (!captureVirtualScreen || !capturePhysicalScreen || captureDisplays.length === 0) {
    bgCtx.drawImage(bgImage, 0, 0, W, H);
    return;
  }

  const sourceScaleX = bgImage.naturalWidth / capturePhysicalScreen.width;
  const sourceScaleY = bgImage.naturalHeight / capturePhysicalScreen.height;
  captureDisplays.forEach((display) => {
    const source = display.physicalBounds;
    const target = display.bounds;
    bgCtx.drawImage(
      bgImage,
      (source.x - capturePhysicalScreen.x) * sourceScaleX,
      (source.y - capturePhysicalScreen.y) * sourceScaleY,
      source.width * sourceScaleX,
      source.height * sourceScaleY,
      target.x - captureVirtualScreen.x,
      target.y - captureVirtualScreen.y,
      target.width,
      target.height,
    );
  });
}

function clearTemp() {
  tempCtx.clearRect(0, 0, W, H);
}

/**
 * 绘制遮罩层与选区边框
 * @description 非选区区域使用半透明遮罩，便于用户聚焦当前操作区域
 */
/**
 * 更新遮罩与选区装饰（DOM 版，取代旧的全屏 canvas 遮罩重绘）
 * @description 单个 "洞" div（选区区域透明）+ 超大 box-shadow 形成四周遮罩；
 * 选区外沿用边框高亮；resize 手柄为 DOM span，随选区位置批量更新。
 * 全部为样式定位（GPU 合成），避免每次 mousemove 全屏填充 canvas。
 */
function layoutHole(hole) {
  // hole: null → 整屏遮罩（未进入任何选区）
  if (!hole) {
    captureHole.classList.add('is-full');
    captureHole.classList.remove('is-deep');
    captureHole.style.display = 'block';
    captureHole.style.left = '0px';
    captureHole.style.top = '0px';
    captureHole.style.width = `${W}px`;
    captureHole.style.height = `${H}px`;
    return;
  }
  captureHole.classList.remove('is-full');
  captureHole.classList.add('is-deep');
  captureHole.style.display = 'block';
  captureHole.style.left = `${hole.x}px`;
  captureHole.style.top = `${hole.y}px`;
  captureHole.style.width = `${hole.width}px`;
  captureHole.style.height = `${hole.height}px`;
}

function layoutHandles(visible) {
  if (!visible) {
    captureHandles.style.display = 'none';
    return;
  }
  captureHandles.style.display = 'block';
  captureHandles.style.left = `${selX}px`;
  captureHandles.style.top = `${selY}px`;
  captureHandles.style.width = `${selW}px`;
  captureHandles.style.height = `${selH}px`;
}

function drawMask() {
  if (captureHint) {
    // 仅 IDLE（未选区）时显示操作提示，进入选区/标注后隐藏
    captureHint.style.display = state === STATE.IDLE ? 'flex' : 'none';
  }

  if (state === STATE.IDLE) {
    // 未选区：仅 hover 到窗口时开洞高亮，否则整屏遮罩
    if (!hoverWindowRect) {
      layoutHole(null);
      layoutHandles(false);
      return;
    }
    layoutHole(hoverWindowRect);
    layoutHandles(false);
    return;
  }

  // 选区/拖动/标注中：洞 = 当前选区
  if (selW >= 1 && selH >= 1) {
    layoutHole({ x: selX, y: selY, width: selW, height: selH });
  } else {
    layoutHole(null);
  }
  layoutHandles(
    activeTool === 'select'
    && (state === STATE.SELECTED || state === STATE.MOVING || state === STATE.RESIZING),
  );
}

function getHandlePositions() {
  const cx = selX + selW / 2;
  const cy = selY + selH / 2;
  return {
    tl: [selX, selY],
    t: [cx, selY],
    tr: [selX + selW, selY],
    r: [selX + selW, cy],
    br: [selX + selW, selY + selH],
    b: [cx, selY + selH],
    bl: [selX, selY + selH],
    l: [selX, cy],
  };
}

function hitTestHandle(mx, my) {
  const handles = getHandlePositions();
  const matched = Object.entries(handles).find((entry) => {
    const p = entry[1];
    return Math.abs(mx - p[0]) <= HANDLE_HIT && Math.abs(my - p[1]) <= HANDLE_HIT;
  });
  return matched ? matched[0] : '';
}

function isInsideSelection(mx, my) {
  return mx >= selX && mx <= selX + selW && my >= selY && my <= selY + selH;
}

/**
 * 设置可见窗口矩形列表
 * @description 将窗口的虚拟屏幕坐标转换为画布相对坐标，支持多显示器偏移
 * @param windows - 原始窗口边界数组（虚拟屏幕坐标）
 * @param virtualScreen - 虚拟屏幕边界 { x, y, width, height }
 */
function setVisibleWindowRects(windows, virtualScreen) {
  const vs = virtualScreen || { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
  captureWindowRects = Array.isArray(windows)
    ? windows.map((item) => {
      const left = Math.max(item.x, vs.x);
      const top = Math.max(item.y, vs.y);
      const right = Math.min(item.x + item.width, vs.x + vs.width);
      const bottom = Math.min(item.y + item.height, vs.y + vs.height);
      return {
        x: Math.max(0, Math.round(left - vs.x)),
        y: Math.max(0, Math.round(top - vs.y)),
        width: Math.max(0, Math.round(right - left)),
        height: Math.max(0, Math.round(bottom - top)),
        title: item.title || '',
      };
    }).filter((item) => item.width >= 40 && item.height >= 40)
    : [];
}

function findWindowRectAt(mx, my) {
  return captureWindowRects.find((item) => (
    mx >= item.x && mx <= item.x + item.width && my >= item.y && my <= item.y + item.height
  )) || null;
}

function selectWindowRect(rect) {
  resetTranslationCache();
  selX = rect.x;
  selY = rect.y;
  selW = rect.width;
  selH = rect.height;
  hoverWindowRect = null;
  state = STATE.SELECTED;
  historyStack.length = 0;
  drawCtx.clearRect(0, 0, W, H);
  showToolbar();
  drawMask();
  updateSizeInfo(selX, selY);
}

function clipToSelection(ctx) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(selX, selY, selW, selH);
  ctx.clip();
}

function restoreClip(ctx) {
  ctx.restore();
}

/**
 * 历史栈：仅存储选区范围内的 ImageData 快照，避免高分屏整屏快照导致内存暴涨。
 * 采用 historyIndex + historyStack 的线性模型：commit 时截断后续分支，
 * undo/redo 通过移动 historyIndex 并在绘制层重绘对应快照实现。
 */
/** 当前历史状态索引，-1 表示空白画布 */
let historyIndex = -1;

/**
 * 提交一次标注后的状态到历史栈（截断 redo 分支）。
 * 历史深度按快照字节数动态收缩：小选区允许 MAX_HISTORY 步，
 * 高分屏大选区（单快照可达 ~20MB）自动降低步数，把总内存压在 HISTORY_BUDGET_BYTES 内。
 */
function commitHistory() {
  if (selW < 1 || selH < 1) return;
  const dpr = canvasDpr;
  const snap = {
    data: drawCtx.getImageData(Math.round(selX * dpr), Math.round(selY * dpr), Math.round(selW * dpr), Math.round(selH * dpr)),
    x: selX,
    y: selY,
    w: selW,
    h: selH,
  };
  historyStack.length = historyIndex + 1;
  historyStack.push(snap);
  const snapBytes = snap.data.data.length;
  const cap = snapBytes > 0 ? Math.min(MAX_HISTORY, Math.max(1, Math.floor(HISTORY_BUDGET_BYTES / snapBytes))) : MAX_HISTORY;
  while (historyStack.length > cap) historyStack.shift();
  historyIndex = historyStack.length - 1;
}

/** 将 historyIndex 指向的快照重绘到绘制层（-1 表示清空为空白画布） */
function restoreHistoryTop() {
  drawCtx.clearRect(0, 0, W, H);
  if (historyIndex >= 0) {
    const snap = historyStack[historyIndex];
    if (snap) {
      const dpr = canvasDpr;
      drawCtx.putImageData(snap.data, Math.round(snap.x * dpr), Math.round(snap.y * dpr));
    }
  }
}

function undoLast() {
  if (historyIndex < 0) return;
  historyIndex -= 1;
  restoreHistoryTop();
}

function redoLast() {
  if (historyIndex >= historyStack.length - 1) return;
  historyIndex += 1;
  restoreHistoryTop();
}

/** 物理像素化：CSS 坐标 × scaleFactor（≈DPR），与 Snipaste 显示真实屏幕像素一致 */
function physPx(css) {
  const sf = scaleFactor && scaleFactor > 0 ? scaleFactor : 1;
  return Math.round(css * sf);
}

function updateSizeInfo(mx, my) {
  if (state === STATE.IDLE) {
    // 空闲跟随：显示光标物理坐标（Snipaste 风格信息条）
    sizeInfo.style.display = 'block';
    sizeInfo.textContent = `${physPx(mx)}, ${physPx(my)}`;
    sizeInfo.style.left = `${Math.min(mx + 12, W - 90)}px`;
    sizeInfo.style.top = `${Math.min(my + 12, H - 28)}px`;
    return;
  }
  if (state === STATE.SELECTED || state === STATE.MOVING || state === STATE.RESIZING || state === STATE.ANNOTATING || state === STATE.DRAWING) {
    sizeInfo.style.display = 'block';
    sizeInfo.textContent = `${physPx(selW)} × ${physPx(selH)}  (${physPx(selX)}, ${physPx(selY)})`;
    sizeInfo.style.left = `${selX}px`;
    sizeInfo.style.top = `${Math.max(selY - 26, 0)}px`;
    return;
  }
}

/**
 * Snipaste 式像素放大镜：固定倍数、像素网格、整数像素对齐采样。
 * @description 采样源为 bgCanvas（物理分辨率 backing，1:1 还原各显示器）；
 * 以光标所在物理像素为中心，取整数个源像素放大，避免亚像素插值产生的模糊。
 * @param mx - 鼠标 CSS x（窗口内）
 * @param my - 鼠标 CSS y（窗口内）
 */
function updateMagnifier(mx, my) {
  if (!magnifier || !magnifierCanvas || !magnifierCtx || !bgImage) return;
  const dpr = window.devicePixelRatio || 1;
  const css = MAGNIFIER_SIZE;
  const zoom = MAGNIFIER_ZOOM;
  const physical = Math.round(css * dpr);

  if (magnifierCanvas.width !== physical) {
    magnifierCanvas.width = physical;
    magnifierCanvas.height = physical;
  }
  magnifierCtx.setTransform(1, 0, 0, 1, 0, 0);
  magnifierCtx.imageSmoothingEnabled = false;
  magnifierCtx.clearRect(0, 0, physical, physical);

  // 光标所在物理像素（对齐到整数）
  const cxPhys = Math.round(mx * dpr);
  const cyPhys = Math.round(my * dpr);
  // 每边源像素数 = MAGNIFIER_SIZE / zoom（整数），源跨度物理像素 = 每边源像素 × dpr
  const srcPixels = MAGNIFIER_SIZE / MAGNIFIER_ZOOM;
  const srcSpan = Math.round(srcPixels * dpr);
  const srcHalf = Math.floor(srcSpan / 2);
  const sx = cxPhys - srcHalf;
  const sy = cyPhys - srcHalf;

  // 从 bgCanvas（物理 backing）采样 → 目标物理画布（每源像素正好 zoom×dpr 物理像素），最近邻放大
  magnifierCtx.drawImage(bgCanvas, sx, sy, srcSpan, srcSpan, 0, 0, physical, physical);

  // 像素网格：按每个源像素 = zoom*dpr 物理像素的位置画线（Snipaste 风格）
  const cell = zoom * dpr;
  magnifierCtx.strokeStyle = 'rgba(255,255,255,0.3)';
  magnifierCtx.lineWidth = 1;
  magnifierCtx.beginPath();
  for (let i = 1; i < zoom; i++) {
    const p = Math.round(i * cell) + 0.5;
    magnifierCtx.moveTo(p, 0);
    magnifierCtx.lineTo(p, physical);
    magnifierCtx.moveTo(0, p);
    magnifierCtx.lineTo(physical, p);
  }
  magnifierCtx.stroke();

  // 中心十字线（定位当前光标像素）
  magnifierCtx.strokeStyle = 'rgba(255,255,255,.95)';
  magnifierCtx.lineWidth = 1;
  const hcx = physical / 2 + 0.5;
  const hcy = physical / 2 + 0.5;
  magnifierCtx.beginPath();
  magnifierCtx.moveTo(hcx, 0);
  magnifierCtx.lineTo(hcx, physical);
  magnifierCtx.moveTo(0, hcy);
  magnifierCtx.lineTo(physical, hcy);
  magnifierCtx.stroke();

  // 定位：默认显示在光标右下，越界自动翻转到左侧/上方
  const boxW = magnifier.offsetWidth || css;
  const boxH = magnifier.offsetHeight || css;
  let left = mx + 18;
  let top = my + 18;
  if (left + boxW > window.innerWidth - 4) left = mx - boxW - 18;
  if (top + boxH > window.innerHeight - 4) top = my - boxH - 18;
  left = Math.max(4, Math.min(left, window.innerWidth - boxW - 4));
  top = Math.max(4, Math.min(top, window.innerHeight - boxH - 4));
  magnifier.style.left = `${Math.round(left)}px`;
  magnifier.style.top = `${Math.round(top)}px`;
}

function showMagnifier(mx, my) {
  if (!magnifier || !bgImage) return;
  magnifier.style.display = 'block';
  updateMagnifier(mx, my);
}

function hideMagnifier() {
  if (magnifier) magnifier.style.display = 'none';
}

function setCaptureSource(source) {
  if (!captureSourceBadge) return;
  const safeSource = source === 'plugin' ? 'plugin' : 'js';
  captureSourceBadge.dataset.captureSource = safeSource;
  captureSourceBadge.textContent = CAPTURE_I18N[captureLanguage].source[safeSource];
}

function showToolbar() {
  toolbar.style.display = 'flex';
  const tbW = toolbar.offsetWidth || 520;
  const tbH = toolbar.offsetHeight || 40;
  let tx = selX + selW - tbW;
  if (tx < 6) tx = 6;
  let ty = selY + selH + 8;
  if (ty + tbH > H - 6) ty = selY - tbH - 8;
  if (ty < 6) ty = 6;
  toolbar.style.left = `${tx}px`;
  toolbar.style.top = `${ty}px`;
}

function hideToolbar() {
  toolbar.style.display = 'none';
}

function positionTranslateOverlay() {
  translateOverlay.style.left = `${selX}px`;
  translateOverlay.style.top = `${selY}px`;
  translateOverlay.style.width = `${selW}px`;
  translateOverlay.style.height = `${selH}px`;
}

function showTranslateOverlay(message, isError = false) {
  positionTranslateOverlay();
  translateMessage.textContent = message;
  translateOverlay.classList.toggle('is-error', isError);
  translateOverlay.style.display = 'flex';
}

function hideTranslateOverlay() {
  translateOverlay.style.display = 'none';
  translateOverlay.classList.remove('is-error');
}

function rectanglesOverlap(first, second) {
  return first.left < second.left + second.width
    && first.left + first.width > second.left
    && first.top < second.top + second.height
    && first.top + first.height > second.top;
}

function getToolbarRect() {
  const previousDisplay = toolbar.style.display;
  const previousVisibility = toolbar.style.visibility;
  toolbar.style.display = 'flex';
  toolbar.style.visibility = 'hidden';
  const width = toolbar.offsetWidth || 520;
  const height = toolbar.offsetHeight || 40;
  let left = selX + selW - width;
  if (left < 6) left = 6;
  let top = selY + selH + 8;
  if (top + height > H - 6) top = selY - height - 8;
  if (top < 6) top = 6;
  toolbar.style.display = previousDisplay;
  toolbar.style.visibility = previousVisibility;
  return { left, top, width, height };
}

function availableSpace(candidate) {
  return candidate.width * candidate.height;
}

function positionOcrPanel() {
  const edge = 12;
  const gap = 12;
  const desiredWidth = Math.min(520, Math.max(280, W - edge * 2));
  const desiredHeight = Math.min(420, Math.max(180, H - edge * 2));
  const selection = {
    left: selX,
    top: selY,
    width: selW,
    height: selH,
  };
  const toolbarRect = getToolbarRect();
  const createCandidate = (side) => {
    const horizontal = side === 'top' || side === 'bottom';
    const availableWidth = horizontal
      ? W - edge * 2
      : side === 'left' ? selX - gap - edge : W - selX - selW - gap - edge;
    const availableHeight = horizontal
      ? side === 'top' ? selY - gap - edge : H - selY - selH - gap - edge
      : H - edge * 2;
    const width = Math.min(desiredWidth, availableWidth);
    const height = Math.min(desiredHeight, availableHeight);
    if (width < 220 || height < 140) return null;

    if (side === 'top' || side === 'bottom') {
      return {
        side,
        left: Math.max(edge, Math.min(selX + (selW - width) / 2, W - width - edge)),
        top: side === 'top' ? selY - height - gap : selY + selH + gap,
        width,
        height,
      };
    }
    return {
      side,
      left: side === 'left' ? selX - width - gap : selX + selW + gap,
      top: Math.max(edge, Math.min(selY + (selH - height) / 2, H - height - edge)),
      width,
      height,
    };
  };
  const candidates = ['top', 'bottom', 'left', 'right']
    .map(createCandidate)
    .filter(Boolean);

  const validCandidates = candidates
    .filter((candidate) => (
      candidate.left >= edge
      && candidate.top >= edge
      && candidate.left + candidate.width <= W - edge
      && candidate.top + candidate.height <= H - edge
      && !rectanglesOverlap(candidate, selection)
      && !rectanglesOverlap(candidate, toolbarRect)
    ))
    .sort((first, second) => availableSpace(second) - availableSpace(first));

  const selected = validCandidates[0];
  if (!selected) {
    ocrPanel.style.display = 'none';
    return false;
  }

  ocrPanel.style.width = `${selected.width}px`;
  ocrPanel.style.height = `${selected.height}px`;
  ocrPanel.style.left = `${selected.left}px`;
  ocrPanel.style.top = `${selected.top}px`;
  return true;
}

function showOcrResult(text) {
  recognizedText = text;
  ocrText.value = text || tCapture('noTextFound');
  btnOcrCopy.disabled = !text;
  btnOcrCopy.textContent = tCapture('copyText');
  ocrPanel.style.display = 'flex';
  positionOcrPanel();
}

function resetOcrResult() {
  recognizedText = '';
  ocrText.value = '';
  btnOcrCopy.disabled = true;
  ocrPanel.style.display = 'none';
  btnOcrCopy.textContent = tCapture('copyText');
  // 同步收起翻译区
  translatedText = '';
  translateText.value = '';
  btnTranslateCopy.disabled = true;
  btnTranslateCopy.textContent = tCapture('copyTranslation');
  translateSection.hidden = true;
}

function showTranslateText(text) {
  translatedText = typeof text === 'string' ? text : '';
  if (!translatedText) {
    translateSection.hidden = true;
    return;
  }
  translateText.value = translatedText;
  btnTranslateCopy.disabled = false;
  btnTranslateCopy.textContent = tCapture('copyTranslation');
  translateSection.hidden = false;
}

function isCaptureBusy() {
  return isTranslating || isRecognizing;
}

function updateTranslateButtonLabel() {
  const labelKey = !translationCache
    ? 'translate'
    : displayedImageVersion === 'translated'
      ? 'showOriginal'
      : 'showTranslation';
  btnTranslateLabel.textContent = tCapture(labelKey);
}

function resetTranslationCache() {
  resetOcrResult();
  translationCache = null;
  displayedImageVersion = 'original';
  updateTranslateButtonLabel();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(tCapture('translateFailed')));
    image.src = src;
  });
}

async function renderSelectionImage(dataUrl) {
  const image = await loadImage(dataUrl);
  const dpr = canvasDpr;
  drawCtx.clearRect(selX, selY, selW, selH);
  // 译文图可能与选区物理尺寸相同（本地服务）或逻辑尺寸（旧服务端）。
  // 以选区物理尺寸为基准，让图片在高分屏下 1:1 绘制而不被额外拉伸。
  const expectedPhysW = Math.round(selW * dpr);
  const expectedPhysH = Math.round(selH * dpr);
  if (Math.abs(image.naturalWidth - expectedPhysW) <= 2 && Math.abs(image.naturalHeight - expectedPhysH) <= 2) {
    drawCtx.drawImage(image, selX, selY, selW, selH);
  } else {
    // 非高清图：直接按物理像素铺满选区（牺牲一点锐利度，但保证覆盖完整）
    drawCtx.drawImage(image, selX * dpr, selY * dpr, expectedPhysW, expectedPhysH);
  }
  activeTool = 'select';
  Array.from(document.querySelectorAll('button.tool')).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tool === 'select');
  });
  drawMask();
}

async function toggleCachedTranslation() {
  if (!translationCache) return false;
  const nextVersion = displayedImageVersion === 'translated' ? 'original' : 'translated';
  const nextImage = nextVersion === 'translated'
    ? translationCache.translatedImage
    : translationCache.originalImage;
  await renderSelectionImage(nextImage);
  displayedImageVersion = nextVersion;
  updateTranslateButtonLabel();
  return true;
}

function setTool(tool) {
  activeTool = tool;
  Array.from(document.querySelectorAll('button.tool')).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tool === tool);
  });
  drawMask();
}

function getMergedCanvas() {
  const merged = document.createElement('canvas');
  const dpr = canvasDpr;
  merged.width = Math.round(W * dpr);
  merged.height = Math.round(H * dpr);
  const mctx = merged.getContext('2d');
  mctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  mctx.imageSmoothingEnabled = false;
  mctx.drawImage(bgCanvas, 0, 0);
  mctx.drawImage(drawCanvas, 0, 0);
  return merged;
}

/**
 * 对框选区域应用马赛克
 * @param x1 - 起点 x 坐标
 * @param y1 - 起点 y 坐标
 * @param x2 - 终点 x 坐标
 * @param y2 - 终点 y 坐标
 */
function applyMosaic(x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  if (w < 2 || h < 2) return;

  const rx = Math.max(selX, x);
  const ry = Math.max(selY, y);
  const rr = Math.min(selX + selW, x + w);
  const rb = Math.min(selY + selH, y + h);
  if (rr - rx < 2 || rb - ry < 2) return;

  const rw = rr - rx;
  const rh = rb - ry;
  const block = Math.max(4, drawingSize * 2);

  const merged = getMergedCanvas();
  const srcCtx = merged.getContext('2d');
  const dpr = canvasDpr;
  const imageData = srcCtx.getImageData(Math.round(rx * dpr), Math.round(ry * dpr), Math.round(rw * dpr), Math.round(rh * dpr));
  const data = imageData.data;

  for (let yy = 0; yy < rh; yy += block) {
    for (let xx = 0; xx < rw; xx += block) {
      const sx = Math.min(xx + Math.floor(block / 2), rw - 1);
      const sy = Math.min(yy + Math.floor(block / 2), rh - 1);
      const i = (sy * rw + sx) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const a = data[i + 3];
      for (let by = yy; by < Math.min(yy + block, rh); by++) {
        for (let bx = xx; bx < Math.min(xx + block, rw); bx++) {
          const j = (by * rw + bx) * 4;
          data[j] = r;
          data[j + 1] = g;
          data[j + 2] = b;
          data[j + 3] = a;
        }
      }
    }
  }

  drawCtx.putImageData(imageData, Math.round(rx * dpr), Math.round(ry * dpr));
}

function drawLine(ctx, x1, y1, x2, y2) {
  ctx.strokeStyle = drawingColor;
  ctx.lineWidth = drawingSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function drawRect(ctx, x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  ctx.strokeStyle = drawingColor;
  ctx.lineWidth = drawingSize;
  ctx.strokeRect(x, y, w, h);
}

/** 箭头：直线 + 末端双斜线箭头 */
function drawArrow(ctx, x1, y1, x2, y2) {
  drawLine(ctx, x1, y1, x2, y2);
  const angle = Math.atan2(y2 - y1, x2 - x1);
  const head = Math.max(10, drawingSize * 3);
  const a1 = angle + Math.PI * 0.75;
  const a2 = angle - Math.PI * 0.75;
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + head * Math.cos(a1), y2 + head * Math.sin(a1));
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 + head * Math.cos(a2), y2 + head * Math.sin(a2));
  ctx.stroke();
}

/** 椭圆描边 */
function drawEllipse(ctx, x1, y1, x2, y2) {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2;
  const rx = Math.abs(x2 - x1) / 2;
  const ry = Math.abs(y2 - y1) / 2;
  ctx.strokeStyle = drawingColor;
  ctx.lineWidth = drawingSize;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
}

/** 高斯模糊：对选区区域应用模糊（替代/补充马赛克） */
function applyBlur(x1, y1, x2, y2) {
  const x = Math.min(x1, x2);
  const y = Math.min(y1, y2);
  const w = Math.abs(x2 - x1);
  const h = Math.abs(y2 - y1);
  if (w < 2 || h < 2) return;
  const rx = Math.max(selX, x);
  const ry = Math.max(selY, y);
  const rr = Math.min(selX + selW, x + w);
  const rb = Math.min(selY + selH, y + h);
  if (rr - rx < 2 || rb - ry < 2) return;
  const rw = rr - rx;
  const rh = rb - ry;
  const merged = getMergedCanvas();
  const dpr = canvasDpr;
  const tmp = document.createElement('canvas');
  tmp.width = Math.round(rw * dpr);
  tmp.height = Math.round(rh * dpr);
  const tctx = tmp.getContext('2d');
  tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  tctx.filter = `blur(${Math.max(2, drawingSize)}px)`;
  tctx.drawImage(merged, rx, ry, rw, rh, 0, 0, rw, rh);
  tctx.filter = 'none';
  drawCtx.drawImage(tmp, rx, ry);
}

/** 取色：返回点击位置的颜色 hex（#RRGGBB） */
function pickColorAt(mx, my) {
  const merged = getMergedCanvas();
  const ctx = merged.getContext('2d');
  const dpr = canvasDpr;
  const px = Math.max(0, Math.min(Math.round(mx * dpr), merged.width - 1));
  const py = Math.max(0, Math.min(Math.round(my * dpr), merged.height - 1));
  const d = ctx.getImageData(px, py, 1, 1).data;
  const r = d[0].toString(16).padStart(2, '0');
  const g = d[1].toString(16).padStart(2, '0');
  const b = d[2].toString(16).padStart(2, '0');
  return `#${r}${g}${b}`.toUpperCase();
}

function finishSelection(mx, my) {
  resetTranslationCache();
  hoverWindowRect = null;
  selX = Math.min(startX, mx);
  selY = Math.min(startY, my);
  selW = Math.abs(mx - startX);
  selH = Math.abs(my - startY);
  if (selW < 3 || selH < 3) {
    state = STATE.IDLE;
    selX = selY = selW = selH = 0;
    drawCtx.clearRect(0, 0, W, H);
    historyStack.length = 0;
    hideToolbar();
    drawMask();
    updateSizeInfo(mx, my);
    return;
  }
  state = STATE.SELECTED;
  showToolbar();
  drawMask();
  updateSizeInfo(mx, my);
}

/**
 * 裁剪选区并合并涂鸦图层
 * @returns PNG dataURL，若选区无效则返回 null
 */
function cropSelectionWithAnnotations() {
  if (!bgImage || selW < 2 || selH < 2) return null;
  const dpr = canvasDpr;

  const usesCompositedBackground = Boolean(
    captureVirtualScreen && capturePhysicalScreen && captureDisplays.length > 0,
  );
  const sourceCanvas = usesCompositedBackground ? bgCanvas : bgImage;
  // 输出采用物理分辨率：保存/复制的截图与屏幕原始清晰度一致
  const scaleX = usesCompositedBackground ? dpr : bgImage.naturalWidth / (W * dpr);
  const scaleY = usesCompositedBackground ? dpr : bgImage.naturalHeight / (H * dpr);

  const sx = Math.round(selX * scaleX);
  const sy = Math.round(selY * scaleY);
  const sw = Math.round(selW * scaleX);
  const sh = Math.round(selH * scaleY);

  const outCanvas = document.createElement('canvas');
  outCanvas.width = sw;
  outCanvas.height = sh;
  const outCtx = outCanvas.getContext('2d');
  outCtx.imageSmoothingEnabled = false;

  outCtx.drawImage(sourceCanvas, sx, sy, sw, sh, 0, 0, sw, sh);

  const scaledDraw = document.createElement('canvas');
  scaledDraw.width = sw;
  scaledDraw.height = sh;
  const sctx = scaledDraw.getContext('2d');
  sctx.drawImage(drawCanvas, Math.round(selX * dpr), Math.round(selY * dpr), sw, sh, 0, 0, sw, sh);
  outCtx.drawImage(scaledDraw, 0, 0);

  return outCanvas.toDataURL('image/png');
}

/**
 * 释放截图页中的大对象资源
 * @description 截图窗口销毁前主动释放 URL、位图与历史栈，降低内存峰值残留
 */
function releaseCaptureResources() {
  if (currentCaptureObjectUrl) {
    URL.revokeObjectURL(currentCaptureObjectUrl);
    currentCaptureObjectUrl = '';
  }

  historyStack.length = 0;
  bgImage = null;
  captureDisplays = [];
  captureVirtualScreen = null;
  capturePhysicalScreen = null;

  [bgCanvas, drawCanvas, tempCanvas].forEach((cv) => {
    cv.width = 0;
    cv.height = 0;
  });
  if (captureHole) captureHole.style.display = 'none';
  if (captureHandles) captureHandles.style.display = 'none';
}

ipcRenderer.on('capture-image', (_e, data) => {
  resetTranslationCache();
  scaleFactor = data.scaleFactor || 1;
  captureDisplays = Array.isArray(data.displays) ? data.displays : [];
  captureVirtualScreen = data.virtualScreen || null;
  capturePhysicalScreen = data.physicalScreen || null;
  setCaptureSource(data.captureSource);
  setVisibleWindowRects(data.visibleWindows, captureVirtualScreen);
  const isExternal = data.externalCapture === true;

  if (currentCaptureObjectUrl) {
    URL.revokeObjectURL(currentCaptureObjectUrl);
    currentCaptureObjectUrl = '';
  }

  let imageSrc = data.imageDataURL || '';
  if (data.imageBytes && data.imageBytes.length > 0) {
    const blob = new Blob([data.imageBytes], { type: 'image/png' });
    currentCaptureObjectUrl = URL.createObjectURL(blob);
    imageSrc = currentCaptureObjectUrl;
  }

  if (!imageSrc) {
    return;
  }

  const img = new Image();
  img.onload = () => {
    bgImage = img;
    initCanvases();

    if (isExternal) {
      // 外调 Snipaste 返回的已是裁剪图：直接作为全图选区进入后处理态，复用 OCR/翻译/保存
      selX = 0;
      selY = 0;
      selW = W;
      selH = H;
      state = STATE.SELECTED;
      showToolbar();
      drawMask();
      updateSizeInfo(0, 0);
    }

    if (currentCaptureObjectUrl) {
      URL.revokeObjectURL(currentCaptureObjectUrl);
      currentCaptureObjectUrl = '';
    }
  };

  img.onerror = () => {
    if (currentCaptureObjectUrl) {
      URL.revokeObjectURL(currentCaptureObjectUrl);
      currentCaptureObjectUrl = '';
    }
  };

  img.src = imageSrc;
});

tempCanvas.addEventListener('mousedown', (e) => {
  if (isCaptureBusy()) return;
  // 右键：取消当前选区回到 IDLE，再次右键或按 Esc 退出截图
  if (e.button === 2) {
    e.preventDefault();
    if (state === STATE.DRAWING) {
      // 框选过程中：取消本次框选
      state = STATE.IDLE;
      hoverWindowRect = pendingWindowClickRect || null;
      drawMask();
      if (hoverWindowRect) showToolbar();
    } else if (state === STATE.SELECTED) {
      // 已选区：清掉选区 + 翻译 / OCR 缓存，回到 IDLE
      resetTranslationCache();
      selX = 0; selY = 0; selW = 0; selH = 0;
      resizeHandle = null;
      state = STATE.IDLE;
      hideToolbar();
      drawMask();
    } else if (state === STATE.RESIZING) {
      // 拖拽 handle 中：放弃本次 resize
      resizeHandle = null;
      state = STATE.SELECTED;
      drawMask();
    } else if (state === STATE.IDLE) {
      // 无选区：右键直接退出截图
      ipcRenderer.send('capture-cancel');
    }
    return;
  }
  if (e.button !== 0) return;
  const mx = e.clientX;
  const my = e.clientY;

  if (state === STATE.IDLE) {
    resetTranslationCache();
    pendingWindowClickRect = hoverWindowRect;
    state = STATE.DRAWING;
    startX = mx;
    startY = my;
    hoverWindowRect = null;
    hideToolbar();
    drawMask();
    return;
  }

  if (state === STATE.SELECTED && activeTool === 'select') {
    const handle = hitTestHandle(mx, my);
    if (handle) {
      resetTranslationCache();
      state = STATE.RESIZING;
      resizeHandle = handle;
      const anchors = {
        tl: [selX + selW, selY + selH], t: [selX, selY + selH],
        tr: [selX, selY + selH], r: [selX, selY],
        br: [selX, selY], b: [selX, selY],
        bl: [selX + selW, selY], l: [selX + selW, selY],
      };
      resizeAnchorX = anchors[handle][0];
      resizeAnchorY = anchors[handle][1];
      hideToolbar();
      return;
    }
    if (isInsideSelection(mx, my)) {
      resetTranslationCache();
      state = STATE.MOVING;
      moveOffX = mx - selX;
      moveOffY = my - selY;
      hideToolbar();
      return;
    }
    resetTranslationCache();
    state = STATE.DRAWING;
    startX = mx;
    startY = my;
    hideToolbar();
    drawMask();
    return;
  }

  if (state === STATE.SELECTED && activeTool !== 'select' && isInsideSelection(mx, my)) {
    resetTranslationCache();
    if (activeTool === 'text') {
      const text = window.prompt(tCapture('captureInputText') || '输入文字');
      if (text) {
        drawCtx.save();
        drawCtx.fillStyle = drawingColor;
        drawCtx.font = `${Math.max(14, drawingSize * 4)}px sans-serif`;
        drawCtx.textBaseline = 'top';
        drawCtx.fillText(text, mx, my);
        drawCtx.restore();
        commitHistory();
      }
      // 保留工具栏可见，便于连续添加文字（与取色器等单击工具一致）
      return;
    }
    if (activeTool === 'picker') {
      const color = pickColorAt(mx, my);
      if (color) {
        clipboard.writeText(color);
        sizeInfo.textContent = color;
        sizeInfo.style.display = 'block';
        sizeInfo.style.left = `${mx}px`;
        sizeInfo.style.top = `${Math.max(my - 24, 0)}px`;
        window.setTimeout(() => { sizeInfo.style.display = 'none'; }, 1200);
      }
      return;
    }
    state = STATE.ANNOTATING;
    annotStartX = mx;
    annotStartY = my;
    penLastX = mx;
    penLastY = my;
    hideToolbar();
    if (activeTool === 'pen') {
      clipToSelection(drawCtx);
      drawLine(drawCtx, penLastX, penLastY, mx, my);
      restoreClip(drawCtx);
    }
  }
});

/**
 * mousemove 的 RAF 节流调度器
 * @description mousemove 事件可达 125~500Hz，直接处理会反复全屏重绘/放大镜采样导致卡顿。
 * 统一缓存最新坐标，在下一帧（~60Hz）合并处理一次；同一帧内多次移动只消费一次。
 */
let pendingMouseX = 0;
let pendingMouseY = 0;
let hasScheduledMouseFrame = false;

function scheduleMouseMove(mx, my) {
  pendingMouseX = mx;
  pendingMouseY = my;
  if (hasScheduledMouseFrame) return;
  hasScheduledMouseFrame = true;
  requestAnimationFrame(() => {
    hasScheduledMouseFrame = false;
    if (isCaptureBusy()) return;
    handleMouseMove(pendingMouseX, pendingMouseY);
  });
}

function handleMouseMove(mx, my) {
  if (state === STATE.IDLE) {
    const nextHoverWindow = findWindowRectAt(mx, my);
    if (nextHoverWindow !== hoverWindowRect) {
      hoverWindowRect = nextHoverWindow;
      drawMask();
    }
    document.body.style.cursor = 'crosshair';
    updateSizeInfo(mx, my);
    showMagnifier(mx, my);
    return;
  }

  if (state === STATE.DRAWING) {
    selX = Math.min(startX, mx);
    selY = Math.min(startY, my);
    selW = Math.abs(mx - startX);
    selH = Math.abs(my - startY);
    drawMask();
    updateSizeInfo(mx, my);
    showMagnifier(mx, my);
    return;
  }

  if (state === STATE.MOVING) {
    selX = Math.max(0, Math.min(mx - moveOffX, W - selW));
    selY = Math.max(0, Math.min(my - moveOffY, H - selH));
    drawMask();
    updateSizeInfo(mx, my);
    showMagnifier(mx, my);
    return;
  }

  if (state === STATE.RESIZING) {
    let newX = selX;
    let newY = selY;
    let newW = selW;
    let newH = selH;
    const h = resizeHandle;

    if (h === 'tl' || h === 'l' || h === 'bl') { newX = Math.min(mx, resizeAnchorX); newW = Math.abs(resizeAnchorX - mx); }
    else if (h === 'tr' || h === 'r' || h === 'br') { newX = Math.min(mx, resizeAnchorX); newW = Math.abs(mx - resizeAnchorX); }

    if (h === 'tl' || h === 't' || h === 'tr') { newY = Math.min(my, resizeAnchorY); newH = Math.abs(resizeAnchorY - my); }
    else if (h === 'bl' || h === 'b' || h === 'br') { newY = Math.min(my, resizeAnchorY); newH = Math.abs(my - resizeAnchorY); }

    selX = newX;
    selY = newY;
    selW = newW;
    selH = newH;
    drawMask();
    updateSizeInfo(mx, my);
    showMagnifier(mx, my);
    return;
  }

  if (state === STATE.ANNOTATING) {
    clearTemp();
    if (activeTool === 'pen') {
      clipToSelection(drawCtx);
      drawLine(drawCtx, penLastX, penLastY, mx, my);
      restoreClip(drawCtx);
      penLastX = mx;
      penLastY = my;
    } else {
      clipToSelection(tempCtx);
      if (activeTool === 'line') {
        drawLine(tempCtx, annotStartX, annotStartY, mx, my);
      } else if (activeTool === 'rect') {
        drawRect(tempCtx, annotStartX, annotStartY, mx, my);
      } else if (activeTool === 'arrow') {
        drawArrow(tempCtx, annotStartX, annotStartY, mx, my);
      } else if (activeTool === 'ellipse') {
        drawEllipse(tempCtx, annotStartX, annotStartY, mx, my);
      } else if (activeTool === 'mosaic' || activeTool === 'blur') {
        tempCtx.strokeStyle = '#ffffff';
        tempCtx.setLineDash([6, 3]);
        tempCtx.lineWidth = 1;
        tempCtx.strokeRect(Math.min(annotStartX, mx), Math.min(annotStartY, my), Math.abs(mx - annotStartX), Math.abs(my - annotStartY));
        tempCtx.setLineDash([]);
      }
      restoreClip(tempCtx);
    }
    updateSizeInfo(mx, my);
    return;
  }

  if (state === STATE.SELECTED && activeTool === 'select') {
    const handle = hitTestHandle(mx, my);
    if (handle) {
      const map = { tl: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize', br: 'nwse-resize', t: 'ns-resize', b: 'ns-resize', l: 'ew-resize', r: 'ew-resize' };
      document.body.style.cursor = map[handle] || 'crosshair';
    } else if (isInsideSelection(mx, my)) {
      document.body.style.cursor = 'move';
    } else {
      document.body.style.cursor = 'crosshair';
    }
    updateSizeInfo(mx, my);
    return;
  }

  updateSizeInfo(mx, my);
}

tempCanvas.addEventListener('mousemove', (e) => {
  scheduleMouseMove(e.clientX, e.clientY);
});

tempCanvas.addEventListener('mouseup', (e) => {
  if (isCaptureBusy()) return;
  if (e.button === 2) return; // 右键已在 mousedown 处理
  const mx = e.clientX;
  const my = e.clientY;

  if (state === STATE.DRAWING) {
    hideMagnifier();
    const moved = Math.abs(mx - startX) >= 3 || Math.abs(my - startY) >= 3;
    if (!moved && pendingWindowClickRect) {
      selectWindowRect(pendingWindowClickRect);
      pendingWindowClickRect = null;
      return;
    }
    pendingWindowClickRect = null;
    finishSelection(mx, my);
    return;
  }

  if (state === STATE.MOVING || state === STATE.RESIZING) {
    state = STATE.SELECTED;
    showToolbar();
    drawMask();
    updateSizeInfo(mx, my);
    return;
  }

  if (state === STATE.ANNOTATING) {
    clearTemp();
    clipToSelection(drawCtx);
    if (activeTool === 'line') {
      drawLine(drawCtx, annotStartX, annotStartY, mx, my);
    } else if (activeTool === 'rect') {
      drawRect(drawCtx, annotStartX, annotStartY, mx, my);
    } else if (activeTool === 'arrow') {
      drawArrow(drawCtx, annotStartX, annotStartY, mx, my);
    } else if (activeTool === 'ellipse') {
      drawEllipse(drawCtx, annotStartX, annotStartY, mx, my);
    } else if (activeTool === 'blur') {
      applyBlur(annotStartX, annotStartY, mx, my);
    } else if (activeTool === 'mosaic') {
      applyMosaic(annotStartX, annotStartY, mx, my);
    }
    restoreClip(drawCtx);
    commitHistory();
    state = STATE.SELECTED;
    showToolbar();
    drawMask();
    updateSizeInfo(mx, my);
  }
});

Array.from(document.querySelectorAll('button.tool')).forEach((btn) => {
  btn.addEventListener('click', () => {
    if (isCaptureBusy() || state !== STATE.SELECTED) return;
    setTool(btn.dataset.tool || 'select');
  });
});

colorPicker.addEventListener('input', () => { drawingColor = colorPicker.value; });
sizePicker.addEventListener('change', () => { drawingSize = Number(sizePicker.value || 4); });

btnUndo.addEventListener('click', () => {
  if (state !== STATE.SELECTED) return;
  resetTranslationCache();
  undoLast();
});

const btnRedo = document.getElementById('btnRedo');
if (btnRedo) {
  btnRedo.addEventListener('click', () => {
    if (state !== STATE.SELECTED) return;
    resetTranslationCache();
    redoLast();
    drawMask();
  });
}

// Snipaste 式双击：选区就绪后，双击选区内部 = 完成（复制到剪贴板并关闭）
tempCanvas.addEventListener('dblclick', (e) => {
  if (isCaptureBusy() || state !== STATE.SELECTED) return;
  const mx = e.clientX;
  const my = e.clientY;
  if (!isInsideSelection(mx, my)) return;
  const dataURL = cropSelectionWithAnnotations();
  if (dataURL) ipcRenderer.send('capture-complete', { dataURL });
});

document.getElementById('btnCopy').addEventListener('click', () => {
  const dataURL = cropSelectionWithAnnotations();
  if (dataURL) ipcRenderer.send('capture-complete', { dataURL });
});

btnOcr.addEventListener('click', async () => {
  if (isCaptureBusy() || state !== STATE.SELECTED) return;

  const image = cropSelectionWithAnnotations();
  if (!image) return;

  resetOcrResult();
  isRecognizing = true;
  hideToolbar();
  sizeInfo.style.display = 'none';
  showTranslateOverlay(tCapture('recognizing'));

  try {
    let result;
    if (ocrEngine === 'server') {
      const token = await ipcRenderer.invoke('store:read', 'user-account-token');
      if (typeof token !== 'string' || !token.trim()) {
        throw new Error(tCapture('ocrLoginRequired'));
      }
      result = await ipcRenderer.invoke('capture-ocr', { dataURL: image, token });
    } else {
      // 本机 OCR：local=Tesseract.js / paddleocr=本机 PaddleOCR（均由主进程按配置分流）
      result = await ipcRenderer.invoke('capture-ocr-local', { dataURL: image });
    }
    if (!result?.success) {
      const errorCode = result?.code;
      const fallbackMessage = errorCode && tCapture(errorCode) !== errorCode
        ? tCapture(errorCode)
        : tCapture('ocrFailed');
      throw new Error(result?.message || fallbackMessage);
    }
    hideTranslateOverlay();
    showOcrResult(typeof result.text === 'string' ? result.text : '');
  } catch (error) {
    showTranslateOverlay(error instanceof Error ? error.message : tCapture('ocrFailed'), true);
    await new Promise((resolve) => window.setTimeout(resolve, 2200));
    hideTranslateOverlay();
  } finally {
    isRecognizing = false;
    if (ocrPanel.style.display !== 'flex') {
      showToolbar();
      updateSizeInfo(selX, selY);
    }
  }
});

btnOcrCopy.addEventListener('click', () => {
  if (!recognizedText) return;
  clipboard.writeText(recognizedText);
  btnOcrCopy.textContent = tCapture('copied');
  window.setTimeout(() => {
    btnOcrCopy.textContent = tCapture('copyText');
  }, 1200);
});

btnOcrClose.addEventListener('click', () => {
  resetOcrResult();
  showToolbar();
  updateSizeInfo(selX, selY);
});

btnTranslate.addEventListener('click', async () => {
  if (isCaptureBusy() || state !== STATE.SELECTED) return;

  if (translationCache) {
    isTranslating = true;
    try {
      await toggleCachedTranslation();
    } finally {
      isTranslating = false;
    }
    return;
  }

  const originalImage = cropSelectionWithAnnotations();
  if (!originalImage) return;

  isTranslating = true;
  hideToolbar();
  sizeInfo.style.display = 'none';
  showTranslateOverlay(tCapture('translating'));

  try {
    const [storedSourceLang, storedTargetLang] = await Promise.all([
      ipcRenderer.invoke('store:read', 'screenshot-translate-source-lang'),
      ipcRenderer.invoke('store:read', 'screenshot-translate-target-lang'),
    ]);
    const sourceLanguage = typeof storedSourceLang === 'string' && storedSourceLang ? storedSourceLang : 'auto';
    const targetLanguage = typeof storedTargetLang === 'string' && storedTargetLang ? storedTargetLang : 'en';

    let result;
    if (translateEngine !== 'server') {
      // 本机 Hy-MT2 / 云端百度翻译：都走本地服务 IPC（主进程按引擎配置决定 provider）
      result = await ipcRenderer.invoke('capture-translate-local', {
        dataURL: originalImage,
        targetLanguage,
      });
    } else {
      const token = await ipcRenderer.invoke('store:read', 'user-account-token');
      if (typeof token !== 'string' || !token.trim()) {
        throw new Error(tCapture('loginRequired'));
      }
      result = await ipcRenderer.invoke('capture-translate', {
        dataURL: originalImage,
        token,
        sourceLanguage,
        targetLanguage,
      });
    }
    if (!result?.success) {
      const errorCode = result?.code;
      const fallbackMsg = errorCode && tCapture(errorCode) !== errorCode
        ? tCapture(errorCode)
        : tCapture('translateFailed');
      throw new Error(result?.message || fallbackMsg);
    }
    const translatedImage = typeof result.translatedImage === 'string' ? result.translatedImage : '';
    const translatedText = typeof result.translatedText === 'string' ? result.translatedText : '';
    // 两条路径都没数据 → 视为失败
    if (!translatedImage && !translatedText) {
      throw new Error(result?.message || tCapture('translateFailed'));
    }
    // 先把「原文」状态快照入历史栈（旧代码误调未定义的 pushHistory()，会导致
    // 翻译成功也抛 ReferenceError 走 catch → 永远提示失败），随后绘制译文。
    commitHistory();
    if (translatedImage) {
      // 服务端 / 本地图片覆盖路径：把"原文 + 译文叠图"贴到选区画布
      await renderSelectionImage(translatedImage);
      translationCache = { originalImage, translatedImage };
    } else {
      // 本地纯文本降级（字体缺失 / 翻译为空）：不覆盖选区，让用户在 OCR 浮窗里看译文
      translationCache = { originalImage, translatedImage: '' };
    }
    displayedImageVersion = 'translated';
    updateTranslateButtonLabel();
    // 始终把译文文本写进 OCR 浮窗的扩展区（即使走了图片覆盖路径也展示，方便复制）
    showTranslateText(translatedText);
    if (!translatedImage && translatedText) {
      // 纯文本路径：主动把 OCR 浮窗拉到前台
      ocrPanel.style.display = 'flex';
      positionOcrPanel();
    }
    hideTranslateOverlay();
  } catch (error) {
    showTranslateOverlay(error instanceof Error ? error.message : tCapture('translateFailed'), true);
    await new Promise((resolve) => window.setTimeout(resolve, 2200));
    hideTranslateOverlay();
  } finally {
    isTranslating = false;
    showToolbar();
    updateSizeInfo(selX, selY);
  }
});

document.getElementById('btnSave').addEventListener('click', () => {
  const dataURL = cropSelectionWithAnnotations();
  if (dataURL) ipcRenderer.send('capture-save', { dataURL });
});

document.getElementById('btnCancel').addEventListener('click', () => {
  ipcRenderer.send('capture-cancel');
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && ocrPanel.style.display === 'flex') {
    resetOcrResult();
    showToolbar();
    updateSizeInfo(selX, selY);
    return;
  }
  if (e.key === 'Escape') {
    ipcRenderer.send('capture-cancel');
    return;
  }
  if (e.key === 'Enter' && state === STATE.SELECTED && ocrPanel.style.display !== 'flex') {
    const dataURL = cropSelectionWithAnnotations();
    if (dataURL) ipcRenderer.send('capture-complete', { dataURL });
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    if (state === STATE.SELECTED) {
      resetTranslationCache();
      undoLast();
    }
  }
});

window.addEventListener('resize', () => {
  initCanvases();
  if (state !== STATE.IDLE) {
    if (isCaptureBusy()) {
      hideToolbar();
      positionTranslateOverlay();
      sizeInfo.style.display = 'none';
    } else if (ocrPanel.style.display === 'flex') {
      hideToolbar();
      positionOcrPanel();
      sizeInfo.style.display = 'none';
    } else {
      showToolbar();
      updateSizeInfo(selX, selY);
    }
  } else {
    sizeInfo.style.display = 'none';
    hideToolbar();
  }
});

window.addEventListener('beforeunload', () => {
  releaseCaptureResources();
});

// 屏蔽浏览器右键菜单（截图工具全程不弹系统菜单，右键用于退出选区）
window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
});
