-- Migration: 0001_initial_schema.sql
-- Description: Baseline schema for Skalybr (libraries, reading_progress, shelves, book_shelf_link, smart_shelves, settings)

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
