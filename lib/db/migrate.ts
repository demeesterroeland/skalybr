import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

export const MIGRATION_FILENAME_REGEX = /^\d{4}_.*\.sql$/;

export interface AppliedMigration {
  id: number;
  filename: string;
  applied_at: string;
}

export interface MigrationExecution {
  filename: string;
  appliedAt: string;
}

/**
 * Returns the directory containing SQL migration files.
 * Defaults to `<cwd>/data/migrations` or the `MIGRATIONS_DIR` environment variable.
 */
export function getMigrationsDir(): string {
  if (process.env.MIGRATIONS_DIR) {
    return process.env.MIGRATIONS_DIR;
  }
  const dataMigrations = path.join(process.cwd(), 'data', 'migrations');
  if (fs.existsSync(dataMigrations)) {
    return dataMigrations;
  }
  const rootMigrations = path.join(process.cwd(), 'migrations');
  if (fs.existsSync(rootMigrations)) {
    return rootMigrations;
  }
  return dataMigrations;
}

/**
 * Checks whether a filename matches the standard 4-digit migration naming convention:
 * `^\d{4}_.*\.sql$` (e.g. `0001_initial_schema.sql`)
 */
export function isValidMigrationFilename(filename: string): boolean {
  return MIGRATION_FILENAME_REGEX.test(filename);
}

/**
 * Ensures the `_migrations` table exists in the SQLite database.
 */
export function ensureMigrationsTable(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
}

/**
 * Scans the migrations directory and returns all SQL files sorted naturally by version prefix.
 * Throws an error if any `.sql` file does not match the 4-digit prefix convention.
 */
export function getMigrationFiles(migrationsDir: string = getMigrationsDir()): string[] {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Migrations directory not found: "${migrationsDir}"`);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'));

  const seenVersions = new Map<string, string>();
  for (const file of files) {
    if (!isValidMigrationFilename(file)) {
      throw new Error(
        `Invalid migration filename: "${file}". Migration filenames must match pattern ^\\d{4}_.*\\.sql$ (e.g. 0001_initial_schema.sql)`
      );
    }
    const version = file.slice(0, 4);
    if (seenVersions.has(version)) {
      throw new Error(
        `Duplicate migration version prefix "${version}": found in "${seenVersions.get(version)}" and "${file}"`
      );
    }
    seenVersions.set(version, file);
  }

  return files.sort((a, b) => {
    const vA = parseInt(a.slice(0, 4), 10);
    const vB = parseInt(b.slice(0, 4), 10);
    if (vA !== vB) {
      return vA - vB;
    }
    return a.localeCompare(b);
  });
}

/**
 * Returns the list of migration filenames that have already been recorded in `_migrations`.
 */
export function getAppliedMigrationFilenames(db: Database.Database): string[] {
  ensureMigrationsTable(db);
  const rows = db
    .prepare('SELECT filename FROM _migrations ORDER BY id ASC')
    .all() as { filename: string }[];
  return rows.map((r) => r.filename);
}

/**
 * Returns the list of pending migration filenames that have not yet been applied.
 */
export function getPendingMigrations(
  db: Database.Database,
  migrationsDir: string = getMigrationsDir()
): string[] {
  const allFiles = getMigrationFiles(migrationsDir);
  const appliedSet = new Set(getAppliedMigrationFilenames(db));
  return allFiles.filter((file) => !appliedSet.has(file));
}

/**
 * Executes pending migrations inside atomic transactions and records them in `_migrations`.
 * Disables foreign key enforcement during DDL execution and restores previous state afterward.
 *
 * @param db Active better-sqlite3 database instance
 * @param migrationsDir Directory containing migration SQL files
 * @returns Array of executed migrations with timestamps
 */
export function runMigrations(
  db: Database.Database,
  migrationsDir: string = getMigrationsDir()
): MigrationExecution[] {
  ensureMigrationsTable(db);

  const pending = getPendingMigrations(db, migrationsDir);
  if (pending.length === 0) {
    return [];
  }

  const executed: MigrationExecution[] = [];

  for (const filename of pending) {
    const filePath = path.join(migrationsDir, filename);
    const sql = fs.readFileSync(filePath, 'utf-8');

    // SQLite PRAGMA foreign_keys cannot be toggled inside an active transaction.
    // Turn foreign keys off during DDL, then restore previous state in finally block.
    const fkPragma = db.pragma('foreign_keys', { simple: true }) as number;
    const foreignKeysWereOn = fkPragma === 1;

    if (foreignKeysWereOn) {
      db.pragma('foreign_keys = OFF');
    }

    let wasApplied = false;
    try {
      const executeTx = db.transaction(() => {
        // Concurrency defense: check if applied by another process while waiting on lock
        const alreadyApplied = db
          .prepare('SELECT 1 FROM _migrations WHERE filename = ?')
          .get(filename);
        if (alreadyApplied) {
          return false;
        }

        db.exec(sql);

        // Verify foreign key integrity before committing
        const violations = db.pragma('foreign_key_check') as unknown[];
        if (violations.length > 0) {
          throw new Error(
            `Foreign key integrity check failed after migration "${filename}": ${JSON.stringify(violations)}`
          );
        }

        db.prepare('INSERT INTO _migrations (filename) VALUES (?)').run(filename);
        return true;
      });
      wasApplied = executeTx.immediate();
    } finally {
      if (foreignKeysWereOn) {
        db.pragma('foreign_keys = ON');
      }
    }

    if (wasApplied) {
      const record = db
        .prepare('SELECT filename, applied_at FROM _migrations WHERE filename = ?')
        .get(filename) as { filename: string; applied_at: string };

      executed.push({
        filename: record.filename,
        appliedAt: record.applied_at,
      });
    }
  }

  return executed;
}
