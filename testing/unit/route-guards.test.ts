import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { NextRequest } from 'next/server';

import {
  closeSkalybrDb,
  createUser,
  upsertLibraryRecord,
  setAccessGrant,
  updateUser,
} from '@/lib/db/skalybr-db';
import { clearCachedSessionSecret } from '@/lib/auth/session';
import { requireLibraryAccess, requireAdmin, requireAuth } from '@/lib/auth/guard';

import { POST as registerPost } from '@/app/api/v1/auth/register/route';
import { POST as loginPost } from '@/app/api/v1/auth/login/route';
import { GET as librariesGet, POST as librariesPost } from '@/app/api/v1/libraries/route';
import {
  GET as libraryGet,
  PATCH as libraryPatch,
  DELETE as libraryDelete,
} from '@/app/api/v1/libraries/[library]/route';
import { GET as booksGet } from '@/app/api/v1/libraries/[library]/books/route';
import {
  GET as bookDetailGet,
  PATCH as bookDetailPatch,
  DELETE as bookDetailDelete,
} from '@/app/api/v1/libraries/[library]/books/[id]/route';
import {
  GET as progressGet,
  POST as progressPost,
} from '@/app/api/v1/libraries/[library]/books/[id]/progress/route';
import { GET as adminUsersGet } from '@/app/api/v1/admin/users/route';
import {
  PATCH as adminUserPatch,
  DELETE as adminUserDelete,
} from '@/app/api/v1/admin/users/[id]/route';
import {
  GET as adminGrantsGet,
  POST as adminGrantsPost,
  DELETE as adminGrantsDelete,
} from '@/app/api/v1/admin/users/[id]/grants/route';

describe('Route Guard Helpers & Guarded API Endpoints (Phase 4)', () => {
  let tempDir: string;
  let originalDataDir: string | undefined;
  let originalSessionSecret: string | undefined;

  let adminCookie: string;
  let readerCookie: string;
  let curatorCookie: string;

  beforeEach(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skalybr-guard-test-'));
    originalDataDir = process.env.DATA_DIR;
    originalSessionSecret = process.env.SESSION_SECRET;

    process.env.DATA_DIR = tempDir;
    process.env.SESSION_SECRET = 'skalybr_unit_test_session_secret_32_chars_long!';
    clearCachedSessionSecret();
    closeSkalybrDb();

    // 1. Register first user -> becomes admin
    const regAdminRes = await registerPost(
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
    adminCookie = regAdminRes.headers.get('set-cookie')!;

    // 2. Register reader user (subsequent signup -> pending)
    await registerPost(
      new NextRequest('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'reader_user',
          password: 'ReaderPassword123!',
          email: 'reader@skalybr.io',
        }),
      })
    );
    // Approve reader
    updateUser(2, { status: 'active' });
    const loginReaderRes = await loginPost(
      new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'reader_user',
          password: 'ReaderPassword123!',
        }),
      })
    );
    readerCookie = loginReaderRes.headers.get('set-cookie')!;

    // 3. Register curator user
    await registerPost(
      new NextRequest('http://localhost/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'curator_user',
          password: 'CuratorPassword123!',
          email: 'curator@skalybr.io',
        }),
      })
    );
    // Approve curator and grant global curator
    updateUser(3, { status: 'active' });
    setAccessGrant({
      userId: 3,
      resourceType: 'global',
      resourceId: '*',
      role: 'curator',
      grantedBy: 1,
    });
    const loginCuratorRes = await loginPost(
      new NextRequest('http://localhost/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'curator_user',
          password: 'CuratorPassword123!',
        }),
      })
    );
    curatorCookie = loginCuratorRes.headers.get('set-cookie')!;

    // Seed test libraries (both in db and matching actual libraries on disk)
    upsertLibraryRecord({ name: 'demo', displayName: 'Demo Library', isPublic: true });
    upsertLibraryRecord({ name: 'boox', displayName: 'Boox Library', isPublic: false });
    upsertLibraryRecord({ name: 'public_vault', displayName: 'Public Vault', isPublic: true });
    upsertLibraryRecord({ name: 'secret_vault', displayName: 'Secret Vault', isPublic: false });
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

  describe('Route Guard Helper Unit Tests (lib/auth/guard.ts)', () => {
    it('requireLibraryAccess enforces access hierarchy and returns 401 / 403 appropriately', async () => {
      // 1. Unauthenticated on private library -> 401
      const unauthReq = new NextRequest('http://localhost/api/v1/libraries/secret_vault');
      const res1 = await requireLibraryAccess(unauthReq, 'secret_vault', 'reader');
      expect(res1.authorized).toBe(false);
      expect(res1.response!.status).toBe(401);

      // 2. Unauthenticated on public library with reader minRole -> authorized
      const res2 = await requireLibraryAccess(unauthReq, 'public_vault', 'reader');
      expect(res2.authorized).toBe(true);
      expect(res2.user).toBeNull();
      expect(res2.role).toBe('reader');

      // 3. Unauthenticated on public library with curator minRole -> 401
      const res3 = await requireLibraryAccess(unauthReq, 'public_vault', 'curator');
      expect(res3.authorized).toBe(false);
      expect(res3.response!.status).toBe(401);

      // 4. Authenticated reader on public library requesting curator access -> 403
      const readerReq = new NextRequest('http://localhost/api/v1/libraries/public_vault', {
        headers: { cookie: readerCookie },
      });
      const res4 = await requireLibraryAccess(readerReq, 'public_vault', 'curator');
      expect(res4.authorized).toBe(false);
      expect(res4.response!.status).toBe(403);

      // 5. Authenticated curator on library -> authorized
      const curatorReq = new NextRequest('http://localhost/api/v1/libraries/secret_vault', {
        headers: { cookie: curatorCookie },
      });
      const res5 = await requireLibraryAccess(curatorReq, 'secret_vault', 'curator');
      expect(res5.authorized).toBe(true);
      expect(res5.role).toBe('curator');

      // 6. Admin on any library -> authorized with admin role
      const adminReq = new NextRequest('http://localhost/api/v1/libraries/secret_vault', {
        headers: { cookie: adminCookie },
      });
      const res6 = await requireLibraryAccess(adminReq, 'secret_vault', 'curator');
      expect(res6.authorized).toBe(true);
      expect(res6.role).toBe('admin');
    });

    it('requireAdmin restricts access to super admins only', async () => {
      // Unauthenticated -> 401
      const unauthReq = new NextRequest('http://localhost/api/v1/admin/users');
      const res1 = await requireAdmin(unauthReq);
      expect(res1.authorized).toBe(false);
      expect(res1.response!.status).toBe(401);

      // Authenticated non-admin (even curator) -> 403
      const curatorReq = new NextRequest('http://localhost/api/v1/admin/users', {
        headers: { cookie: curatorCookie },
      });
      const res2 = await requireAdmin(curatorReq);
      expect(res2.authorized).toBe(false);
      expect(res2.response!.status).toBe(403);

      // Admin -> authorized
      const adminReq = new NextRequest('http://localhost/api/v1/admin/users', {
        headers: { cookie: adminCookie },
      });
      const res3 = await requireAdmin(adminReq);
      expect(res3.authorized).toBe(true);
      expect(res3.user?.isAdmin).toBe(true);
    });

    it('requireAuth restricts access to active authenticated users', async () => {
      const unauthReq = new NextRequest('http://localhost/api/v1/progress');
      const res1 = await requireAuth(unauthReq);
      expect(res1.authorized).toBe(false);
      expect(res1.response!.status).toBe(401);

      const authReq = new NextRequest('http://localhost/api/v1/progress', {
        headers: { cookie: readerCookie },
      });
      const res2 = await requireAuth(authReq);
      expect(res2.authorized).toBe(true);
      expect(res2.user!.username).toBe('reader_user');
    });
  });

  describe('Libraries API Route Guarding (/api/v1/libraries)', () => {
    it('GET /api/v1/libraries filters libraries based on caller permissions', async () => {
      // 1. Unauthenticated guest only sees public libraries
      const guestReq = new NextRequest('http://localhost/api/v1/libraries');
      const guestRes = await librariesGet(guestReq);
      expect(guestRes.status).toBe(200);
      const guestData = await guestRes.json();
      const guestNames = guestData.data.map((l: any) => l.name);
      expect(guestNames).toContain('demo');
      expect(guestNames).not.toContain('boox');

      // 2. Reader user initially only sees public libraries
      const readerReq = new NextRequest('http://localhost/api/v1/libraries', {
        headers: { cookie: readerCookie },
      });
      const readerRes1 = await librariesGet(readerReq);
      const readerData1 = await readerRes1.json();
      expect(readerData1.data.map((l: any) => l.name)).toContain('demo');
      expect(readerData1.data.map((l: any) => l.name)).not.toContain('boox');

      // Grant reader_user access to boox
      setAccessGrant({
        userId: 2,
        resourceType: 'library',
        resourceId: 'boox',
        role: 'reader',
        grantedBy: 1,
      });

      const readerRes2 = await librariesGet(readerReq);
      const readerData2 = await readerRes2.json();
      const readerNames2 = readerData2.data.map((l: any) => l.name);
      expect(readerNames2).toContain('demo');
      expect(readerNames2).toContain('boox');

      // 3. Admin sees all libraries
      const adminReq = new NextRequest('http://localhost/api/v1/libraries', {
        headers: { cookie: adminCookie },
      });
      const adminRes = await librariesGet(adminReq);
      const adminData = await adminRes.json();
      const adminNames = adminData.data.map((l: any) => l.name);
      expect(adminNames).toContain('demo');
      expect(adminNames).toContain('boox');
    });

    it('POST /api/v1/libraries requires admin', async () => {
      // Unauthenticated -> 401
      const unauthReq = new NextRequest('http://localhost/api/v1/libraries', { method: 'POST' });
      const res1 = await librariesPost(unauthReq);
      expect(res1.status).toBe(401);

      // Non-admin -> 403
      const readerReq = new NextRequest('http://localhost/api/v1/libraries', {
        method: 'POST',
        headers: { cookie: readerCookie },
      });
      const res2 = await librariesPost(readerReq);
      expect(res2.status).toBe(403);
    });
  });

  describe('Library Detail API Route Guarding (/api/v1/libraries/[library])', () => {
    it('GET /api/v1/libraries/[library] enforces reader role', async () => {
      // Public library -> guest allowed (status 200 or 404 if not on disk, but NOT 401/403)
      const guestPubReq = new NextRequest('http://localhost/api/v1/libraries/public_vault');
      const resPub = await libraryGet(guestPubReq, {
        params: Promise.resolve({ library: 'public_vault' }),
      });
      expect(resPub.status).not.toBe(401);
      expect(resPub.status).not.toBe(403);

      // Private library -> guest 401
      const guestPrivReq = new NextRequest('http://localhost/api/v1/libraries/secret_vault');
      const resPriv = await libraryGet(guestPrivReq, {
        params: Promise.resolve({ library: 'secret_vault' }),
      });
      expect(resPriv.status).toBe(401);

      // Private library -> user with reader grant allowed
      setAccessGrant({
        userId: 2,
        resourceType: 'library',
        resourceId: 'secret_vault',
        role: 'reader',
        grantedBy: 1,
      });
      const readerPrivReq = new NextRequest('http://localhost/api/v1/libraries/secret_vault', {
        headers: { cookie: readerCookie },
      });
      const resReader = await libraryGet(readerPrivReq, {
        params: Promise.resolve({ library: 'secret_vault' }),
      });
      expect(resReader.status).not.toBe(401);
      expect(resReader.status).not.toBe(403);
    });

    it('PATCH /api/v1/libraries/[library] enforces curator role', async () => {
      const body = JSON.stringify({ displayName: 'Updated Name' });

      // Unauthenticated -> 401
      const unauthReq = new NextRequest('http://localhost/api/v1/libraries/public_vault', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      const res1 = await libraryPatch(unauthReq, {
        params: Promise.resolve({ library: 'public_vault' }),
      });
      expect(res1.status).toBe(401);

      // Reader only -> 403
      const readerReq = new NextRequest('http://localhost/api/v1/libraries/public_vault', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: readerCookie },
        body,
      });
      const res2 = await libraryPatch(readerReq, {
        params: Promise.resolve({ library: 'public_vault' }),
      });
      expect(res2.status).toBe(403);

      // Curator -> 200
      const curatorReq = new NextRequest('http://localhost/api/v1/libraries/public_vault', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: curatorCookie },
        body,
      });
      const res3 = await libraryPatch(curatorReq, {
        params: Promise.resolve({ library: 'public_vault' }),
      });
      expect(res3.status).toBe(200);
    });

    it('DELETE /api/v1/libraries/[library] enforces admin role', async () => {
      // Unauthenticated -> 401
      const unauthReq = new NextRequest('http://localhost/api/v1/libraries/public_vault', {
        method: 'DELETE',
      });
      const res1 = await libraryDelete(unauthReq, {
        params: Promise.resolve({ library: 'public_vault' }),
      });
      expect(res1.status).toBe(401);

      // Curator (non-admin) -> 403
      const curatorReq = new NextRequest('http://localhost/api/v1/libraries/public_vault', {
        method: 'DELETE',
        headers: { cookie: curatorCookie },
      });
      const res2 = await libraryDelete(curatorReq, {
        params: Promise.resolve({ library: 'public_vault' }),
      });
      expect(res2.status).toBe(403);
    });
  });

  describe('Books & Progress API Route Guarding', () => {
    it('GET /api/v1/libraries/[library]/books enforces reader access', async () => {
      const unauthPrivReq = new NextRequest('http://localhost/api/v1/libraries/secret_vault/books');
      const res1 = await booksGet(unauthPrivReq, {
        params: Promise.resolve({ library: 'secret_vault' }),
      });
      expect(res1.status).toBe(401);
    });

    it('GET / PATCH / DELETE book detail endpoints enforce role constraints', async () => {
      // GET on private library without auth -> 401
      const getReq = new NextRequest('http://localhost/api/v1/libraries/secret_vault/books/1');
      const resGet = await bookDetailGet(getReq, {
        params: Promise.resolve({ library: 'secret_vault', id: '1' }),
      });
      expect(resGet.status).toBe(401);

      // PATCH without auth -> 401
      const patchReq = new NextRequest('http://localhost/api/v1/libraries/public_vault/books/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'New' }),
      });
      const resPatch1 = await bookDetailPatch(patchReq, {
        params: Promise.resolve({ library: 'public_vault', id: '1' }),
      });
      expect(resPatch1.status).toBe(401);

      // PATCH with reader only -> 403
      const patchReqReader = new NextRequest('http://localhost/api/v1/libraries/public_vault/books/1', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: readerCookie },
        body: JSON.stringify({ title: 'New' }),
      });
      const resPatch2 = await bookDetailPatch(patchReqReader, {
        params: Promise.resolve({ library: 'public_vault', id: '1' }),
      });
      expect(resPatch2.status).toBe(403);

      // DELETE with reader only -> 403
      const delReqReader = new NextRequest('http://localhost/api/v1/libraries/public_vault/books/1', {
        method: 'DELETE',
        headers: { cookie: readerCookie },
      });
      const resDel = await bookDetailDelete(delReqReader, {
        params: Promise.resolve({ library: 'public_vault', id: '1' }),
      });
      expect(resDel.status).toBe(403);
    });

    it('GET and POST reading progress require authenticated active user', async () => {
      // Unauthenticated GET -> 401
      const unauthGet = new NextRequest('http://localhost/api/v1/libraries/public_vault/books/1/progress');
      const res1 = await progressGet(unauthGet, {
        params: Promise.resolve({ library: 'public_vault', id: '1' }),
      });
      expect(res1.status).toBe(401);

      // Unauthenticated POST -> 401
      const unauthPost = new NextRequest('http://localhost/api/v1/libraries/public_vault/books/1/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ progressPercent: 50 }),
      });
      const res2 = await progressPost(unauthPost, {
        params: Promise.resolve({ library: 'public_vault', id: '1' }),
      });
      expect(res2.status).toBe(401);

      // Authenticated reader GET -> 200
      const authGet = new NextRequest('http://localhost/api/v1/libraries/public_vault/books/1/progress', {
        headers: { cookie: readerCookie },
      });
      const res3 = await progressGet(authGet, {
        params: Promise.resolve({ library: 'public_vault', id: '1' }),
      });
      expect(res3.status).toBe(200);
      const data3 = await res3.json();
      expect(data3.success).toBe(true);
      expect(data3.data.userId).toBe(2);

      // Authenticated reader POST -> 200
      const authPost = new NextRequest('http://localhost/api/v1/libraries/public_vault/books/1/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie: readerCookie },
        body: JSON.stringify({ progressPercent: 42, status: 'reading' }),
      });
      const res4 = await progressPost(authPost, {
        params: Promise.resolve({ library: 'public_vault', id: '1' }),
      });
      expect(res4.status).toBe(200);
      const data4 = await res4.json();
      expect(data4.data.progressPercent).toBe(42);
      expect(data4.data.userId).toBe(2);
    });
  });

  describe('Admin Users Management API (/api/v1/admin/users)', () => {
    it('GET /api/v1/admin/users is guarded by requireAdmin and returns safe user records', async () => {
      // Unauthenticated -> 401
      const res1 = await adminUsersGet(new NextRequest('http://localhost/api/v1/admin/users'));
      expect(res1.status).toBe(401);

      // Reader -> 403
      const res2 = await adminUsersGet(
        new NextRequest('http://localhost/api/v1/admin/users', { headers: { cookie: readerCookie } })
      );
      expect(res2.status).toBe(403);

      // Admin -> 200
      const res3 = await adminUsersGet(
        new NextRequest('http://localhost/api/v1/admin/users', { headers: { cookie: adminCookie } })
      );
      expect(res3.status).toBe(200);
      const data = await res3.json();
      expect(data.success).toBe(true);
      expect(data.data.length).toBeGreaterThanOrEqual(3);

      // Ensure passwordHash is stripped
      for (const u of data.data) {
        expect(u.passwordHash).toBeUndefined();
      }

      // Filter by ?status=active
      const resActive = await adminUsersGet(
        new NextRequest('http://localhost/api/v1/admin/users?status=active', {
          headers: { cookie: adminCookie },
        })
      );
      const activeData = await resActive.json();
      expect(activeData.data.every((u: any) => u.status === 'active')).toBe(true);

      // Filter by invalid status -> 400
      const resBadStatus = await adminUsersGet(
        new NextRequest('http://localhost/api/v1/admin/users?status=invalid_status', {
          headers: { cookie: adminCookie },
        })
      );
      expect(resBadStatus.status).toBe(400);
    });

    it('PATCH /api/v1/admin/users/[id] updates user attributes with validation', async () => {
      // Non-admin -> 403
      const res1 = await adminUserPatch(
        new NextRequest('http://localhost/api/v1/admin/users/2', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', cookie: readerCookie },
          body: JSON.stringify({ displayName: 'Hacker' }),
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(res1.status).toBe(403);

      // Admin prevents self-lockout (cannot suspend self or revoke own admin status)
      const resSelfSuspend = await adminUserPatch(
        new NextRequest('http://localhost/api/v1/admin/users/1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', cookie: adminCookie },
          body: JSON.stringify({ status: 'suspended' }),
        }),
        { params: Promise.resolve({ id: '1' }) }
      );
      expect(resSelfSuspend.status).toBe(400);
      const selfSuspendBody = await resSelfSuspend.json();
      expect(selfSuspendBody.error).toContain('Cannot suspend or deactivate');

      const resSelfDemote = await adminUserPatch(
        new NextRequest('http://localhost/api/v1/admin/users/1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', cookie: adminCookie },
          body: JSON.stringify({ isAdmin: false }),
        }),
        { params: Promise.resolve({ id: '1' }) }
      );
      expect(resSelfDemote.status).toBe(400);
      const selfDemoteBody = await resSelfDemote.json();
      expect(selfDemoteBody.error).toContain('Cannot revoke your own administrator privileges');

      // Invalid status -> 400
      const resInvalid = await adminUserPatch(
        new NextRequest('http://localhost/api/v1/admin/users/2', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', cookie: adminCookie },
          body: JSON.stringify({ status: 'invalid_status' }),
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(resInvalid.status).toBe(400);

      // Admin updates reader_user display name and promotes to admin
      const res2 = await adminUserPatch(
        new NextRequest('http://localhost/api/v1/admin/users/2', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', cookie: adminCookie },
          body: JSON.stringify({
            displayName: 'Reader Supercharged',
            isAdmin: true,
          }),
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(res2.status).toBe(200);
      const data2 = await res2.json();
      expect(data2.data.displayName).toBe('Reader Supercharged');
      expect(data2.data.isAdmin).toBe(true);
      expect(data2.data.passwordHash).toBeUndefined();

      // Suspend user 2 -> invalidates sessions
      const resSuspend = await adminUserPatch(
        new NextRequest('http://localhost/api/v1/admin/users/2', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', cookie: adminCookie },
          body: JSON.stringify({ status: 'suspended' }),
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(resSuspend.status).toBe(200);
      const dataSuspend = await resSuspend.json();
      expect(dataSuspend.data.status).toBe('suspended');
    });

    it('DELETE /api/v1/admin/users/[id] removes user and prevents self-deletion', async () => {
      // Non-admin -> 403
      const res1 = await adminUserDelete(
        new NextRequest('http://localhost/api/v1/admin/users/2', {
          method: 'DELETE',
          headers: { cookie: readerCookie },
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(res1.status).toBe(403);

      // Admin tries to delete themselves (id 1) -> 400
      const resSelf = await adminUserDelete(
        new NextRequest('http://localhost/api/v1/admin/users/1', {
          method: 'DELETE',
          headers: { cookie: adminCookie },
        }),
        { params: Promise.resolve({ id: '1' }) }
      );
      expect(resSelf.status).toBe(400);
      const selfBody = await resSelf.json();
      expect(selfBody.error).toContain('Cannot delete yourself');

      // Admin deletes user 2 -> 200
      const resDel = await adminUserDelete(
        new NextRequest('http://localhost/api/v1/admin/users/2', {
          method: 'DELETE',
          headers: { cookie: adminCookie },
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(resDel.status).toBe(200);

      // Deleting again -> 404
      const res404 = await adminUserDelete(
        new NextRequest('http://localhost/api/v1/admin/users/2', {
          method: 'DELETE',
          headers: { cookie: adminCookie },
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(res404.status).toBe(404);
    });
  });

  describe('Admin Access Grants Management API (/api/v1/admin/users/[id]/grants)', () => {
    it('GET, POST, and DELETE manage access grants correctly with requireAdmin', async () => {
      // 1. GET grants: Non-admin -> 403
      const resGet1 = await adminGrantsGet(
        new NextRequest('http://localhost/api/v1/admin/users/2/grants', {
          headers: { cookie: readerCookie },
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(resGet1.status).toBe(403);

      // Admin -> 200
      const resGet2 = await adminGrantsGet(
        new NextRequest('http://localhost/api/v1/admin/users/2/grants', {
          headers: { cookie: adminCookie },
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(resGet2.status).toBe(200);
      const initialGrants = await resGet2.json();
      expect(initialGrants.data).toEqual([]);

      // 2. POST grant: Validation errors
      const resPostInvalid = await adminGrantsPost(
        new NextRequest('http://localhost/api/v1/admin/users/2/grants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: adminCookie },
          body: JSON.stringify({ resourceType: 'invalid', resourceId: 'x', role: 'reader' }),
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(resPostInvalid.status).toBe(400);

      // POST valid grant
      const resPost = await adminGrantsPost(
        new NextRequest('http://localhost/api/v1/admin/users/2/grants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: adminCookie },
          body: JSON.stringify({
            resourceType: 'library',
            resourceId: 'secret_vault',
            role: 'curator',
          }),
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(resPost.status).toBe(200);
      const postData = await resPost.json();
      expect(postData.success).toBe(true);
      expect(postData.data.role).toBe('curator');
      expect(postData.data.resourceId).toBe('secret_vault');

      // Check GET reflects newly added grant
      const resGet3 = await adminGrantsGet(
        new NextRequest('http://localhost/api/v1/admin/users/2/grants', {
          headers: { cookie: adminCookie },
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      const grantsAfterPost = await resGet3.json();
      expect(grantsAfterPost.data.length).toBe(1);
      expect(grantsAfterPost.data[0].role).toBe('curator');

      // 3. DELETE grant: Non-admin -> 403
      const resDel1 = await adminGrantsDelete(
        new NextRequest('http://localhost/api/v1/admin/users/2/grants', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', cookie: readerCookie },
          body: JSON.stringify({ resourceType: 'library', resourceId: 'secret_vault' }),
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(resDel1.status).toBe(403);

      // Admin DELETE grant -> 200
      const resDel2 = await adminGrantsDelete(
        new NextRequest('http://localhost/api/v1/admin/users/2/grants', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', cookie: adminCookie },
          body: JSON.stringify({ resourceType: 'library', resourceId: 'secret_vault' }),
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(resDel2.status).toBe(200);

      // Deleting already-deleted grant -> 404
      const resDel3 = await adminGrantsDelete(
        new NextRequest('http://localhost/api/v1/admin/users/2/grants', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', cookie: adminCookie },
          body: JSON.stringify({ resourceType: 'library', resourceId: 'secret_vault' }),
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(resDel3.status).toBe(404);

      // 4. Global grant POST without resourceId -> auto-normalizes to '*'
      const resPostGlobal = await adminGrantsPost(
        new NextRequest('http://localhost/api/v1/admin/users/2/grants', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', cookie: adminCookie },
          body: JSON.stringify({ resourceType: 'global', role: 'reader' }),
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(resPostGlobal.status).toBe(200);
      const postGlobalData = await resPostGlobal.json();
      expect(postGlobalData.data.resourceId).toBe('*');
      expect(postGlobalData.data.role).toBe('reader');

      // Global grant DELETE without resourceId -> deletes '*'
      const resDelGlobal = await adminGrantsDelete(
        new NextRequest('http://localhost/api/v1/admin/users/2/grants', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', cookie: adminCookie },
          body: JSON.stringify({ resourceType: 'global' }),
        }),
        { params: Promise.resolve({ id: '2' }) }
      );
      expect(resDelGlobal.status).toBe(200);
    });

    it('requireLibraryAccess correctly decodes URL-encoded library names', async () => {
      upsertLibraryRecord({ name: 'Sci Fi', displayName: 'Science Fiction', isPublic: true });

      const unauthReq = new NextRequest('http://localhost/api/v1/libraries/Sci%20Fi');
      const guard = await requireLibraryAccess(unauthReq, 'Sci%20Fi', 'reader');
      expect(guard.authorized).toBe(true);
      expect(guard.role).toBe('reader');
    });

    it('PATCH endpoints safely handle malformed JSON bodies with 400 Bad Request', async () => {
      const badJsonReq = new NextRequest('http://localhost/api/v1/libraries/public_vault', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', cookie: curatorCookie },
        body: 'invalid-json-body{{{',
      });
      const res = await libraryPatch(badJsonReq, {
        params: Promise.resolve({ library: 'public_vault' }),
      });
      expect(res.status).toBe(400);
    });
  });
});
