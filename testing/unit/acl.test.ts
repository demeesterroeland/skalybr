import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import {
  closeSkalybrDb,
  createUser,
  upsertLibraryRecord,
  setAccessGrant,
  createShelf,
  linkBookToShelf,
} from '@/lib/db/skalybr-db';
import {
  ROLE_WEIGHTS,
  hasMinimumRole,
  getEffectiveRole,
  canAccessLibrary,
  canAccessShelf,
  filterAccessibleLibraries,
} from '@/lib/auth/acl';
import type { UserRecord } from '@/lib/types';

describe('Cascading ACL Resolution Engine (lib/auth/acl.ts)', () => {
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skalybr-acl-test-'));
    originalDataDir = process.env.DATA_DIR;
    process.env.DATA_DIR = tempDir;
    closeSkalybrDb();
  });

  afterEach(() => {
    closeSkalybrDb();
    if (originalDataDir !== undefined) {
      process.env.DATA_DIR = originalDataDir;
    } else {
      delete process.env.DATA_DIR;
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('Role Weight & Minimum Role Checking', () => {
    it('defines correct numerical role weights', () => {
      expect(ROLE_WEIGHTS.none).toBe(0);
      expect(ROLE_WEIGHTS.reader).toBe(1);
      expect(ROLE_WEIGHTS.curator).toBe(2);
      expect(ROLE_WEIGHTS.admin).toBe(3);
    });

    it('evaluates hasMinimumRole correctly across all role pairs', () => {
      expect(hasMinimumRole('admin', 'admin')).toBe(true);
      expect(hasMinimumRole('admin', 'curator')).toBe(true);
      expect(hasMinimumRole('admin', 'reader')).toBe(true);
      expect(hasMinimumRole('admin', 'none')).toBe(true);

      expect(hasMinimumRole('curator', 'admin')).toBe(false);
      expect(hasMinimumRole('curator', 'curator')).toBe(true);
      expect(hasMinimumRole('curator', 'reader')).toBe(true);
      expect(hasMinimumRole('curator', 'none')).toBe(true);

      expect(hasMinimumRole('reader', 'admin')).toBe(false);
      expect(hasMinimumRole('reader', 'curator')).toBe(false);
      expect(hasMinimumRole('reader', 'reader')).toBe(true);
      expect(hasMinimumRole('reader', 'none')).toBe(true);

      expect(hasMinimumRole('none', 'admin')).toBe(false);
      expect(hasMinimumRole('none', 'curator')).toBe(false);
      expect(hasMinimumRole('none', 'reader')).toBe(false);
      expect(hasMinimumRole('none', 'none')).toBe(true);
    });
  });

  describe('Cascading Resolution (getEffectiveRole)', () => {
    it('super admin user always receives admin role everywhere', () => {
      const adminUser = createUser({
        username: 'admin_user',
        passwordHash: 'hash',
        status: 'active',
        isAdmin: true,
      });

      // Private library with no explicit grant
      upsertLibraryRecord({ name: 'top_secret', isPublic: false });

      expect(getEffectiveRole(adminUser, 'library', 'top_secret')).toBe('admin');
      expect(getEffectiveRole(adminUser, 'shelf', 'any-shelf-uuid')).toBe('admin');
      expect(canAccessLibrary(adminUser, 'top_secret', 'admin')).toBe(true);
      expect(canAccessShelf(adminUser, 'any-shelf-uuid', 'admin')).toBe(true);
    });

    it('inherits global grant down to libraries and shelves', () => {
      const bob = createUser({
        username: 'bob',
        passwordHash: 'hash',
        status: 'active',
      });

      upsertLibraryRecord({ name: 'lib_a', isPublic: false });
      upsertLibraryRecord({ name: 'lib_b', isPublic: false });

      // Before grant: 'none'
      expect(getEffectiveRole(bob, 'library', 'lib_a')).toBe('none');

      // Set global reader grant
      setAccessGrant({
        userId: bob.id,
        resourceType: 'global',
        resourceId: '*',
        role: 'reader',
      });

      expect(getEffectiveRole(bob, 'library', 'lib_a')).toBe('reader');
      expect(getEffectiveRole(bob, 'library', 'lib_b')).toBe('reader');
      expect(getEffectiveRole(bob, 'shelf', 'some-shelf-uuid')).toBe('reader');
      expect(canAccessLibrary(bob, 'lib_a', 'reader')).toBe(true);
      expect(canAccessLibrary(bob, 'lib_a', 'curator')).toBe(false);
    });

    it('allows role elevation on a specific library', () => {
      const alice = createUser({
        username: 'alice',
        passwordHash: 'hash',
        status: 'active',
      });

      upsertLibraryRecord({ name: 'lib_general', isPublic: false });
      upsertLibraryRecord({ name: 'lib_special', isPublic: false });

      // Alice is reader globally
      setAccessGrant({
        userId: alice.id,
        resourceType: 'global',
        resourceId: '*',
        role: 'reader',
      });

      // But curator specifically on lib_special
      setAccessGrant({
        userId: alice.id,
        resourceType: 'library',
        resourceId: 'lib_special',
        role: 'curator',
      });

      expect(getEffectiveRole(alice, 'library', 'lib_general')).toBe('reader');
      expect(getEffectiveRole(alice, 'library', 'lib_special')).toBe('curator');
      expect(canAccessLibrary(alice, 'lib_special', 'curator')).toBe(true);
      expect(canAccessLibrary(alice, 'lib_general', 'curator')).toBe(false);
    });

    it('allows role denial (none on specific library overrides global reader)', () => {
      const charlie = createUser({
        username: 'charlie',
        passwordHash: 'hash',
        status: 'active',
      });

      upsertLibraryRecord({ name: 'public_interest', isPublic: false });
      upsertLibraryRecord({ name: 'restricted', isPublic: false });

      // Charlie has global reader
      setAccessGrant({
        userId: charlie.id,
        resourceType: 'global',
        resourceId: '*',
        role: 'reader',
      });

      // Explicitly blocked on restricted library
      setAccessGrant({
        userId: charlie.id,
        resourceType: 'library',
        resourceId: 'restricted',
        role: 'none',
      });

      expect(getEffectiveRole(charlie, 'library', 'public_interest')).toBe('reader');
      expect(getEffectiveRole(charlie, 'library', 'restricted')).toBe('none');
      expect(canAccessLibrary(charlie, 'public_interest', 'reader')).toBe(true);
      expect(canAccessLibrary(charlie, 'restricted', 'reader')).toBe(false);
    });

    it('cascades down to shelves: shelf grant -> library grant -> global grant', () => {
      const dave = createUser({
        username: 'dave',
        passwordHash: 'hash',
        status: 'active',
      });

      upsertLibraryRecord({ name: 'fantasy', isPublic: false });
      const shelf1 = createShelf({ name: 'Epic Fantasy', isPublic: false, userId: dave.id });
      linkBookToShelf('fantasy', shelf1.id, 101);

      // 1. Initial state: dave has no grants
      expect(getEffectiveRole(dave, 'shelf', shelf1.uuid)).toBe('none');

      // 2. Global grant set to reader -> shelf inherits reader
      setAccessGrant({
        userId: dave.id,
        resourceType: 'global',
        resourceId: '*',
        role: 'reader',
      });
      expect(getEffectiveRole(dave, 'shelf', shelf1.uuid)).toBe('reader');

      // 3. Library grant set to curator -> shelf inherits curator from library
      setAccessGrant({
        userId: dave.id,
        resourceType: 'library',
        resourceId: 'fantasy',
        role: 'curator',
      });
      expect(getEffectiveRole(dave, 'shelf', shelf1.uuid)).toBe('curator');

      // 4. Exact shelf grant overrides parent library grant (e.g. explicit denial)
      setAccessGrant({
        userId: dave.id,
        resourceType: 'shelf',
        resourceId: shelf1.uuid,
        role: 'none',
      });
      expect(getEffectiveRole(dave, 'shelf', shelf1.uuid)).toBe('none');
      expect(canAccessShelf(dave, shelf1.uuid, 'reader')).toBe(false);

      // 5. Exact shelf grant elevates to admin on that shelf
      setAccessGrant({
        userId: dave.id,
        resourceType: 'shelf',
        resourceId: shelf1.uuid,
        role: 'admin',
      });
      expect(getEffectiveRole(dave, 'shelf', shelf1.uuid)).toBe('admin');
      expect(canAccessShelf(dave, shelf1.uuid, 'curator')).toBe(true);
    });

    it('evaluates public fallback for unauthenticated guests and authenticated users', () => {
      upsertLibraryRecord({ name: 'open_lib', isPublic: true });
      upsertLibraryRecord({ name: 'closed_lib', isPublic: false });

      // Unauthenticated guest (null user)
      expect(getEffectiveRole(null, 'library', 'open_lib')).toBe('reader');
      expect(getEffectiveRole(null, 'library', 'closed_lib')).toBe('none');
      expect(canAccessLibrary(null, 'open_lib', 'reader')).toBe(true);
      expect(canAccessLibrary(null, 'open_lib', 'curator')).toBe(false);
      expect(canAccessLibrary(null, 'closed_lib', 'reader')).toBe(false);

      // Authenticated user with no explicit grants
      const guestUser = createUser({
        username: 'guest_user',
        passwordHash: 'hash',
        status: 'active',
      });
      expect(getEffectiveRole(guestUser, 'library', 'open_lib')).toBe('reader');
      expect(getEffectiveRole(guestUser, 'library', 'closed_lib')).toBe('none');
    });

    it('evaluates public fallback for shelves tied to libraries', () => {
      upsertLibraryRecord({ name: 'public_source', isPublic: true });
      upsertLibraryRecord({ name: 'secret_source', isPublic: false });

      // Shelf A: public shelf with books from a public library -> readable by guest
      const shelfA = createShelf({ name: 'Public Shelf A', isPublic: true });
      linkBookToShelf('public_source', shelfA.id, 1);
      expect(getEffectiveRole(null, 'shelf', shelfA.uuid)).toBe('reader');

      // Shelf B: public shelf with books from a private library -> blocked for guest
      const shelfB = createShelf({ name: 'Public Shelf B', isPublic: true });
      linkBookToShelf('secret_source', shelfB.id, 2);
      expect(getEffectiveRole(null, 'shelf', shelfB.uuid)).toBe('none');

      // Shelf C: private shelf -> blocked even if library is public
      const shelfC = createShelf({ name: 'Private Shelf C', isPublic: false });
      linkBookToShelf('public_source', shelfC.id, 3);
      expect(getEffectiveRole(null, 'shelf', shelfC.uuid)).toBe('none');

      // Shelf D: public shelf with no library links -> readable by guest
      const shelfD = createShelf({ name: 'Standalone Shelf D', isPublic: true });
      expect(getEffectiveRole(null, 'shelf', shelfD.uuid)).toBe('reader');
    });

    it('treats suspended and pending users as unauthenticated guests', () => {
      const suspendedUser = createUser({
        username: 'suspended_user',
        passwordHash: 'hash',
        status: 'suspended',
        isAdmin: true, // even if isAdmin flag was set before suspension
      });

      setAccessGrant({
        userId: suspendedUser.id,
        resourceType: 'global',
        resourceId: '*',
        role: 'admin',
      });

      upsertLibraryRecord({ name: 'private_lib', isPublic: false });
      upsertLibraryRecord({ name: 'public_lib', isPublic: true });

      // Suspended user cannot access private library despite grants
      expect(getEffectiveRole(suspendedUser, 'library', 'private_lib')).toBe('none');
      expect(canAccessLibrary(suspendedUser, 'private_lib', 'reader')).toBe(false);

      // Can only read public library as guest fallback
      expect(getEffectiveRole(suspendedUser, 'library', 'public_lib')).toBe('reader');
      expect(canAccessLibrary(suspendedUser, 'public_lib', 'reader')).toBe(true);
      expect(canAccessLibrary(suspendedUser, 'public_lib', 'curator')).toBe(false);
    });
  });

  describe('Library Filtering (filterAccessibleLibraries)', () => {
    it('filters libraries for guests, regular users, and admins', () => {
      const pub1 = upsertLibraryRecord({ name: 'pub1', isPublic: true });
      const pub2 = upsertLibraryRecord({ name: 'pub2', isPublic: true });
      const priv1 = upsertLibraryRecord({ name: 'priv1', isPublic: false });
      const priv2 = upsertLibraryRecord({ name: 'priv2', isPublic: false });

      const allLibs = [pub1, pub2, priv1, priv2];

      // 1. Guest (null user) only sees public libraries
      const guestFiltered = filterAccessibleLibraries(null, allLibs, 'reader');
      expect(guestFiltered.map((l) => l.name)).toEqual(['pub1', 'pub2']);

      // 2. User with grant on priv1 sees public + priv1
      const user = createUser({
        username: 'reader_user',
        passwordHash: 'hash',
        status: 'active',
      });
      setAccessGrant({
        userId: user.id,
        resourceType: 'library',
        resourceId: 'priv1',
        role: 'reader',
      });

      const userFiltered = filterAccessibleLibraries(user, allLibs, 'reader');
      expect(userFiltered.map((l) => l.name).sort()).toEqual(['priv1', 'pub1', 'pub2'].sort());

      // 3. User with explicit denial on pub2 has pub2 excluded
      setAccessGrant({
        userId: user.id,
        resourceType: 'library',
        resourceId: 'pub2',
        role: 'none',
      });
      const userWithDenial = filterAccessibleLibraries(user, allLibs, 'reader');
      expect(userWithDenial.map((l) => l.name).sort()).toEqual(['priv1', 'pub1'].sort());

      // 4. Admin sees all libraries
      const admin = createUser({
        username: 'admin',
        passwordHash: 'hash',
        status: 'active',
        isAdmin: true,
      });
      const adminFiltered = filterAccessibleLibraries(admin, allLibs, 'reader');
      expect(adminFiltered.map((l) => l.name).sort()).toEqual(['priv1', 'priv2', 'pub1', 'pub2'].sort());
    });

    it('allows active users to access public libraries even if not in DB, unless explicitly denied', () => {
      // Libraries not in DB, but with isPublic property on object
      const transientLibs = [
        { name: 'disk_public_lib', isPublic: true },
        { name: 'disk_private_lib', isPublic: false },
      ];

      const user = createUser({
        username: 'active_member',
        passwordHash: 'hash',
        status: 'active',
      });

      // Active user can access disk_public_lib without prior DB upsert
      const userFiltered = filterAccessibleLibraries(user, transientLibs, 'reader');
      expect(userFiltered.map((l) => l.name)).toEqual(['disk_public_lib']);

      // Guest can access disk_public_lib
      const guestFiltered = filterAccessibleLibraries(null, transientLibs, 'reader');
      expect(guestFiltered.map((l) => l.name)).toEqual(['disk_public_lib']);

      // If user receives explicit denial on disk_public_lib, it is excluded
      setAccessGrant({
        userId: user.id,
        resourceType: 'library',
        resourceId: 'disk_public_lib',
        role: 'none',
      });
      const deniedFiltered = filterAccessibleLibraries(user, transientLibs, 'reader');
      expect(deniedFiltered.map((l) => l.name)).toEqual([]);
    });

    it('automatically normalizes global grant resourceId to * in setAccessGrant', () => {
      const user = createUser({
        username: 'global_user',
        passwordHash: 'hash',
        status: 'active',
      });

      // Omit resourceId for global grant
      const grant = setAccessGrant({
        userId: user.id,
        resourceType: 'global',
        role: 'curator',
      });
      expect(grant.resourceId).toBe('*');
      expect(grant.role).toBe('curator');

      // Cascading resolution inherits global curator
      expect(getEffectiveRole(user, 'library', 'random_lib')).toBe('curator');
    });
  });
});
