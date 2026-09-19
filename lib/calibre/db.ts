import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const connectionPool = new Map<string, Database.Database>();

export function getDatabaseConnection(libraryPath: string): Database.Database {
  const normalizedPath = path.resolve(libraryPath);
  const dbPath = path.join(normalizedPath, 'metadata.db');

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Calibre database not found at ${dbPath}`);
  }

  if (connectionPool.has(normalizedPath)) {
    return connectionPool.get(normalizedPath)!;
  }

  const db = new Database(dbPath, {
    fileMustExist: true,
    timeout: 5000,
  });

  // Enable WAL mode and optimized SQLite settings
  db.pragma('journal_mode = WAL');
  db.pragma('synchronous = NORMAL');
  db.pragma('busy_timeout = 5000');

  // Ensure flattened view exists
  ensureFlattenedView(db);

  connectionPool.set(normalizedPath, db);
  return db;
}

export function ensureFlattenedView(db: Database.Database): void {
  // Check if custom_column_1 exists
  const hasCustomCol1 = db
    .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='custom_column_1'")
    .get() as { count: number };

  const customColSql = hasCustomCol1.count > 0
    ? `(SELECT cc1.value FROM books_custom_column_1_link bccl JOIN custom_column_1 cc1 ON cc1.id = bccl.value WHERE bccl.book = b.id) AS collection`
    : `NULL AS collection`;

  // Drop old view to ensure latest definition
  db.exec('DROP VIEW IF EXISTS v_books_flattened;');

  const viewSql = `
    CREATE VIEW v_books_flattened AS
    SELECT 
      b.id,
      b.title,
      b.sort AS title_sort,
      b.author_sort,
      b.timestamp,
      b.pubdate,
      b.series_index,
      b.has_cover,
      b.path,
      b.uuid,
      (SELECT val FROM identifiers WHERE book = b.id AND type = 'isbn' LIMIT 1) AS isbn,
      (SELECT GROUP_CONCAT(a.name, ' & ') FROM books_authors_link bal JOIN authors a ON a.id = bal.author WHERE bal.book = b.id) AS authors,
      (SELECT s.name FROM books_series_link bsl JOIN series s ON s.id = bsl.series WHERE bsl.book = b.id) AS series_name,
      (SELECT GROUP_CONCAT(t.name, ', ') FROM books_tags_link btl JOIN tags t ON t.id = btl.tag WHERE btl.book = b.id) AS tags,
      (SELECT p.name FROM books_publishers_link bpl JOIN publishers p ON p.id = bpl.publisher WHERE bpl.book = b.id) AS publisher,
      (SELECT l.lang_code FROM books_languages_link bll JOIN languages l ON l.id = bll.lang_code WHERE bll.book = b.id) AS language,
      (SELECT r.rating / 2.0 FROM books_ratings_link brl JOIN ratings r ON r.id = brl.rating WHERE brl.book = b.id) AS rating,
      (SELECT c.text FROM comments c WHERE c.book = b.id) AS description,
      (SELECT GROUP_CONCAT(d.format, ',') FROM data d WHERE d.book = b.id) AS formats,
      ${customColSql}
    FROM books b;
  `;

  db.exec(viewSql);
}
