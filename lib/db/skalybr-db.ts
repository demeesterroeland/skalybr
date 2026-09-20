import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  LibraryRecord,
  ReadingProgressRecord,
  ReadingProgressInput,
  ReadingStatus,
  ShelfRecord,
  BookShelfRecord,
  SmartShelfRecord,
  UserRecord,
  UserStatus,
  AclRole,
  ResourceType,
  AccessGrantRecord,
} from '../types';

import { runMigrations } from './migrate';

let dbInstance: Database.Database | null = null;

export function getDataDir(): string {
  const dir = process.env.DATA_DIR || path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getSkalybrDbPath(): string {
  return path.join(getDataDir(), 'skalybr.db');
}

/**
 * Initializes and returns the central skalybr.db SQLite connection
 */
export function getSkalybrDb(): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = getSkalybrDbPath();
  const db = new Database(dbPath, { timeout: 5000 });

  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');
  db.pragma('foreign_keys = ON');

  runMigrations(db);
  migrateLegacyLibrariesJson(db);

  dbInstance = db;
  return db;
}

export function closeSkalybrDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

function migrateLegacyLibrariesJson(db: Database.Database): void {
  // Check and migrate existing .skalybr-libraries.json if present
  try {
    const legacyPath = path.join(process.cwd(), '.skalybr-libraries.json');
    if (fs.existsSync(legacyPath)) {
      const content = fs.readFileSync(legacyPath, 'utf-8');
      const legacyData = JSON.parse(content);
      const customNames: Record<string, string> = legacyData.customNames || {};
      const hiddenLibs: string[] = legacyData.hiddenLibraries || [];

      const insertStmt = db.prepare(`
        INSERT INTO libraries (name, display_name, is_hidden)
        VALUES (?, ?, ?)
        ON CONFLICT(name) DO UPDATE SET
          display_name = COALESCE(excluded.display_name, libraries.display_name),
          is_hidden = excluded.is_hidden,
          updated_at = CURRENT_TIMESTAMP
      `);

      const tx = db.transaction(() => {
        const allKeys = new Set([...Object.keys(customNames), ...hiddenLibs]);
        for (const key of allKeys) {
          const displayName = customNames[key] || null;
          const isHidden = hiddenLibs.includes(key) ? 1 : 0;
          insertStmt.run(key, displayName, isHidden);
        }
      });
      tx();

      // Rename to .bak to avoid re-importing
      fs.renameSync(legacyPath, `${legacyPath}.bak`);
      console.log('Successfully migrated .skalybr-libraries.json to skalybr.db');
    }
  } catch (err) {
    console.error('Error during legacy library settings migration:', err);
  }
}

// ---------------------------------------------------------------------------
// Library DAO
// ---------------------------------------------------------------------------

function rowToLibraryRecord(row: any): LibraryRecord {
  return {
    id: row.id,
    name: row.name,
    displayName: row.display_name,
    path: row.path,
    isHidden: Boolean(row.is_hidden),
    isDefault: Boolean(row.is_default),
    isPublic: Boolean(row.is_public),
    avatarImage: row.avatar_image,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllLibraries(includeHidden: boolean = false): LibraryRecord[] {
  const db = getSkalybrDb();
  const sql = includeHidden
    ? 'SELECT * FROM libraries ORDER BY is_default DESC, name ASC'
    : 'SELECT * FROM libraries WHERE is_hidden = 0 ORDER BY is_default DESC, name ASC';
  const rows = db.prepare(sql).all();
  return rows.map(rowToLibraryRecord);
}

export function getLibraryByName(name: string): LibraryRecord | null {
  const db = getSkalybrDb();
  const row = db.prepare('SELECT * FROM libraries WHERE name = ?').get(name);
  return row ? rowToLibraryRecord(row) : null;
}

export function upsertLibraryRecord(data: {
  name: string;
  displayName?: string | null;
  path?: string | null;
  isHidden?: boolean;
  isDefault?: boolean;
  isPublic?: boolean;
  avatarImage?: string | null;
}): LibraryRecord {
  const db = getSkalybrDb();

  const existing = getLibraryByName(data.name);

  if (existing) {
    const isHiddenVal = data.isHidden !== undefined ? (data.isHidden ? 1 : 0) : existing.isHidden ? 1 : 0;
    const isDefaultVal = data.isDefault !== undefined ? (data.isDefault ? 1 : 0) : existing.isDefault ? 1 : 0;
    const isPublicVal = data.isPublic !== undefined ? (data.isPublic ? 1 : 0) : existing.isPublic ? 1 : 0;
    const displayNameVal = data.displayName !== undefined ? data.displayName : existing.displayName;
    const pathVal = data.path !== undefined ? data.path : existing.path;
    const avatarVal = data.avatarImage !== undefined ? data.avatarImage : existing.avatarImage;

    if (data.isDefault) {
      db.prepare('UPDATE libraries SET is_default = 0').run();
    }

    db.prepare(`
      UPDATE libraries SET
        display_name = ?,
        path = ?,
        is_hidden = ?,
        is_default = ?,
        is_public = ?,
        avatar_image = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `).run(displayNameVal, pathVal, isHiddenVal, isDefaultVal, isPublicVal, avatarVal, data.name);
  } else {
    if (data.isDefault) {
      db.prepare('UPDATE libraries SET is_default = 0').run();
    }

    db.prepare(`
      INSERT INTO libraries (name, display_name, path, is_hidden, is_default, is_public, avatar_image)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.name,
      data.displayName ?? null,
      data.path ?? null,
      data.isHidden ? 1 : 0,
      data.isDefault ? 1 : 0,
      data.isPublic ? 1 : 0,
      data.avatarImage ?? null
    );
  }

  return getLibraryByName(data.name)!;
}

export function setLibraryPublic(name: string, isPublic: boolean): void {
  const db = getSkalybrDb();
  db.prepare(`
    INSERT INTO libraries (name, is_public, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(name) DO UPDATE SET
      is_public = excluded.is_public,
      updated_at = CURRENT_TIMESTAMP
  `).run(name, isPublic ? 1 : 0);
}

export function setDefaultLibraryRecord(name: string): void {
  const db = getSkalybrDb();
  const tx = db.transaction(() => {
    db.prepare('UPDATE libraries SET is_default = 0').run();
    const result = db.prepare('UPDATE libraries SET is_default = 1 WHERE name = ?').run(name);
    if (result.changes === 0) {
      // Library record not yet created, create it as default
      db.prepare('INSERT INTO libraries (name, is_default) VALUES (?, 1)').run(name);
    }
  });
  tx();
}

export function getDefaultLibraryRecord(): LibraryRecord | null {
  const db = getSkalybrDb();
  const row = db.prepare('SELECT * FROM libraries WHERE is_default = 1 LIMIT 1').get();
  return row ? rowToLibraryRecord(row) : null;
}

export function deleteLibraryRecord(name: string): boolean {
  const db = getSkalybrDb();
  let wasDefault = false;
  const existing = getLibraryByName(name);
  if (existing?.isDefault) {
    wasDefault = true;
  }

  const tx = db.transaction(() => {
    const res = db.prepare('DELETE FROM libraries WHERE name = ?').run(name);

    // Clean up associated reading progress, shelf links, and access grants for this library
    db.prepare('DELETE FROM reading_progress WHERE library = ?').run(name);
    db.prepare('DELETE FROM book_shelf_link WHERE library = ?').run(name);
    db.prepare("DELETE FROM access_grants WHERE resource_type = 'library' AND resource_id = ?").run(name);

    // If deleted library was the active default, promote the first remaining non-hidden library
    if (wasDefault) {
      const nextDefault = db
        .prepare('SELECT name FROM libraries WHERE is_hidden = 0 ORDER BY id ASC LIMIT 1')
        .get() as { name: string } | undefined;
      if (nextDefault) {
        db.prepare('UPDATE libraries SET is_default = 1 WHERE name = ?').run(nextDefault.name);
      }
    }

    return res.changes > 0;
  });

  return tx();
}

// ---------------------------------------------------------------------------
// Reading Progress DAO
// ---------------------------------------------------------------------------

function rowToReadingProgress(row: any): ReadingProgressRecord {
  return {
    id: row.id,
    library: row.library,
    bookId: row.book_id,
    userId: row.user_id,
    status: row.status as ReadingStatus,
    progressPercent: row.progress_percent,
    currentPage: row.current_page,
    totalPages: row.total_pages,
    format: row.format,
    locator: row.locator,
    timeSpentSeconds: row.time_spent_seconds,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    lastReadAt: row.last_read_at,
  };
}

export function getReadingProgress(
  library: string,
  bookId: number,
  userId: number = 1
): ReadingProgressRecord | null {
  const db = getSkalybrDb();
  const row = db.prepare(`
    SELECT * FROM reading_progress
    WHERE library = ? AND book_id = ? AND user_id = ?
  `).get(library, bookId, userId);
  return row ? rowToReadingProgress(row) : null;
}

export function updateReadingProgress(input: ReadingProgressInput): ReadingProgressRecord {
  const db = getSkalybrDb();
  const userId = input.userId ?? 1;
  const existing = getReadingProgress(input.library, input.bookId, userId);

  const now = new Date().toISOString();
  let status: ReadingStatus = input.status || (existing ? existing.status : 'unread');
  const percent = input.progressPercent !== undefined ? input.progressPercent : existing?.progressPercent ?? 0.0;

  // Auto transition to finished if percent >= 100
  if (percent >= 100 && status !== 'finished') {
    status = 'finished';
  } else if (percent > 0 && percent < 100 && status === 'unread') {
    status = 'reading';
  }

  let startedAt = existing?.startedAt ?? null;
  if (!startedAt && (status === 'reading' || percent > 0)) {
    startedAt = now;
  }

  let finishedAt = existing?.finishedAt ?? null;
  if (status === 'finished' && !finishedAt) {
    finishedAt = now;
  }

  const currentPage = input.currentPage !== undefined ? input.currentPage : existing?.currentPage ?? null;
  const totalPages = input.totalPages !== undefined ? input.totalPages : existing?.totalPages ?? null;
  const format = input.format !== undefined ? input.format : existing?.format ?? null;
  const locator = input.locator !== undefined ? input.locator : existing?.locator ?? null;
  const timeSpent = (existing?.timeSpentSeconds ?? 0) + (input.timeSpentSeconds ?? 0);

  db.prepare(`
    INSERT INTO reading_progress (
      library, book_id, user_id, status, progress_percent,
      current_page, total_pages, format, locator,
      time_spent_seconds, started_at, finished_at, last_read_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(library, book_id, user_id) DO UPDATE SET
      status = excluded.status,
      progress_percent = excluded.progress_percent,
      current_page = excluded.current_page,
      total_pages = excluded.total_pages,
      format = COALESCE(excluded.format, reading_progress.format),
      locator = COALESCE(excluded.locator, reading_progress.locator),
      time_spent_seconds = excluded.time_spent_seconds,
      started_at = COALESCE(reading_progress.started_at, excluded.started_at),
      finished_at = excluded.finished_at,
      last_read_at = CURRENT_TIMESTAMP
  `).run(
    input.library,
    input.bookId,
    userId,
    status,
    percent,
    currentPage,
    totalPages,
    format,
    locator,
    timeSpent,
    startedAt,
    finishedAt
  );

  return getReadingProgress(input.library, input.bookId, userId)!;
}

// ---------------------------------------------------------------------------
// Settings DAO (Generic Key-Value)
// ---------------------------------------------------------------------------

export function getAppSetting(key: string): string | null {
  const db = getSkalybrDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row ? row.value : null;
}

export function setAppSetting(key: string, value: string): void {
  const db = getSkalybrDb();
  db.prepare(`
    INSERT INTO settings (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = CURRENT_TIMESTAMP
  `).run(key, value);
}

// ---------------------------------------------------------------------------
// User Management DAO
// ---------------------------------------------------------------------------

function rowToUserRecord(row: any): UserRecord {
  return {
    id: row.id,
    username: row.username,
    email: row.email ?? null,
    passwordHash: row.password_hash,
    displayName: row.display_name ?? null,
    status: row.status as UserStatus,
    isAdmin: Boolean(row.is_admin),
    sessionEpoch: row.session_epoch,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createUser(input: {
  username: string;
  email?: string | null;
  passwordHash: string;
  displayName?: string | null;
  status?: UserStatus;
  isAdmin?: boolean;
}): UserRecord {
  const username = input.username?.trim();
  if (!username) {
    throw new Error('Username is required and cannot be empty');
  }
  if (!input.passwordHash) {
    throw new Error('passwordHash is required and cannot be empty');
  }

  const db = getSkalybrDb();
  const status: UserStatus = input.status || 'pending';
  const isAdmin = input.isAdmin ? 1 : 0;
  const email = input.email && input.email.trim() !== '' ? input.email.trim() : null;
  const displayName = input.displayName && input.displayName.trim() !== '' ? input.displayName.trim() : null;

  const row = db.prepare(`
    INSERT INTO users (username, email, password_hash, display_name, status, is_admin, session_epoch)
    VALUES (?, ?, ?, ?, ?, ?, 1)
    RETURNING *
  `).get(username, email, input.passwordHash, displayName, status, isAdmin);

  return rowToUserRecord(row);
}

export function getUserById(id: number): UserRecord | null {
  if (!id || typeof id !== 'number' || id <= 0 || !Number.isInteger(id)) {
    return null;
  }
  const db = getSkalybrDb();
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  return row ? rowToUserRecord(row) : null;
}

export function getUserByUsername(username: string): UserRecord | null {
  if (!username || !username.trim()) {
    return null;
  }
  const db = getSkalybrDb();
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username.trim());
  return row ? rowToUserRecord(row) : null;
}

export function getUserByEmail(email: string): UserRecord | null {
  if (!email || !email.trim()) {
    return null;
  }
  const db = getSkalybrDb();
  const row = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim());
  return row ? rowToUserRecord(row) : null;
}

export function updateUser(id: number, data: Partial<UserRecord>): UserRecord {
  if (!id || typeof id !== 'number' || id <= 0 || !Number.isInteger(id)) {
    throw new Error(`User with id ${id} not found`);
  }
  const db = getSkalybrDb();

  const updates: string[] = [];
  const params: any[] = [];

  if (data.username !== undefined) {
    const trimmedUsername = data.username.trim();
    if (!trimmedUsername) {
      throw new Error('Username cannot be empty');
    }
    updates.push('username = ?');
    params.push(trimmedUsername);
  }
  if (data.email !== undefined) {
    updates.push('email = ?');
    params.push(data.email && data.email.trim() !== '' ? data.email.trim() : null);
  }
  if (data.passwordHash !== undefined) {
    if (!data.passwordHash) {
      throw new Error('passwordHash cannot be empty');
    }
    updates.push('password_hash = ?');
    params.push(data.passwordHash);
  }
  if (data.displayName !== undefined) {
    updates.push('display_name = ?');
    params.push(data.displayName && data.displayName.trim() !== '' ? data.displayName.trim() : null);
  }
  if (data.status !== undefined) {
    updates.push('status = ?');
    params.push(data.status);
  }
  if (data.isAdmin !== undefined) {
    updates.push('is_admin = ?');
    params.push(data.isAdmin ? 1 : 0);
  }
  if (data.sessionEpoch !== undefined) {
    updates.push('session_epoch = ?');
    params.push(data.sessionEpoch);
  }

  updates.push('updated_at = CURRENT_TIMESTAMP');
  params.push(id);

  const row = db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ? RETURNING *`).get(...params);
  if (!row) {
    throw new Error(`User with id ${id} not found`);
  }

  return rowToUserRecord(row);
}

export function incrementSessionEpoch(userId: number): number {
  if (!userId || typeof userId !== 'number' || userId <= 0 || !Number.isInteger(userId)) {
    throw new Error(`User with id ${userId} not found`);
  }
  const db = getSkalybrDb();
  const row = db.prepare(`
    UPDATE users SET
      session_epoch = session_epoch + 1,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    RETURNING session_epoch
  `).get(userId) as { session_epoch: number } | undefined;

  if (!row) {
    throw new Error(`User with id ${userId} not found`);
  }

  return row.session_epoch;
}

export function listUsers(filter?: { status?: UserStatus }): UserRecord[] {
  const db = getSkalybrDb();
  if (filter?.status) {
    const rows = db.prepare('SELECT * FROM users WHERE status = ? ORDER BY id ASC').all(filter.status);
    return rows.map(rowToUserRecord);
  }
  const rows = db.prepare('SELECT * FROM users ORDER BY id ASC').all();
  return rows.map(rowToUserRecord);
}

export function deleteUser(id: number): boolean {
  if (!id || typeof id !== 'number' || id <= 0 || !Number.isInteger(id)) {
    return false;
  }
  const db = getSkalybrDb();
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM reading_progress WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM smart_shelves WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM book_shelf_link WHERE shelf_id IN (SELECT id FROM shelves WHERE user_id = ?)').run(id);
    db.prepare('DELETE FROM shelves WHERE user_id = ?').run(id);
    const res = db.prepare('DELETE FROM users WHERE id = ?').run(id);
    return res.changes > 0;
  });
  return tx();
}

export function countUsers(): number {
  const db = getSkalybrDb();
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number } | undefined;
  return row?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Cascading ACL Access Grants DAO
// ---------------------------------------------------------------------------

function rowToAccessGrantRecord(row: any): AccessGrantRecord {
  return {
    id: row.id,
    userId: row.user_id,
    resourceType: row.resource_type as ResourceType,
    resourceId: row.resource_id,
    role: row.role as AclRole,
    grantedBy: row.granted_by ?? null,
    createdAt: row.created_at,
  };
}

export function setAccessGrant(grant: {
  userId: number;
  resourceType: ResourceType;
  resourceId: string;
  role: AclRole;
  grantedBy?: number | null;
}): AccessGrantRecord {
  if (!grant.userId || typeof grant.userId !== 'number' || grant.userId <= 0) {
    throw new Error('Valid userId is required');
  }
  const resourceId = grant.resourceId?.trim();
  if (!resourceId) {
    throw new Error('resourceId is required and cannot be empty');
  }

  const db = getSkalybrDb();
  const grantedBy = grant.grantedBy ?? null;

  const row = db.prepare(`
    INSERT INTO access_grants (user_id, resource_type, resource_id, role, granted_by, created_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, resource_type, resource_id) DO UPDATE SET
      role = excluded.role,
      granted_by = excluded.granted_by,
      created_at = CURRENT_TIMESTAMP
    RETURNING *
  `).get(grant.userId, grant.resourceType, resourceId, grant.role, grantedBy);

  return rowToAccessGrantRecord(row);
}

export function getAccessGrant(
  userId: number,
  resourceType: ResourceType,
  resourceId: string
): AccessGrantRecord | null {
  if (!userId || typeof userId !== 'number' || userId <= 0 || !resourceType || !resourceId) {
    return null;
  }
  const db = getSkalybrDb();
  const row = db.prepare(`
    SELECT * FROM access_grants
    WHERE user_id = ? AND resource_type = ? AND resource_id = ?
  `).get(userId, resourceType, resourceId);
  return row ? rowToAccessGrantRecord(row) : null;
}

export function listAccessGrantsForUser(userId: number): AccessGrantRecord[] {
  if (!userId || typeof userId !== 'number' || userId <= 0) {
    return [];
  }
  const db = getSkalybrDb();
  const rows = db.prepare(`
    SELECT * FROM access_grants
    WHERE user_id = ?
    ORDER BY id ASC
  `).all(userId);
  return rows.map(rowToAccessGrantRecord);
}

export function listAccessGrantsForResource(
  resourceType: ResourceType,
  resourceId: string
): AccessGrantRecord[] {
  if (!resourceType || !resourceId) {
    return [];
  }
  const db = getSkalybrDb();
  const rows = db.prepare(`
    SELECT * FROM access_grants
    WHERE resource_type = ? AND resource_id = ?
    ORDER BY id ASC
  `).all(resourceType, resourceId);
  return rows.map(rowToAccessGrantRecord);
}

export function deleteAccessGrant(
  userId: number,
  resourceType: ResourceType,
  resourceId: string
): boolean {
  if (!userId || typeof userId !== 'number' || userId <= 0 || !resourceType || !resourceId) {
    return false;
  }
  const db = getSkalybrDb();
  const res = db.prepare(`
    DELETE FROM access_grants
    WHERE user_id = ? AND resource_type = ? AND resource_id = ?
  `).run(userId, resourceType, resourceId);
  return res.changes > 0;
}

