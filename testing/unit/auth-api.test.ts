import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { NextRequest } from 'next/server';

import { hashPassword, verifyPassword } from '@/lib/auth/password';
import {
  getSessionSecret,
  clearCachedSessionSecret,
} from '@/lib/auth/session';
import { getCurrentUser, getSession, toSafeUser } from '@/lib/auth/server';
import {
  closeSkalybrDb,
  updateUser,
  incrementSessionEpoch,
  getAppSetting,
} from '@/lib/db/skalybr-db';

import { POST as registerPost } from '@/app/api/v1/auth/register/route';
import { POST as loginPost } from '@/app/api/v1/auth/login/route';
import { POST as logoutPost } from '@/app/api/v1/auth/logout/route';
import { GET as meGet } from '@/app/api/v1/auth/me/route';

describe('Authentication Engine & API Endpoints (Phase 3)', () => {
  let tempDir: string;
  let originalDataDir: string | undefined;
  let originalSessionSecret: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skalybr-auth-api-test-'));
    originalDataDir = process.env.DATA_DIR;
    originalSessionSecret = process.env.SESSION_SECRET;

    process.env.DATA_DIR = tempDir;
    // Set a known 32+ character test secret by default
    process.env.SESSION_SECRET = 'skalybr_unit_test_session_secret_32_chars_long!';
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

    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Password Hashing & Verification (lib/auth/password.ts)', () => {
    it('hashes passwords using bcrypt work factor 12 and verifies in constant time', async () => {
      const password = 'SuperSecretPassword123!';
      const hash = await hashPassword(password);

      // Verify prefix and cost factor 12
      expect(hash).toMatch(/^\$2[aby]\$12\$/);

      // Verify matching password
      const match = await verifyPassword(password, hash);
      expect(match).toBe(true);

      // Verify wrong password fails
      const wrongMatch = await verifyPassword('WrongPassword123!', hash);
      expect(wrongMatch).toBe(false);

      // Verify empty or invalid hash handling
      expect(await verifyPassword('', hash)).toBe(false);
      expect(await verifyPassword(password, '')).toBe(false);
      expect(await verifyPassword(password, 'invalid-hash-string')).toBe(false);
    });
  });

  describe('Session Secret Management & Fallback (lib/auth/session.ts)', () => {
    it('uses process.env.SESSION_SECRET when set and >= 32 chars', () => {
      process.env.SESSION_SECRET = 'custom_secret_key_that_has_more_than_32_chars_12345';
      clearCachedSessionSecret();
      expect(getSessionSecret()).toBe('custom_secret_key_that_has_more_than_32_chars_12345');
    });

    it('generates and persists secret in settings table when process.env.SESSION_SECRET is omitted', () => {
      delete process.env.SESSION_SECRET;
      clearCachedSessionSecret();

      const secret1 = getSessionSecret();
      expect(secret1.length).toBeGreaterThanOrEqual(32);

      // Verify it was persisted in settings table
      const stored = getAppSetting('session_secret');
      expect(stored).toBe(secret1);

      // Subsequent call in fresh cache retrieves the exact same persisted secret
      clearCachedSessionSecret();
      const secret2 = getSessionSecret();
      expect(secret2).toBe(secret1);
    });
  });

  describe('First User Bootstrap & User Registration (/api/v1/auth/register)', () => {
    it('registers first user as active admin and immediately establishes session', async () => {
      const req = new NextRequest('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'first_admin',
          password: 'admin_password_123',
          email: 'admin@skalybr.local',
          displayName: 'Initial Administrator',
        }),
      });

      const res = await registerPost(req);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.user.username).toBe('first_admin');
      expect(data.user.isAdmin).toBe(true);
      expect(data.user.status).toBe('active');
      expect(data.user.displayName).toBe('Initial Administrator');
      expect(data.user.passwordHash).toBeUndefined();

      // Session cookie should be set for the first user
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain('skalybr_session=');
    });

    it('registers subsequent users as pending non-admin and does NOT establish session', async () => {
      // 1. Create first user
      const adminReq = new NextRequest('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin_password_123',
        }),
      });
      await registerPost(adminReq);

      // 2. Register second user
      const userReq = new NextRequest('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'alice',
          password: 'alice_password_123',
          email: 'alice@example.com',
        }),
      });

      const userRes = await userReq;
      const res = await registerPost(userReq);
      expect(res.status).toBe(201);

      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('pending administrator approval');
      expect(data.user.username).toBe('alice');
      expect(data.user.isAdmin).toBe(false);
      expect(data.user.status).toBe('pending');
      expect(data.user.passwordHash).toBeUndefined();

      // No session cookie should be issued for pending user
      const setCookie = res.headers.get('set-cookie');
      expect(setCookie).toBeNull();
    });

    it('validates input fields and rejects duplicates', async () => {
      // Short username (< 3)
      const res1 = await registerPost(
        new NextRequest('http://localhost/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'ab', password: 'password123' }),
        })
      );
      expect(res1.status).toBe(400);

      // Short password (< 6)
      const res2 = await registerPost(
        new NextRequest('http://localhost/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: 'validuser', password: '123' }),
        })
      );
      expect(res2.status).toBe(400);

      // Invalid email
      const res3 = await registerPost(
        new NextRequest('http://localhost/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'validuser',
            password: 'password123',
            email: 'not-an-email',
          }),
        })
      );
      expect(res3.status).toBe(400);

      // Successful registration
      const res4 = await registerPost(
        new NextRequest('http://localhost/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'validuser',
            password: 'password123',
            email: 'user@example.com',
          }),
        })
      );
      expect(res4.status).toBe(201);

      // Duplicate username
      const res5 = await registerPost(
        new NextRequest('http://localhost/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'validuser',
            password: 'different_password',
          }),
        })
      );
      expect(res5.status).toBe(409);
      const dupUserBody = await res5.json();
      expect(dupUserBody.error).toContain('Username is already taken');

      // Duplicate email
      const res6 = await registerPost(
        new NextRequest('http://localhost/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'anotheruser',
            password: 'password123',
            email: 'user@example.com',
          }),
        })
      );
      expect(res6.status).toBe(409);
      const dupEmailBody = await res6.json();
      expect(dupEmailBody.error).toContain('Email is already registered');

      // Whitespace in optional fields (email and displayName) should not trigger validation errors
      const res7 = await registerPost(
        new NextRequest('http://localhost/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'whitespaceuser',
            password: 'password123',
            email: '   ',
            displayName: '   ',
          }),
        })
      );
      expect(res7.status).toBe(201);
      const whitespaceBody = await res7.json();
      expect(whitespaceBody.user.email).toBeNull();
      expect(whitespaceBody.user.displayName).toBeNull();
    });
  });

  describe('User Authentication (/api/v1/auth/login)', () => {
    beforeEach(async () => {
      // Register initial admin
      await registerPost(
        new NextRequest('http://localhost/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'admin',
            password: 'AdminPassword123!',
            email: 'admin@skalybr.io',
          }),
        })
      );

      // Register second user (pending)
      await registerPost(
        new NextRequest('http://localhost/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'bob',
            password: 'BobPassword123!',
            email: 'bob@skalybr.io',
          }),
        })
      );
    });

    it('logs in active user with username or email and returns session cookie', async () => {
      // 1. Login with username
      const req1 = new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'AdminPassword123!',
        }),
      });
      const res1 = await loginPost(req1);
      expect(res1.status).toBe(200);

      const data1 = await res1.json();
      expect(data1.success).toBe(true);
      expect(data1.user.username).toBe('admin');
      expect(data1.user.isAdmin).toBe(true);
      expect(data1.user.passwordHash).toBeUndefined();

      const cookie1 = res1.headers.get('set-cookie');
      expect(cookie1).toContain('skalybr_session=');

      // 2. Login with email
      const req2 = new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin@skalybr.io',
          password: 'AdminPassword123!',
        }),
      });
      const res2 = await loginPost(req2);
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.user.username).toBe('admin');

      // 3. Login with uppercase email
      const req3 = new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'ADMIN@SKALYBR.IO',
          password: 'AdminPassword123!',
        }),
      });
      const res3 = await loginPost(req3);
      expect(res3.status).toBe(200);
      const data3 = await res3.json();
      expect(data3.user.username).toBe('admin');
    });

    it('rejects wrong password with 401', async () => {
      const req = new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'WrongPassword!',
        }),
      });
      const res = await loginPost(req);
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain('Invalid username or password');
    });

    it('rejects non-existent username with 401', async () => {
      const req = new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'does_not_exist',
          password: 'SomePassword123!',
        }),
      });
      const res = await loginPost(req);
      expect(res.status).toBe(401);
    });

    it('blocks pending user with 403 until administrator approval', async () => {
      // Attempt login while pending
      const req = new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'bob',
          password: 'BobPassword123!',
        }),
      });
      const res = await loginPost(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('pending administrator approval');

      // Approve bob: update status to active
      updateUser(2, { status: 'active' });

      // Now bob can log in successfully
      const approvedReq = new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'bob',
          password: 'BobPassword123!',
        }),
      });
      const approvedRes = await loginPost(approvedReq);
      expect(approvedRes.status).toBe(200);
      const approvedData = await approvedRes.json();
      expect(approvedData.user.username).toBe('bob');

      expect(approvedData.user.status).toBe('active');
    });

    it('blocks suspended user with 403', async () => {
      // Suspend user 2
      updateUser(2, { status: 'suspended' });

      const req = new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'bob',
          password: 'BobPassword123!',
        }),
      });
      const res = await loginPost(req);
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain('suspended');
    });
  });

  describe('Session State, Current User & Revocation (/api/v1/auth/me, server.ts)', () => {
    let sessionCookie: string;

    beforeEach(async () => {
      // Register and login admin
      const regRes = await registerPost(
        new NextRequest('http://localhost/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'admin',
            password: 'AdminPassword123!',
          }),
        })
      );
      sessionCookie = regRes.headers.get('set-cookie')!;
    });

    it('/api/v1/auth/me returns authenticated status and safe user record', async () => {
      const req = new NextRequest('http://localhost/api/v1/auth/me', {
        headers: { cookie: sessionCookie },
      });
      const res = await meGet(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.authenticated).toBe(true);
      expect(data.user.id).toBe(1);
      expect(data.user.username).toBe('admin');
      expect(data.user.isAdmin).toBe(true);
      expect(data.user.passwordHash).toBeUndefined();
      expect(data.user.sessionEpoch).toBe(1);
    });

    it('/api/v1/auth/me returns authenticated: false when unauthenticated', async () => {
      const req = new NextRequest('http://localhost/api/v1/auth/me');
      const res = await meGet(req);
      expect(res.status).toBe(200);

      const data = await res.json();
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeNull();
    });

    it('session epoch increment immediately invalidates active sessions', async () => {
      // 1. Verify session works initially
      const req1 = new NextRequest('http://localhost/api/v1/auth/me', {
        headers: { cookie: sessionCookie },
      });
      const res1 = await meGet(req1);
      const data1 = await res1.json();
      expect(data1.authenticated).toBe(true);

      // 2. Increment session epoch (e.g. security revocation or role change)
      const newEpoch = incrementSessionEpoch(1);
      expect(newEpoch).toBe(2);

      // 3. Verify server-level getCurrentUser treats session as revoked
      const currentUser = await getCurrentUser(req1);
      expect(currentUser.user).toBeNull();
      expect(currentUser.session).toBeNull();

      // 4. Verify /api/v1/auth/me rejects subsequent request and sends Set-Cookie to clear cookie
      const res2 = await meGet(req1);
      const data2 = await res2.json();
      expect(data2.authenticated).toBe(false);
      expect(data2.user).toBeNull();

      const clearCookie = res2.headers.get('set-cookie');
      expect(clearCookie).toContain('Max-Age=0');
    });

    it('suspending an active user immediately invalidates their active session', async () => {
      const req = new NextRequest('http://localhost/api/v1/auth/me', {
        headers: { cookie: sessionCookie },
      });

      // Suspend user
      updateUser(1, { status: 'suspended' });

      const res = await meGet(req);
      const data = await res.json();
      expect(data.authenticated).toBe(false);
      expect(data.user).toBeNull();
    });

    it('toSafeUser helper correctly strips passwordHash', () => {
      const mockUser = {
        id: 1,
        username: 'test',
        email: 'test@example.com',
        passwordHash: '$2a$12$hashedstring',
        displayName: 'Test',
        status: 'active' as const,
        isAdmin: true,
        sessionEpoch: 1,
        createdAt: '2026-09-21',
        updatedAt: '2026-09-21',
      };

      const safe = toSafeUser(mockUser);
      expect(safe).not.toBeNull();
      expect(safe!.username).toBe('test');
      expect((safe as any).passwordHash).toBeUndefined();
      expect(toSafeUser(null)).toBeNull();
    });

    it('supports retrieving session and current user via Web Headers object', async () => {
      const headers = new Headers();
      headers.set('cookie', sessionCookie);

      const session = await getSession(headers);
      expect(session.authenticated).toBe(true);
      expect(session.userId).toBe(1);
      expect(session.username).toBe('admin');

      const currentUser = await getCurrentUser(headers);
      expect(currentUser.user).not.toBeNull();
      expect(currentUser.user!.username).toBe('admin');
      expect(currentUser.session).not.toBeNull();
      expect(currentUser.session!.authenticated).toBe(true);
    });

    it('gracefully returns unauthenticated state when called without parameters in non-request context', async () => {
      const session = await getSession();
      expect(session.authenticated).toBeUndefined();

      const currentUser = await getCurrentUser();
      expect(currentUser.user).toBeNull();
      expect(currentUser.session).toBeNull();
    });
  });

  describe('User Logout (/api/v1/auth/logout)', () => {
    it('clears session cookie on logout', async () => {
      // 1. Register admin
      const regRes = await registerPost(
        new NextRequest('http://localhost/api/v1/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            username: 'admin',
            password: 'AdminPassword123!',
          }),
        })
      );
      const sessionCookie = regRes.headers.get('set-cookie')!;

      // 2. Perform logout
      const logoutReq = new NextRequest('http://localhost/api/v1/auth/logout', {
        method: 'POST',
        headers: { cookie: sessionCookie },
      });
      const logoutRes = await logoutPost(logoutReq);
      expect(logoutRes.status).toBe(200);
      const logoutData = await logoutRes.json();
      expect(logoutData.success).toBe(true);

      const clearCookie = logoutRes.headers.get('set-cookie');
      expect(clearCookie).toContain('Max-Age=0');

      // 3. Confirm session is gone with the cleared cookie
      const meReq = new NextRequest('http://localhost/api/v1/auth/me', {
        headers: { cookie: clearCookie! },
      });
      const meRes = await meGet(meReq);
      const meData = await meRes.json();
      expect(meData.authenticated).toBe(false);
      expect(meData.user).toBeNull();
    });
  });
});
