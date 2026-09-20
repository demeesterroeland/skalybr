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
} from '../types';

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

  initSchema(db);
  runMigrations(db);

  dbInstance = db;
  return db;
}

function initSchema(db: Database.Database): void {
  db.exec(`
    -- Libraries Registry
    CREATE TABLE IF NOT EXISTS libraries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      display_name TEXT,
      path TEXT,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      is_default INTEGER NOT NULL DEFAULT 0,
      avatar_image TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_libraries_name ON libraries(name);
    CREATE INDEX IF NOT EXISTS idx_libraries_is_default ON libraries(is_default);

    -- Unified Reading Progress
    CREATE TABLE IF NOT EXISTS reading_progress (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      library TEXT NOT NULL,
      book_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'unread',
      progress_percent REAL NOT NULL DEFAULT 0.0,
      current_page INTEGER,
      total_pages INTEGER,
      format TEXT,
      locator TEXT,
      time_spent_seconds INTEGER NOT NULL DEFAULT 0,
      started_at DATETIME,
      finished_at DATETIME,
      last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(library, book_id, user_id)
    );

    CREATE INDEX IF NOT EXISTS idx_reading_progress_lookup ON reading_progress(library, book_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_reading_progress_status ON reading_progress(status);

    -- Virtual Shelves (Collections)
    CREATE TABLE IF NOT EXISTS shelves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      user_id INTEGER NOT NULL DEFAULT 1,
      is_public INTEGER NOT NULL DEFAULT 1,
      kobo_sync INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Book to Shelf link
    CREATE TABLE IF NOT EXISTS book_shelf_link (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      library TEXT NOT NULL,
      shelf_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 0,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(shelf_id) REFERENCES shelves(id) ON DELETE CASCADE,
      UNIQUE(library, shelf_id, book_id)
    );

    -- Smart Shelves (Dynamic Filter Queries)
    CREATE TABLE IF NOT EXISTS smart_shelves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      uuid TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      library TEXT NOT NULL,
      filter_json TEXT NOT NULL,
      user_id INTEGER NOT NULL DEFAULT 1,
      is_public INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Application Settings key-value
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function runMigrations(db: Database.Database): void {
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
  avatarImage?: string | null;
}): LibraryRecord {
  const db = getSkalybrDb();

  const existing = getLibraryByName(data.name);

  if (existing) {
    const isHiddenVal = data.isHidden !== undefined ? (data.isHidden ? 1 : 0) : existing.isHidden ? 1 : 0;
    const isDefaultVal = data.isDefault !== undefined ? (data.isDefault ? 1 : 0) : existing.isDefault ? 1 : 0;
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
        avatar_image = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE name = ?
    `).run(displayNameVal, pathVal, isHiddenVal, isDefaultVal, avatarVal, data.name);
  } else {
    if (data.isDefault) {
      db.prepare('UPDATE libraries SET is_default = 0').run();
    }

    db.prepare(`
      INSERT INTO libraries (name, display_name, path, is_hidden, is_default, avatar_image)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.name,
      data.displayName ?? null,
      data.path ?? null,
      data.isHidden ? 1 : 0,
      data.isDefault ? 1 : 0,
      data.avatarImage ?? null
    );
  }

  return getLibraryByName(data.name)!;
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
  const res = db.prepare('DELETE FROM libraries WHERE name = ?').run(name);
  return res.changes > 0;
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
