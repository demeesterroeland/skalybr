import Database from 'better-sqlite3';
import fs from 'fs';
import { getSkalybrDb, updateReadingProgress } from './skalybr-db';
import { ReadingStatus } from '../types';

export interface CalibreWebImportSummary {
  success: boolean;
  message: string;
  imported: {
    readStatusCount: number;
    bookmarkCount: number;
    shelvesCount: number;
    shelfLinksCount: number;
  };
  calibreDirFound?: string | null;
}

/**
 * Imports user data from a Calibre-Web app.db file into skalybr.db
 * @param appDbPath Path to Calibre-Web's app.db file
 * @param targetLibrary Target library name in Skalybr (e.g. 'boox' or 'demo')
 */
export function importFromCalibreWeb(
  appDbPath: string,
  targetLibrary: string = 'default'
): CalibreWebImportSummary {
  if (!fs.existsSync(appDbPath)) {
    return {
      success: false,
      message: `Calibre-Web database file not found at ${appDbPath}`,
      imported: { readStatusCount: 0, bookmarkCount: 0, shelvesCount: 0, shelfLinksCount: 0 },
    };
  }

  let sourceDb: Database.Database;
  try {
    sourceDb = new Database(appDbPath, { readonly: true, fileMustExist: true });
  } catch (err: any) {
    return {
      success: false,
      message: `Failed to open Calibre-Web app.db: ${err.message}`,
      imported: { readStatusCount: 0, bookmarkCount: 0, shelvesCount: 0, shelfLinksCount: 0 },
    };
  }

  const skalybrDb = getSkalybrDb();
  const summary: CalibreWebImportSummary = {
    success: true,
    message: 'Import completed successfully.',
    imported: {
      readStatusCount: 0,
      bookmarkCount: 0,
      shelvesCount: 0,
      shelfLinksCount: 0,
    },
    calibreDirFound: null,
  };

  try {
    // 1. Check for settings (config_calibre_dir)
    const hasSettings = sourceDb
      .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='settings'")
      .get() as { count: number };

    if (hasSettings.count > 0) {
      try {
        const settingsRow = sourceDb.prepare('SELECT config_calibre_dir FROM settings LIMIT 1').get() as { config_calibre_dir?: string } | undefined;
        if (settingsRow?.config_calibre_dir) {
          summary.calibreDirFound = settingsRow.config_calibre_dir;
        }
      } catch (e) {}
    }

    // 2. Import book_read_link
    const hasReadLink = sourceDb
      .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='book_read_link'")
      .get() as { count: number };

    if (hasReadLink.count > 0) {
      const readRows = sourceDb.prepare('SELECT book_id, user_id, read_status FROM book_read_link').all() as Array<{
        book_id: number;
        user_id: number;
        read_status: number;
      }>;

      for (const row of readRows) {
        let status: ReadingStatus = 'unread';
        let percent = 0.0;
        if (row.read_status === 1) {
          status = 'finished';
          percent = 100.0;
        } else if (row.read_status === 2) {
          status = 'reading';
          percent = 50.0; // In-progress default until bookmark locator provides exact
        }

        updateReadingProgress({
          library: targetLibrary,
          bookId: row.book_id,
          userId: row.user_id || 1,
          status,
          progressPercent: percent,
        });
        summary.imported.readStatusCount++;
      }
    }

    // 3. Import bookmark (EPUB CFI locators)
    const hasBookmark = sourceDb
      .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='bookmark'")
      .get() as { count: number };

    if (hasBookmark.count > 0) {
      const bookmarkRows = sourceDb.prepare('SELECT book_id, user_id, format, bookmark_key FROM bookmark').all() as Array<{
        book_id: number;
        user_id: number;
        format: string;
        bookmark_key: string;
      }>;

      for (const b of bookmarkRows) {
        updateReadingProgress({
          library: targetLibrary,
          bookId: b.book_id,
          userId: b.user_id || 1,
          format: b.format,
          locator: b.bookmark_key,
        });
        summary.imported.bookmarkCount++;
      }
    }

    // 4. Import shelves
    const hasShelf = sourceDb
      .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='shelf'")
      .get() as { count: number };

    const shelfIdMap = new Map<number, number>(); // oldId -> newId

    if (hasShelf.count > 0) {
      const shelfRows = sourceDb.prepare('SELECT id, uuid, name, is_public, user_id, kobo_sync, created FROM shelf').all() as Array<{
        id: number;
        uuid: string;
        name: string;
        is_public: number;
        user_id: number;
        kobo_sync: number;
        created: string;
      }>;

      const insertShelf = skalybrDb.prepare(`
        INSERT INTO shelves (uuid, name, is_public, user_id, kobo_sync, created_at)
        VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
        ON CONFLICT(uuid) DO UPDATE SET name = excluded.name
      `);

      for (const s of shelfRows) {
        const info = insertShelf.run(s.uuid, s.name, s.is_public, s.user_id || 1, s.kobo_sync || 0, s.created);
        const newId = Number(info.lastInsertRowid);
        shelfIdMap.set(s.id, newId);
        summary.imported.shelvesCount++;
      }
    }

    // 5. Import book_shelf_link
    const hasBookShelf = sourceDb
      .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='book_shelf_link'")
      .get() as { count: number };

    if (hasBookShelf.count > 0) {
      const bookShelfRows = sourceDb.prepare('SELECT book_id, `order`, shelf, date_added FROM book_shelf_link').all() as Array<{
        book_id: number;
        order: number;
        shelf: number;
        date_added: string;
      }>;

      const insertLink = skalybrDb.prepare(`
        INSERT INTO book_shelf_link (library, shelf_id, book_id, order_index, date_added)
        VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
        ON CONFLICT(library, shelf_id, book_id) DO UPDATE SET order_index = excluded.order_index
      `);

      for (const bsl of bookShelfRows) {
        const newShelfId = shelfIdMap.get(bsl.shelf) || bsl.shelf;
        insertLink.run(targetLibrary, newShelfId, bsl.book_id, bsl.order || 0, bsl.date_added);
        summary.imported.shelfLinksCount++;
      }
    }
  } finally {
    sourceDb.close();
  }

  return summary;
}
