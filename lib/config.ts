import path from 'path';
import fs from 'fs';

export const DEFAULT_CALIBRE_BASE_DIR =
  process.env.CALIBRE_BASE_DIR || path.join(process.cwd(), 'libraries');

export const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
export const SKALYBR_DB_PATH = path.join(DATA_DIR, 'skalybr.db');

export function getDefaultLibraryName(): string {
  try {
    // Dynamic import / inline require to avoid circular dependencies if any
    const { getDefaultLibraryRecord } = require('./db/skalybr-db');
    const defaultLib = getDefaultLibraryRecord();
    if (defaultLib && defaultLib.name) {
      return defaultLib.name;
    }
  } catch (e) {
    // DB not yet initialized or during early build
  }
  return process.env.DEFAULT_LIBRARY || 'demo';
}

export const DEFAULT_LIBRARY_NAME = process.env.DEFAULT_LIBRARY || 'demo';

export function getLibraryPath(libraryName?: string): string {
  const targetName = libraryName || getDefaultLibraryName();
  // Strip .. components to prevent traversal, but keep path separators for nested libraries
  const sanitizedName = targetName.replace(/\.\./g, '');
  
  if (!sanitizedName) {
    throw new Error('Invalid library name');
  }

  // 1. Check in DEFAULT_CALIBRE_BASE_DIR (e.g. ./libraries)
  const basePath = path.join(DEFAULT_CALIBRE_BASE_DIR, sanitizedName);
  const resolvedBasePath = path.resolve(basePath);
  if (resolvedBasePath.startsWith(path.resolve(DEFAULT_CALIBRE_BASE_DIR) + path.sep) && fs.existsSync(path.join(resolvedBasePath, 'metadata.db'))) {
    return resolvedBasePath;
  }

  // 2. Fallback: Allow resolving in cwd if it matches metadata.db (e.g. demo-library/demo or boox in root)
  const relPath = path.join(process.cwd(), sanitizedName);
  const resolvedRelPath = path.resolve(relPath);
  if (resolvedRelPath.startsWith(path.resolve(process.cwd()) + path.sep) && fs.existsSync(path.join(resolvedRelPath, 'metadata.db'))) {
    return resolvedRelPath;
  }
  
  // Standard base dir resolution
  if (!resolvedBasePath.startsWith(path.resolve(DEFAULT_CALIBRE_BASE_DIR) + path.sep)) {
    throw new Error('Path escape detected');
  }
  return resolvedBasePath;
}
