import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  runMigrations,
  getMigrationFiles,
  getPendingMigrations,
  getAppliedMigrationFilenames,
  ensureMigrationsTable,
  isValidMigrationFilename,
  getMigrationsDir,
  MIGRATION_FILENAME_REGEX,
} from '../../lib/db/migrate';

describe('SQLite Migrations Infrastructure', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Each test operates on a fresh in-memory database
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
  });

  afterEach(() => {
    db.close();
  });

  describe('Migration Filename Conventions', () => {
    it('validates compliant migration filenames matching ^\\d{4}_.*\\.sql$', () => {
      expect(isValidMigrationFilename('0001_initial_schema.sql')).toBe(true);
      expect(isValidMigrationFilename('0002_add_is_public_to_libraries.sql')).toBe(true);
      expect(isValidMigrationFilename('0099_complex_migration_step_v2.sql')).toBe(true);
      expect(isValidMigrationFilename('9999_final.sql')).toBe(true);
    });

    it('rejects non-compliant migration filenames', () => {
      expect(isValidMigrationFilename('1_initial.sql')).toBe(false);
      expect(isValidMigrationFilename('001_initial.sql')).toBe(false);
      expect(isValidMigrationFilename('00001_initial.sql')).toBe(false);
      expect(isValidMigrationFilename('initial_schema.sql')).toBe(false);
      expect(isValidMigrationFilename('0001_initial_schema.txt')).toBe(false);
      expect(isValidMigrationFilename('0001_initial_schema.sql.bak')).toBe(false);
      expect(isValidMigrationFilename('.DS_Store')).toBe(false);
    });

    it('ensures all actual repository migrations match the naming format and are strictly sequential', () => {
      const migrationsDir = getMigrationsDir();
      expect(fs.existsSync(migrationsDir)).toBe(true);

      const files = getMigrationFiles(migrationsDir);
      expect(files.length).toBeGreaterThanOrEqual(1);

      // Verify each file matches regex
      for (const file of files) {
        expect(file).toMatch(MIGRATION_FILENAME_REGEX);
      }

      // Verify sequence starts at 0001 and has no gaps or duplicates
      const versionNumbers = files.map((file) => {
        const match = file.match(/^(\d{4})_/);
        return match ? parseInt(match[1], 10) : -1;
      });

      expect(versionNumbers[0]).toBe(1);
      for (let i = 1; i < versionNumbers.length; i++) {
        expect(versionNumbers[i]).toBe(versionNumbers[i - 1] + 1);
      }
    });
  });

  describe('Migration Runner Execution', () => {
    it('creates the _migrations tracking table', () => {
      ensureMigrationsTable(db);

      const table = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_migrations'")
        .get();
      expect(table).toBeDefined();

      const columns = db.prepare('PRAGMA table_info(_migrations)').all() as { name: string }[];
      const colNames = columns.map((c) => c.name);
      expect(colNames).toContain('id');
      expect(colNames).toContain('filename');
      expect(colNames).toContain('applied_at');
    });

    it('executes all repository migrations in order on a fresh database', () => {
      const applied = runMigrations(db);

      expect(applied.length).toBeGreaterThanOrEqual(1);
      expect(applied[0].filename).toBe('0001_initial_schema.sql');
      expect(applied[0].appliedAt).toBeDefined();

      // Check _migrations table
      const recorded = getAppliedMigrationFilenames(db);
      expect(recorded).toContain('0001_initial_schema.sql');
      expect(recorded).toContain('0002_add_is_public_to_libraries.sql');
      expect(recorded).toContain('0003_create_users.sql');
      expect(recorded).toContain('0004_create_cascading_acl.sql');

      // Verify all tables were created
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
        .all() as { name: string }[];
      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain('_migrations');
      expect(tableNames).toContain('libraries');
      expect(tableNames).toContain('reading_progress');
      expect(tableNames).toContain('shelves');
      expect(tableNames).toContain('book_shelf_link');
      expect(tableNames).toContain('smart_shelves');
      expect(tableNames).toContain('settings');
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('access_grants');

      // Verify libraries has is_public column from 0002
      const libCols = db.prepare('PRAGMA table_info(libraries)').all() as { name: string }[];
      expect(libCols.map((c) => c.name)).toContain('is_public');

      // Verify indexes were created
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'index'")
        .all() as { name: string }[];
      const indexNames = indexes.map((i) => i.name);

      expect(indexNames).toContain('idx_libraries_name');
      expect(indexNames).toContain('idx_libraries_is_default');
      expect(indexNames).toContain('idx_reading_progress_lookup');
      expect(indexNames).toContain('idx_reading_progress_status');
      expect(indexNames).toContain('idx_users_username');
      expect(indexNames).toContain('idx_users_status');
      expect(indexNames).toContain('idx_acl_lookup');
    });

    it('is idempotent: subsequent runs do not re-apply already executed migrations', () => {
      // First run
      const firstRun = runMigrations(db);
      expect(firstRun.length).toBeGreaterThanOrEqual(1);

      // Insert dummy record to confirm data preservation
      db.prepare("INSERT INTO libraries (name, display_name) VALUES ('test_lib', 'Test Library')").run();
      db.prepare("INSERT INTO settings (key, value) VALUES ('version', '1.0.0')").run();

      // Second run
      const secondRun = runMigrations(db);
      expect(secondRun.length).toBe(0);

      // Verify data remains intact
      const lib = db.prepare("SELECT * FROM libraries WHERE name = 'test_lib'").get() as { display_name: string };
      expect(lib.display_name).toBe('Test Library');

      const setting = db.prepare("SELECT * FROM settings WHERE key = 'version'").get() as { value: string };
      expect(setting.value).toBe('1.0.0');

      // Pending migrations should be empty
      const pending = getPendingMigrations(db);
      expect(pending.length).toBe(0);
    });

    it('rolls back atomically on failure and does not record the failed migration', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skalybr-mig-fail-'));

      try {
        // Step 1: Valid initial migration
        fs.writeFileSync(
          path.join(tempDir, '0001_ok.sql'),
          'CREATE TABLE test_table (id INTEGER PRIMARY KEY, title TEXT NOT NULL);'
        );

        // First migration succeeds
        const first = runMigrations(db, tempDir);
        expect(first.length).toBe(1);
        expect(first[0].filename).toBe('0001_ok.sql');

        // Step 2: Broken migration that fails midway
        fs.writeFileSync(
          path.join(tempDir, '0002_fail.sql'),
          `CREATE TABLE should_rollback (id INTEGER PRIMARY KEY);
           INSERT INTO should_rollback (id) VALUES (1);
           INVALID SQL SYNTAX ERROR;`
        );

        // Second migration must throw and roll back
        expect(() => runMigrations(db, tempDir)).toThrow();

        // should_rollback table should NOT exist because transaction rolled back
        const checkTable = db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'should_rollback'")
          .get();
        expect(checkTable).toBeUndefined();

        // 0002_fail.sql should NOT be recorded in _migrations
        const applied = getAppliedMigrationFilenames(db);
        expect(applied).toEqual(['0001_ok.sql']);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('restores foreign key pragma after running migrations', () => {
      // db was initialized with foreign_keys = ON
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);

      runMigrations(db);

      // Foreign keys must still be enabled
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
    });

    it('throws an error if a .sql file has an invalid filename format', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skalybr-mig-invalid-'));
      try {
        fs.writeFileSync(path.join(tempDir, 'invalid_migration.sql'), 'SELECT 1;');
        expect(() => getMigrationFiles(tempDir)).toThrow(/Invalid migration filename/);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('applies multiple pending migrations in sequential order', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skalybr-mig-multi-'));
      try {
        fs.writeFileSync(
          path.join(tempDir, '0001_first.sql'),
          'CREATE TABLE users_test (id INTEGER PRIMARY KEY, name TEXT NOT NULL);'
        );
        fs.writeFileSync(
          path.join(tempDir, '0002_second.sql'),
          'ALTER TABLE users_test ADD COLUMN email TEXT;'
        );
        fs.writeFileSync(
          path.join(tempDir, '0003_third.sql'),
          'CREATE INDEX idx_users_test_email ON users_test(email);'
        );

        const applied = runMigrations(db, tempDir);
        expect(applied.map((m) => m.filename)).toEqual([
          '0001_first.sql',
          '0002_second.sql',
          '0003_third.sql',
        ]);

        const cols = db.prepare('PRAGMA table_info(users_test)').all() as { name: string }[];
        const colNames = cols.map((c) => c.name);
        expect(colNames).toContain('id');
        expect(colNames).toContain('name');
        expect(colNames).toContain('email');

        const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_users_test_email'").all();
        expect(indexes.length).toBe(1);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('throws an error when migrations directory does not exist', () => {
      const nonExistent = path.join(os.tmpdir(), 'non-existent-mig-dir-' + Date.now());
      expect(() => getMigrationFiles(nonExistent)).toThrow(/Migrations directory not found/);
    });

    it('rejects duplicate migration version prefixes', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skalybr-mig-dup-'));
      try {
        fs.writeFileSync(path.join(tempDir, '0001_init.sql'), 'SELECT 1;');
        fs.writeFileSync(path.join(tempDir, '0001_duplicate.sql'), 'SELECT 1;');
        expect(() => getMigrationFiles(tempDir)).toThrow(/Duplicate migration version prefix "0001"/);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('aborts and rolls back if foreign key integrity check fails during migration', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skalybr-mig-fk-'));
      try {
        fs.writeFileSync(
          path.join(tempDir, '0001_fk_violation.sql'),
          `CREATE TABLE parent (id INTEGER PRIMARY KEY);
           CREATE TABLE child (id INTEGER PRIMARY KEY, parent_id INTEGER REFERENCES parent(id));
           INSERT INTO child (id, parent_id) VALUES (1, 999);`
        );

        expect(() => runMigrations(db, tempDir)).toThrow(/Foreign key integrity check failed/);

        // Child table should have rolled back completely
        const checkTable = db
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'child'")
          .get();
        expect(checkTable).toBeUndefined();

        // No migration recorded
        const applied = getAppliedMigrationFilenames(db);
        expect(applied).toEqual([]);
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('safely handles concurrent execution race without UNIQUE constraint failure', () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skalybr-mig-race-'));
      const dbFile = path.join(tempDir, 'race.db');

      try {
        fs.writeFileSync(
          path.join(tempDir, '0001_first.sql'),
          'CREATE TABLE IF NOT EXISTS race_test (id INTEGER PRIMARY KEY, val TEXT);'
        );

        const connA = new Database(dbFile);
        const connB = new Database(dbFile);

        // Both connections ensure table
        ensureMigrationsTable(connA);
        ensureMigrationsTable(connB);

        // Conn A applies migration
        const appliedA = runMigrations(connA, tempDir);
        expect(appliedA.length).toBe(1);

        // Conn B now attempts to run migrations (simulating it had already fetched pending list)
        // With concurrency defense, conn B should not crash with UNIQUE constraint error
        const appliedB = runMigrations(connB, tempDir);
        expect(appliedB.length).toBe(0);

        connA.close();
        connB.close();
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });

    it('upgrades a legacy database that already contains schema and data but no _migrations table', () => {
      // Setup a legacy pre-migration database containing data
      db.exec(`
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
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);

      db.prepare("INSERT INTO libraries (name, display_name, is_default) VALUES ('legacy_lib', 'My Legacy Library', 1)").run();
      db.prepare("INSERT INTO settings (key, value) VALUES ('theme', 'dark')").run();

      // Ensure _migrations does not exist yet
      const preCheck = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_migrations'")
        .get();
      expect(preCheck).toBeUndefined();

      // Run repository migrations on legacy DB
      const applied = runMigrations(db);
      expect(applied.length).toBeGreaterThanOrEqual(1);
      expect(applied[0].filename).toBe('0001_initial_schema.sql');

      // Verify _migrations now exists and records 0001
      const recorded = getAppliedMigrationFilenames(db);
      expect(recorded).toContain('0001_initial_schema.sql');

      // Verify pre-existing data was preserved intact
      const lib = db.prepare("SELECT * FROM libraries WHERE name = 'legacy_lib'").get() as {
        display_name: string;
        is_default: number;
      };
      expect(lib.display_name).toBe('My Legacy Library');
      expect(lib.is_default).toBe(1);

      const setting = db.prepare("SELECT * FROM settings WHERE key = 'theme'").get() as { value: string };
      expect(setting.value).toBe('dark');

      // Subsequent migration run is a no-op
      const secondRun = runMigrations(db);
      expect(secondRun.length).toBe(0);
    });

    it('integrates with getSkalybrDb() to automatically apply migrations on database startup', async () => {
      const { getSkalybrDb, closeSkalybrDb } = await import('../../lib/db/skalybr-db');
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skalybr-db-test-'));
      const originalDataDir = process.env.DATA_DIR;
      process.env.DATA_DIR = tempDir;

      try {
        closeSkalybrDb();
        const instance = getSkalybrDb();
        const tables = instance
          .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
          .all() as { name: string }[];
        const names = tables.map((t) => t.name);
        expect(names).toContain('_migrations');
        expect(names).toContain('libraries');
        expect(names).toContain('reading_progress');
        expect(names).toContain('shelves');
        expect(names).toContain('users');
        expect(names).toContain('access_grants');

        const applied = getAppliedMigrationFilenames(instance);
        expect(applied).toContain('0001_initial_schema.sql');
        expect(applied).toContain('0002_add_is_public_to_libraries.sql');
        expect(applied).toContain('0003_create_users.sql');
        expect(applied).toContain('0004_create_cascading_acl.sql');
      } finally {
        closeSkalybrDb();
        if (originalDataDir !== undefined) {
          process.env.DATA_DIR = originalDataDir;
        } else {
          delete process.env.DATA_DIR;
        }
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});

