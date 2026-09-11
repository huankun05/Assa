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
 * @file index.test.ts
 * @description authSession 已随平台账号系统移除为 no-op；测试锁定该行为。
 * @author 鸡哥
 */

import { describe, expect, it, vi } from 'vitest';

const { fetchUserProfileMock, writeLocalTokenMock, writeLocalProfileMock } = vi.hoisted(() => ({
  fetchUserProfileMock: vi.fn(),
  writeLocalTokenMock: vi.fn(),
  writeLocalProfileMock: vi.fn(),
}));

vi.mock('../../../api/user/userAccountApi', () => ({
  fetchUserProfile: fetchUserProfileMock,
}));

vi.mock('../../userAccount', () => ({
  writeLocalToken: writeLocalTokenMock,
  writeLocalProfile: writeLocalProfileMock,
}));

import { updateSessionToken, bootstrapAuthSession } from '../index';

describe('authSession (no-op placeholder)', () => {
  it('updateSessionToken is a no-op and does not write local token', () => {
    updateSessionToken('test-token');
    expect(writeLocalTokenMock).not.toHaveBeenCalled();
    updateSessionToken(null);
    expect(writeLocalTokenMock).not.toHaveBeenCalled();
  });

  it('bootstrapAuthSession is a no-op and does not restore profile', async () => {
    await bootstrapAuthSession();
    expect(fetchUserProfileMock).not.toHaveBeenCalled();
    expect(writeLocalTokenMock).not.toHaveBeenCalled();
    expect(writeLocalProfileMock).not.toHaveBeenCalled();
  });
});
