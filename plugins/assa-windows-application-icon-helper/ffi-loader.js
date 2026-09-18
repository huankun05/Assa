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
 * @file ffi-loader.js
 * @description 通过 koffi 加载 Native AOT DLL，定义所有 C 函数签名
 * @description 惰性加载：首次调用时才 require('koffi') + load DLL，避免启动关键路径冷启动
 */

const path = require('node:path');
const fs = require('node:fs');

const TFM = 'net10.0-windows10.0.19041.0';

/** DLL 搜索路径（优先 native 自包含版本） */
const dllCandidates = [
  path.join(__dirname, 'src', 'bin', 'Release', TFM, 'win-x64', 'native', 'eIslandAppIconHelper.dll'),
  path.join(__dirname, 'src', 'bin', 'Release', TFM, 'win-x64', 'eIslandAppIconHelper.dll'),
];

function toUnpackedDllPath(candidate) {
  return candidate.replace(`${path.sep}app.asar${path.sep}`, `${path.sep}app.asar.unpacked${path.sep}`);
}

let icon = null;
let dllPath = null;

function ensureLoaded() {
  if (icon) return icon;

  let found;
  for (const candidate of dllCandidates) {
    const loadableCandidate = toUnpackedDllPath(candidate);
    try {
      fs.accessSync(loadableCandidate);
      found = loadableCandidate;
      break;
    } catch { /* try next */ }
  }

  if (!found) {
    throw new Error(
      'Unable to find eIslandAppIconHelper.dll. Run "npm run build" first.'
    );
  }

  const koffi = require('koffi');
  const lib = koffi.load(found);
  dllPath = found;

  /**
   * koffi 的 'str' 返回类型会自动：
   * 1. 读取 CoTaskMem 分配的 UTF-8 字符串
   * 2. 复制为 JS 字符串
   * 3. 调用 CoTaskMemFree 释放原始指针
   */
  icon = {
    icon_free_string:        lib.func('void icon_free_string(void*)'),
    icon_get_by_process_name: lib.func('str icon_get_by_process_name(str)'),
    icon_get_by_pid:         lib.func('str icon_get_by_pid(uint)'),
    icon_get_by_path:        lib.func('str icon_get_by_path(str)'),
    icon_get_by_shortcut:    lib.func('str icon_get_by_shortcut(str)'),
  };
  return icon;
}

/**
 * 调用 DLL 函数获取图标，解码 base64 为 IconResult
 * @param {string} fnName - icon 函数名
 * @param {any[]} args - 参数
 * @returns {{ data: Buffer, size: number, format: 'png' }|null}
 */
function callIcon(fnName, ...args) {
  const api = ensureLoaded();
  const b64 = api[fnName](...args);
  if (!b64) return null;
  const data = Buffer.from(b64, 'base64');
  return { data, size: data.length, format: 'png' };
}

/** Proxy：访问 icon.xxx 时触发惰性加载（兼容旧 require 模式） */
const iconProxy = new Proxy({}, {
  get(_t, prop) {
    return ensureLoaded()[prop];
  },
});

module.exports = {
  get icon() { return iconProxy; },
  callIcon,
  get dllPath() { return dllPath; },
};
