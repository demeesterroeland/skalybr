import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { NextRequest } from 'next/server';

import {
  getSessionSecret,
  clearCachedSessionSecret,
} from '@/lib/auth/session';
import {
  closeSkalybrDb,
  countUsers,
  createUser,
  getUserById,
  getAccessGrant,
  getUserByUsername,
  setAccessGrant,
} from '@/lib/db/skalybr-db';

import { POST as quickswitchPost } from '@/app/api/v1/dev/quickswitch/route';
import { GET as meGet } from '@/app/api/v1/auth/me/route';
import { PATCH as adminUserPatch } from '@/app/api/v1/admin/users/[id]/route';

describe('Dev Personas QuickSwitch API & Enhanced Auth Me (Phase 5)', () => {
  let tempDir: string;
  let originalDataDir: string | undefined;
  let originalSessionSecret: string | undefined;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skalybr-quickswitch-test-'));
    originalDataDir = process.env.DATA_DIR;
    originalSessionSecret = process.env.SESSION_SECRET;
    originalNodeEnv = process.env.NODE_ENV;

    process.env.DATA_DIR = tempDir;
    process.env.SESSION_SECRET = 'skalybr_unit_test_session_secret_32_chars_long!';
    (process.env as any).NODE_ENV = 'development';
    clearCachedSessionSecret();
    closeSkalybrDb();
  });

  afterEach(() => {
    closeSkalybrDb();
    clearCachedSessionSecret();

    if (originalDataDir !== undefined) {
      process.env.DATA_DIR = originalDataDir;
    } else {
      delete process.env.DATA_DIR;
    }

    if (originalSessionSecret !== undefined) {
      process.env.SESSION_SECRET = originalSessionSecret;
    } else {
      delete process.env.SESSION_SECRET;
    }

    (process.env as any).NODE_ENV = originalNodeEnv;

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('rejects with 403 when NODE_ENV is production', async () => {
    (process.env as any).NODE_ENV = 'production';

    const req = new NextRequest('http://localhost/api/v1/dev/quickswitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: 'admin' }),
    });

    const res = await quickswitchPost(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain('only available in development mode');
  });

  it('rejects invalid persona with 400', async () => {
    const req = new NextRequest('http://localhost/api/v1/dev/quickswitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: 'superhacker' }),
    });

    const res = await quickswitchPost(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain('Invalid persona');
  });

  it('switches to admin persona, seeds dev_admin and establishes admin session', async () => {
    const req = new NextRequest('http://localhost/api/v1/dev/quickswitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: 'admin' }),
    });

    const res = await quickswitchPost(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.persona).toBe('admin');
    expect(json.user.username).toBe('dev_admin');
    expect(json.user.isAdmin).toBe(true);
    expect(json.user.status).toBe('active');

    // Verify session cookie was returned
    const cookieHeader = res.headers.get('set-cookie');
    expect(cookieHeader).toBeTruthy();

    // Verify /api/v1/auth/me recognizes the admin session
    const meReq = new NextRequest('http://localhost/api/v1/auth/me', {
      headers: { cookie: cookieHeader! },
    });
    const meRes = await meGet(meReq);
    expect(meRes.status).toBe(200);
    const meJson = await meRes.json();
    expect(meJson.authenticated).toBe(true);
    expect(meJson.user.username).toBe('dev_admin');
    expect(meJson.role).toBe('admin');
  });

  it('switches to curator persona, seeds dev_curator and establishes curator grant', async () => {
    const req = new NextRequest('http://localhost/api/v1/dev/quickswitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: 'curator' }),
    });

    const res = await quickswitchPost(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.persona).toBe('curator');
    expect(json.user.username).toBe('dev_curator');
    expect(json.user.isAdmin).toBe(false);

    // Verify global grant
    const grant = getAccessGrant(json.user.id, 'global', '*');
    expect(grant).not.toBeNull();
    expect(grant!.role).toBe('curator');

    // Verify /api/v1/auth/me returns role = 'curator'
    const cookieHeader = res.headers.get('set-cookie');
    const meReq = new NextRequest('http://localhost/api/v1/auth/me', {
      headers: { cookie: cookieHeader! },
    });
    const meRes = await meGet(meReq);
    const meJson = await meRes.json();
    expect(meJson.authenticated).toBe(true);
    expect(meJson.role).toBe('curator');
  });

  it('switches to reader persona, seeds dev_reader and establishes reader grant', async () => {
    const req = new NextRequest('http://localhost/api/v1/dev/quickswitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: 'reader' }),
    });

    const res = await quickswitchPost(req);
    expect(res.status).toBe(200);

    const json = await res.json();
    expect(json.success).toBe(true);
    expect(json.persona).toBe('reader');
    expect(json.user.username).toBe('dev_reader');
    expect(json.user.isAdmin).toBe(false);

    // Verify global grant
    const grant = getAccessGrant(json.user.id, 'global', '*');
    expect(grant).not.toBeNull();
    expect(grant!.role).toBe('reader');

    // Verify /api/v1/auth/me returns role = 'reader'
    const cookieHeader = res.headers.get('set-cookie');
    const meReq = new NextRequest('http://localhost/api/v1/auth/me', {
      headers: { cookie: cookieHeader! },
    });
    const meRes = await meGet(meReq);
    const meJson = await meRes.json();
    expect(meJson.authenticated).toBe(true);
    expect(meJson.role).toBe('reader');
  });

  it('switches to guest persona, clearing existing session', async () => {
    // 1. Log in as admin first
    const adminReq = new NextRequest('http://localhost/api/v1/dev/quickswitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: 'admin' }),
    });
    const adminRes = await quickswitchPost(adminReq);
    const sessionCookie = adminRes.headers.get('set-cookie')!;

    // 2. Switch to guest
    const guestReq = new NextRequest('http://localhost/api/v1/dev/quickswitch', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: sessionCookie,
      },
      body: JSON.stringify({ persona: 'guest' }),
    });
    const guestRes = await quickswitchPost(guestReq);
    expect(guestRes.status).toBe(200);
    const guestJson = await guestRes.json();
    expect(guestJson.success).toBe(true);
    expect(guestJson.persona).toBe('guest');
    expect(guestJson.user).toBeNull();

    // 3. Verify /api/v1/auth/me returns unauthenticated
    const clearCookie = guestRes.headers.get('set-cookie');
    const meReq = new NextRequest('http://localhost/api/v1/auth/me', {
      headers: { cookie: clearCookie || '' },
    });
    const meRes = await meGet(meReq);
    const meJson = await meRes.json();
    expect(meJson.authenticated).toBe(false);
    expect(meJson.user).toBeNull();
  });

  it('returns isBootstrap: true when 0 users exist in the system', async () => {
    expect(countUsers()).toBe(0);

    const meReq = new NextRequest('http://localhost/api/v1/auth/me');
    const meRes = await meGet(meReq);
    expect(meRes.status).toBe(200);

    const meJson = await meRes.json();
    expect(meJson.authenticated).toBe(false);
    expect(meJson.user).toBeNull();
    expect(meJson.isBootstrap).toBe(true);
  });

  it('PATCH /api/v1/admin/users/[id] with revokeSessions: true increments session epoch', async () => {
    // 1. Log in as admin via quickswitch
    const adminReq = new NextRequest('http://localhost/api/v1/dev/quickswitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: 'admin' }),
    });
    const adminRes = await quickswitchPost(adminReq);
    const adminCookie = adminRes.headers.get('set-cookie')!;
    const adminData = await adminRes.json();
    const adminId = adminData.user.id;

    // 2. Create a target user
    const targetUser = createUser({
      username: 'test_session_target',
      passwordHash: 'dummy',
      status: 'active',
      isAdmin: false,
    });
    expect(targetUser.sessionEpoch).toBe(1);

    // 3. Admin calls PATCH with revokeSessions: true
    const patchReq = new NextRequest(`http://localhost/api/v1/admin/users/${targetUser.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookie,
      },
      body: JSON.stringify({ revokeSessions: true }),
    });
    const patchRes = await adminUserPatch(patchReq, {
      params: Promise.resolve({ id: String(targetUser.id) }),
    });
    expect(patchRes.status).toBe(200);

    // 4. Verify epoch incremented
    const updated = getUserById(targetUser.id);
    expect(updated!.sessionEpoch).toBe(2);
  });

  it('PATCH /api/v1/admin/users/[id] auto-seeds global reader grant when activating a pending user', async () => {
    // 1. Admin login
    const adminReq = new NextRequest('http://localhost/api/v1/dev/quickswitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: 'admin' }),
    });
    const adminRes = await quickswitchPost(adminReq);
    const adminCookie = adminRes.headers.get('set-cookie')!;

    // 2. Create pending user without grants
    const pendingUser = createUser({
      username: 'pending_applicant',
      passwordHash: 'dummy',
      status: 'pending',
      isAdmin: false,
    });
    expect(getAccessGrant(pendingUser.id, 'global', '*')).toBeNull();

    // 3. Admin approves pending user
    const patchReq = new NextRequest(`http://localhost/api/v1/admin/users/${pendingUser.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        cookie: adminCookie,
      },
      body: JSON.stringify({ status: 'active' }),
    });
    const patchRes = await adminUserPatch(patchReq, {
      params: Promise.resolve({ id: String(pendingUser.id) }),
    });
    expect(patchRes.status).toBe(200);

    // 4. Verify global grant was automatically established
    const grant = getAccessGrant(pendingUser.id, 'global', '*');
    expect(grant).not.toBeNull();
    expect(grant!.role).toBe('reader');
  });

  it('/api/v1/auth/me resolves cascading library overrides and returns isBootstrap: false', async () => {
    // 1. Reader login
    const readerReq = new NextRequest('http://localhost/api/v1/dev/quickswitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ persona: 'reader' }),
    });
    const readerRes = await quickswitchPost(readerReq);
    const readerCookie = readerRes.headers.get('set-cookie')!;
    const readerData = await readerRes.json();

    // 2. Check general /api/v1/auth/me
    const meReq1 = new NextRequest('http://localhost/api/v1/auth/me', {
      headers: { cookie: readerCookie },
    });
    const meRes1 = await meGet(meReq1);
    expect(meRes1.status).toBe(200);
    const meData1 = await meRes1.json();
    expect(meData1.authenticated).toBe(true);
    expect(meData1.role).toBe('reader');
    expect(meData1.isBootstrap).toBe(false);

    // 3. Grant curator override on 'SpecialVault'
    setAccessGrant({
      userId: readerData.user.id,
      resourceType: 'library',
      resourceId: 'SpecialVault',
      role: 'curator',
      grantedBy: null,
    });

    // 4. Request /api/v1/auth/me?library=SpecialVault
    const meReq2 = new NextRequest('http://localhost/api/v1/auth/me?library=SpecialVault', {
      headers: { cookie: readerCookie },
    });
    const meRes2 = await meGet(meReq2);
    expect(meRes2.status).toBe(200);
    const meData2 = await meRes2.json();
    expect(meData2.role).toBe('curator');
  });
});
