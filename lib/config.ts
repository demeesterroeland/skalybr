import path from 'path';
import fs from 'fs';

export const DEFAULT_CALIBRE_BASE_DIR =
  process.env.CALIBRE_BASE_DIR || process.cwd();

export const DEFAULT_LIBRARY_NAME = process.env.DEFAULT_LIBRARY || 'boox';

export function getLibraryPath(libraryName: string = DEFAULT_LIBRARY_NAME): string {
  // If libraryName is already a valid absolute path or relative directory with metadata.db
  if (path.isAbsolute(libraryName) && fs.existsSync(path.join(libraryName, 'metadata.db'))) {
    return libraryName;
  }
  const relPath = path.join(process.cwd(), libraryName);
  if (fs.existsSync(path.join(relPath, 'metadata.db'))) {
    return relPath;
  }
  // Standard base dir resolution
  return path.join(DEFAULT_CALIBRE_BASE_DIR, libraryName);
}
