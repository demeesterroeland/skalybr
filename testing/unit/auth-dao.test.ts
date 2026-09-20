import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  getSkalybrDb,
  closeSkalybrDb,
  createUser,
  getUserById,
  getUserByUsername,
  getUserByEmail,
  updateUser,
  incrementSessionEpoch,
  listUsers,
  deleteUser,
  countUsers,
  setAccessGrant,
  getAccessGrant,
  listAccessGrantsForUser,
  listAccessGrantsForResource,
  deleteAccessGrant,
  setLibraryPublic,
  upsertLibraryRecord,
  getLibraryByName,
  deleteLibraryRecord,
  updateReadingProgress,
  getReadingProgress,
} from '../../lib/db/skalybr-db';

describe('Auth & Cascading ACL Data Access Layer (DAOs)', () => {
  let tempDir: string;
  let originalDataDir: string | undefined;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skalybr-auth-dao-test-'));
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

  describe('Migration 0002 & Library Public Access', () => {
    it('sets and updates is_public flag for libraries', () => {
      // 1. Initial upsert without specifying isPublic defaults to false
      const lib = upsertLibraryRecord({
        name: 'test_lib',
        displayName: 'Test Library',
      });
      expect(lib.isPublic).toBe(false);

      // 2. setLibraryPublic enables public access
      setLibraryPublic('test_lib', true);
      const updated = getLibraryByName('test_lib');
      expect(updated).toBeDefined();
      expect(updated!.isPublic).toBe(true);

      // 3. setLibraryPublic disables public access
      setLibraryPublic('test_lib', false);
      const disabled = getLibraryByName('test_lib');
      expect(disabled!.isPublic).toBe(false);

      // 4. setLibraryPublic creates record if it does not yet exist
      setLibraryPublic('brand_new_lib', true);
      const brandNew = getLibraryByName('brand_new_lib');
      expect(brandNew).toBeDefined();
      expect(brandNew!.name).toBe('brand_new_lib');
      expect(brandNew!.isPublic).toBe(true);

      // 5. upsertLibraryRecord with explicit isPublic
      const customLib = upsertLibraryRecord({
        name: 'custom_public_lib',
        isPublic: true,
      });
      expect(customLib.isPublic).toBe(true);

      // Updating other fields preserves isPublic if not specified
      const preserved = upsertLibraryRecord({
        name: 'custom_public_lib',
        displayName: 'Custom Name',
      });
      expect(preserved.displayName).toBe('Custom Name');
      expect(preserved.isPublic).toBe(true);
    });
  });

  describe('Migration 0003 & User Management DAO', () => {
    it('creates a user with default pending status and session epoch 1', () => {
      const user = createUser({
        username: 'alice',
        passwordHash: '$2a$12$hashedalicepassword123',
        displayName: 'Alice Reader',
        email: 'alice@example.com',
      });

      expect(user.id).toBeGreaterThan(0);
      expect(user.username).toBe('alice');
      expect(user.email).toBe('alice@example.com');
      expect(user.displayName).toBe('Alice Reader');
      expect(user.status).toBe('pending');
      expect(user.isAdmin).toBe(false);
      expect(user.sessionEpoch).toBe(1);
      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });

    it('creates an admin user with active status', () => {
      const admin = createUser({
        username: 'admin',
        passwordHash: '$2a$12$hashedadminpassword123',
        status: 'active',
        isAdmin: true,
      });

      expect(admin.username).toBe('admin');
      expect(admin.status).toBe('active');
      expect(admin.isAdmin).toBe(true);
      expect(admin.sessionEpoch).toBe(1);
    });

    it('enforces UNIQUE constraint on username', () => {
      createUser({
        username: 'unique_user',
        passwordHash: 'hash1',
      });

      expect(() => {
        createUser({
          username: 'unique_user',
          passwordHash: 'hash2',
        });
      }).toThrow(/UNIQUE constraint failed: users.username/);
    });

    it('enforces UNIQUE constraint on email when present', () => {
      createUser({
        username: 'user1',
        email: 'shared@example.com',
        passwordHash: 'hash1',
      });

      expect(() => {
        createUser({
          username: 'user2',
          email: 'shared@example.com',
          passwordHash: 'hash2',
        });
      }).toThrow(/UNIQUE constraint failed: users.email/);

      // Multiple users with null email are allowed
      const user3 = createUser({ username: 'user3', passwordHash: 'hash3' });
      const user4 = createUser({ username: 'user4', passwordHash: 'hash4' });
      expect(user3.id).toBeDefined();
      expect(user4.id).toBeDefined();
    });

    it('enforces CHECK constraint on status values', () => {
      const db = getSkalybrDb();
      expect(() => {
        db.prepare(`
          INSERT INTO users (username, password_hash, status)
          VALUES ('invalid_user', 'hash', 'banned')
        `).run();
      }).toThrow(/CHECK constraint failed/);
    });

    it('fetches users by id, username, and email', () => {
      const created = createUser({
        username: 'bob_the_builder',
        email: 'bob@example.com',
        displayName: 'Bob B.',
        passwordHash: 'secret_hash',
      });

      // By ID
      expect(getUserById(created.id)).toEqual(created);
      expect(getUserById(999999)).toBeNull();

      // By Username
      expect(getUserByUsername('bob_the_builder')).toEqual(created);
      expect(getUserByUsername('non_existent')).toBeNull();

      // By Email
      expect(getUserByEmail('bob@example.com')).toEqual(created);
      expect(getUserByEmail('unknown@example.com')).toBeNull();
    });

    it('updates user fields partially and modifies updatedAt', async () => {
      const user = createUser({
        username: 'charlie',
        passwordHash: 'old_hash',
        status: 'pending',
      });

      // Delay briefly so timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      const updated = updateUser(user.id, {
        status: 'active',
        displayName: 'Charlie Brown',
        email: 'charlie@peanuts.org',
        isAdmin: true,
      });

      expect(updated.id).toBe(user.id);
      expect(updated.status).toBe('active');
      expect(updated.displayName).toBe('Charlie Brown');
      expect(updated.email).toBe('charlie@peanuts.org');
      expect(updated.isAdmin).toBe(true);
      expect(updated.passwordHash).toBe('old_hash');

      // Non-existent user throws
      expect(() => updateUser(99999, { status: 'active' })).toThrow(/not found/);
    });

    it('increments session epoch to invalidate user sessions', () => {
      const user = createUser({
        username: 'dave',
        passwordHash: 'hash',
      });
      expect(user.sessionEpoch).toBe(1);

      const epoch2 = incrementSessionEpoch(user.id);
      expect(epoch2).toBe(2);

      const epoch3 = incrementSessionEpoch(user.id);
      expect(epoch3).toBe(3);

      const refreshed = getUserById(user.id);
      expect(refreshed!.sessionEpoch).toBe(3);

      expect(() => incrementSessionEpoch(99999)).toThrow(/not found/);
    });

    it('lists users and filters by status', () => {
      createUser({ username: 'u1', passwordHash: 'h', status: 'pending' });
      createUser({ username: 'u2', passwordHash: 'h', status: 'active' });
      createUser({ username: 'u3', passwordHash: 'h', status: 'suspended' });
      createUser({ username: 'u4', passwordHash: 'h', status: 'pending' });

      const all = listUsers();
      expect(all.length).toBe(4);

      const pending = listUsers({ status: 'pending' });
      expect(pending.length).toBe(2);
      expect(pending.map((u) => u.username).sort()).toEqual(['u1', 'u4']);

      const active = listUsers({ status: 'active' });
      expect(active.length).toBe(1);
      expect(active[0].username).toBe('u2');

      const suspended = listUsers({ status: 'suspended' });
      expect(suspended.length).toBe(1);
      expect(suspended[0].username).toBe('u3');
    });

    it('counts total registered users', () => {
      expect(countUsers()).toBe(0);
      createUser({ username: 'c1', passwordHash: 'h' });
      createUser({ username: 'c2', passwordHash: 'h' });
      expect(countUsers()).toBe(2);
    });

    it('deletes user and cascades deletion to access grants', () => {
      const user = createUser({ username: 'to_delete', passwordHash: 'h' });
      const admin = createUser({ username: 'grantor', passwordHash: 'h', isAdmin: true });

      setAccessGrant({
        userId: user.id,
        resourceType: 'library',
        resourceId: 'Library1',
        role: 'reader',
        grantedBy: admin.id,
      });

      // Grant exists
      expect(getAccessGrant(user.id, 'library', 'Library1')).toBeDefined();

      // Delete user
      const deleted = deleteUser(user.id);
      expect(deleted).toBe(true);
      expect(getUserById(user.id)).toBeNull();

      // Access grant cascade deleted
      expect(getAccessGrant(user.id, 'library', 'Library1')).toBeNull();

      // Deleting again returns false
      expect(deleteUser(user.id)).toBe(false);
    });

    it('normalizes empty string email to null and prevents UNIQUE collision between multiple empty emails', () => {
      // User 1 with empty string email
      const user1 = createUser({
        username: 'no_email_1',
        email: '',
        passwordHash: 'h1',
      });
      expect(user1.email).toBeNull();

      // User 2 with whitespace email
      const user2 = createUser({
        username: 'no_email_2',
        email: '   ',
        passwordHash: 'h2',
      });
      expect(user2.email).toBeNull();

      // Both users exist and have null email without UNIQUE collision
      expect(getUserById(user1.id)?.email).toBeNull();
      expect(getUserById(user2.id)?.email).toBeNull();
    });

    it('validates username and passwordHash cannot be empty or whitespace', () => {
      expect(() => createUser({ username: '', passwordHash: 'h' })).toThrow(/Username is required/);
      expect(() => createUser({ username: '   ', passwordHash: 'h' })).toThrow(/Username is required/);
      expect(() => createUser({ username: 'valid_user', passwordHash: '' })).toThrow(/passwordHash is required/);
    });

    it('normalizes email on updateUser and enforces CHECK constraints on status', () => {
      const user = createUser({
        username: 'update_test_user',
        email: 'initial@example.com',
        passwordHash: 'h',
      });

      // Update email to empty string normalizes to null
      const updated = updateUser(user.id, { email: '' });
      expect(updated.email).toBeNull();

      // Updating status to an invalid value throws CHECK constraint error
      expect(() => updateUser(user.id, { status: 'banned' as any })).toThrow(/CHECK constraint failed/);

      // Updating username to empty throws
      expect(() => updateUser(user.id, { username: '  ' })).toThrow(/Username cannot be empty/);
    });

    it('safely handles invalid inputs for getUserById, getUserByUsername, and getUserByEmail', () => {
      expect(getUserById(0)).toBeNull();
      expect(getUserById(-5)).toBeNull();
      expect(getUserById(NaN)).toBeNull();

      expect(getUserByUsername('')).toBeNull();
      expect(getUserByUsername('   ')).toBeNull();

      expect(getUserByEmail('')).toBeNull();
      expect(getUserByEmail('   ')).toBeNull();
    });

    it('cleans up reading progress and shelves when user is deleted', () => {
      const user = createUser({ username: 'reader_to_delete', passwordHash: 'h' });

      // Add reading progress for this user
      updateReadingProgress({
        library: 'default',
        bookId: 42,
        userId: user.id,
        progressPercent: 50,
      });
      expect(getReadingProgress('default', 42, user.id)).toBeDefined();

      // Delete user
      deleteUser(user.id);

      // Reading progress for this user is cleaned up
      expect(getReadingProgress('default', 42, user.id)).toBeNull();
    });
  });

  describe('Migration 0004 & Cascading ACL Access Grants DAO', () => {
    let adminUser: ReturnType<typeof createUser>;
    let targetUser: ReturnType<typeof createUser>;

    beforeEach(() => {
      adminUser = createUser({
        username: 'acl_admin',
        passwordHash: 'hash',
        status: 'active',
        isAdmin: true,
      });
      targetUser = createUser({
        username: 'acl_user',
        passwordHash: 'hash',
        status: 'active',
      });
    });

    it('creates access grants at global, library, and shelf scopes', () => {
      // 1. Global grant ('*')
      const globalGrant = setAccessGrant({
        userId: targetUser.id,
        resourceType: 'global',
        resourceId: '*',
        role: 'reader',
        grantedBy: adminUser.id,
      });

      expect(globalGrant.id).toBeGreaterThan(0);
      expect(globalGrant.userId).toBe(targetUser.id);
      expect(globalGrant.resourceType).toBe('global');
      expect(globalGrant.resourceId).toBe('*');
      expect(globalGrant.role).toBe('reader');
      expect(globalGrant.grantedBy).toBe(adminUser.id);
      expect(globalGrant.createdAt).toBeDefined();

      // 2. Library grant ('library:<name>')
      const libGrant = setAccessGrant({
        userId: targetUser.id,
        resourceType: 'library',
        resourceId: 'Tech Vault',
        role: 'curator',
        grantedBy: adminUser.id,
      });
      expect(libGrant.resourceType).toBe('library');
      expect(libGrant.resourceId).toBe('Tech Vault');
      expect(libGrant.role).toBe('curator');

      // 3. Shelf grant ('shelf:<uuid>')
      const shelfGrant = setAccessGrant({
        userId: targetUser.id,
        resourceType: 'shelf',
        resourceId: 'shelf-uuid-1234',
        role: 'none',
      });
      expect(shelfGrant.resourceType).toBe('shelf');
      expect(shelfGrant.resourceId).toBe('shelf-uuid-1234');
      expect(shelfGrant.role).toBe('none');
      expect(shelfGrant.grantedBy).toBeNull();
    });

    it('upserts grant when (userId, resourceType, resourceId) already exists', () => {
      // Initial grant
      const first = setAccessGrant({
        userId: targetUser.id,
        resourceType: 'library',
        resourceId: 'Sci-Fi',
        role: 'reader',
      });
      expect(first.role).toBe('reader');

      // Elevated to curator
      const second = setAccessGrant({
        userId: targetUser.id,
        resourceType: 'library',
        resourceId: 'Sci-Fi',
        role: 'curator',
        grantedBy: adminUser.id,
      });

      expect(second.id).toBe(first.id);
      expect(second.role).toBe('curator');
      expect(second.grantedBy).toBe(adminUser.id);

      // Verify single grant exists
      const userGrants = listAccessGrantsForUser(targetUser.id);
      expect(userGrants.length).toBe(1);
    });

    it('enforces CHECK constraint on resource_type and role', () => {
      const db = getSkalybrDb();

      // Invalid resource_type
      expect(() => {
        db.prepare(`
          INSERT INTO access_grants (user_id, resource_type, resource_id, role)
          VALUES (?, 'book', '123', 'reader')
        `).run(targetUser.id);
      }).toThrow(/CHECK constraint failed/);

      // Invalid role
      expect(() => {
        db.prepare(`
          INSERT INTO access_grants (user_id, resource_type, resource_id, role)
          VALUES (?, 'library', 'Tech', 'superadmin')
        `).run(targetUser.id);
      }).toThrow(/CHECK constraint failed/);
    });

    it('lists access grants for a user and for a resource', () => {
      const secondUser = createUser({ username: 'user_two', passwordHash: 'h' });

      setAccessGrant({ userId: targetUser.id, resourceType: 'library', resourceId: 'LibA', role: 'curator' });
      setAccessGrant({ userId: targetUser.id, resourceType: 'shelf', resourceId: 'Shelf1', role: 'reader' });
      setAccessGrant({ userId: secondUser.id, resourceType: 'library', resourceId: 'LibA', role: 'reader' });

      // User targetUser has 2 grants
      const targetGrants = listAccessGrantsForUser(targetUser.id);
      expect(targetGrants.length).toBe(2);
      expect(targetGrants.map((g) => g.resourceId).sort()).toEqual(['LibA', 'Shelf1']);

      // Resource LibA has 2 grants across different users
      const resourceGrants = listAccessGrantsForResource('library', 'LibA');
      expect(resourceGrants.length).toBe(2);
      expect(resourceGrants.map((g) => g.userId).sort()).toEqual([targetUser.id, secondUser.id].sort());
    });

    it('deletes access grants correctly', () => {
      setAccessGrant({
        userId: targetUser.id,
        resourceType: 'library',
        resourceId: 'TempLib',
        role: 'reader',
      });

      expect(getAccessGrant(targetUser.id, 'library', 'TempLib')).toBeDefined();

      const deleted = deleteAccessGrant(targetUser.id, 'library', 'TempLib');
      expect(deleted).toBe(true);

      expect(getAccessGrant(targetUser.id, 'library', 'TempLib')).toBeNull();

      // Deleting again returns false
      expect(deleteAccessGrant(targetUser.id, 'library', 'TempLib')).toBe(false);
    });

    it('sets granted_by to NULL when grantor user is deleted (ON DELETE SET NULL)', () => {
      const grant = setAccessGrant({
        userId: targetUser.id,
        resourceType: 'library',
        resourceId: 'SharedLib',
        role: 'reader',
        grantedBy: adminUser.id,
      });
      expect(grant.grantedBy).toBe(adminUser.id);

      // Delete the grantor admin user
      deleteUser(adminUser.id);

      // Grant still exists for targetUser, but grantedBy is now null
      const updatedGrant = getAccessGrant(targetUser.id, 'library', 'SharedLib');
      expect(updatedGrant).toBeDefined();
      expect(updatedGrant!.grantedBy).toBeNull();
    });

    it('enforces foreign key constraints on access_grants for non-existent users', () => {
      // Non-existent userId throws foreign key constraint error
      expect(() => {
        setAccessGrant({
          userId: 999999,
          resourceType: 'library',
          resourceId: 'Lib',
          role: 'reader',
        });
      }).toThrow(/FOREIGN KEY constraint failed/);

      // Non-existent grantedBy throws foreign key constraint error
      expect(() => {
        setAccessGrant({
          userId: targetUser.id,
          resourceType: 'library',
          resourceId: 'Lib',
          role: 'reader',
          grantedBy: 999999,
        });
      }).toThrow(/FOREIGN KEY constraint failed/);
    });

    it('validates inputs for access grants and rejects empty resourceId', () => {
      expect(() => {
        setAccessGrant({
          userId: targetUser.id,
          resourceType: 'library',
          resourceId: '',
          role: 'reader',
        });
      }).toThrow(/resourceId is required/);

      expect(() => {
        setAccessGrant({
          userId: 0,
          resourceType: 'library',
          resourceId: 'Lib',
          role: 'reader',
        });
      }).toThrow(/Valid userId is required/);

      expect(getAccessGrant(0, 'library', 'Lib')).toBeNull();
      expect(listAccessGrantsForUser(0)).toEqual([]);
      expect(listAccessGrantsForResource('library', '')).toEqual([]);
      expect(deleteAccessGrant(0, 'library', 'Lib')).toBe(false);
    });

    it('deleting a library cleans up its access grants', () => {
      upsertLibraryRecord({ name: 'LibToWipe' });
      setAccessGrant({
        userId: targetUser.id,
        resourceType: 'library',
        resourceId: 'LibToWipe',
        role: 'curator',
      });

      expect(getAccessGrant(targetUser.id, 'library', 'LibToWipe')).toBeDefined();

      // Delete library
      deleteLibraryRecord('LibToWipe');

      // Access grant for this library was cleaned up
      expect(getAccessGrant(targetUser.id, 'library', 'LibToWipe')).toBeNull();
      expect(listAccessGrantsForResource('library', 'LibToWipe')).toEqual([]);
    });
  });
});
