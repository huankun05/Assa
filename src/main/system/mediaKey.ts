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
 * @file mediaKey.ts
 * @description 媒体按键模拟模块
 * @description 通过 PowerShell 向系统发送媒体虚拟按键
 * @author 鸡哥
 */

import { exec } from 'child_process';

/**
 * 通过 PowerShell P/Invoke 向系统发送媒体虚拟按键
 * 使用 -EncodedCommand 传递 Base64(UTF-16LE) 编码脚本，避免内联引号转义问题
 * @param vkCode - Windows 虚拟键代码（VK_MEDIA_*）
 */
export function sendMediaVirtualKey(vkCode: number): void {
  const script = [
    'Add-Type -TypeDefinition @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class MediaKey {',
    '    [DllImport("user32.dll")]',
    '    public static extern void keybd_event(byte vk, byte scan, uint flags, IntPtr extra);',
    '}',
    '"@',
    `[MediaKey]::keybd_event(${vkCode}, 0, 0, [IntPtr]::Zero)`,
    `[MediaKey]::keybd_event(${vkCode}, 0, 2, [IntPtr]::Zero)`,
  ].join('\n');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  exec(`powershell.exe -NonInteractive -NoProfile -EncodedCommand ${encoded}`, (err) => {
    if (err) console.error('[Media] virtual key error:', err.message);
  });
}

/**
 * 通过 PowerShell P/Invoke 向系统发送组合键
 * @description 依次按下所有虚拟键再逆序释放，用于触发播放器注册的全局快捷键
 *              （例如网易云音乐默认的「喜欢单曲」Ctrl+Alt+L）
 * @param vkCodes - Windows 虚拟键代码数组，修饰键在前、主键在后
 */
export function sendHotkeyCombo(vkCodes: number[]): void {
  if (!vkCodes.length) return;
  const pressLines = vkCodes.map((vk) => `[MediaKey]::keybd_event(${vk}, 0, 0, [IntPtr]::Zero)`);
  const releaseLines = [...vkCodes]
    .reverse()
    .map((vk) => `[MediaKey]::keybd_event(${vk}, 0, 2, [IntPtr]::Zero)`);

  const script = [
    'Add-Type -TypeDefinition @"',
    'using System;',
    'using System.Runtime.InteropServices;',
    'public class MediaKey {',
    '    [DllImport("user32.dll")]',
    '    public static extern void keybd_event(byte vk, byte scan, uint flags, IntPtr extra);',
    '}',
    '"@',
    ...pressLines,
    ...releaseLines,
  ].join('\n');
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  exec(`powershell.exe -NonInteractive -NoProfile -EncodedCommand ${encoded}`, (err) => {
    if (err) console.error('[Media] hotkey combo error:', err.message);
  });
}
