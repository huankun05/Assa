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
 * @description 用户会话恢复工具：平台账号系统已移除，当前为 no-op 占位。
 * @author 鸡哥
 */

/**
 * 在登录/注册成功后写入本地 token。
 */
export function updateSessionToken(_token: string | null): void {
  // no-op
}

/**
 * 启动时尝试恢复登录态：平台账号系统已移除，当前为 no-op 占位。
 */
export async function bootstrapAuthSession(): Promise<void> {
  // no-op
}
