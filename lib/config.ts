import path from 'path';
import fs from 'fs';

export const DEFAULT_CALIBRE_BASE_DIR =
  process.env.CALIBRE_BASE_DIR || path.join(process.cwd(), 'libraries');

export const DEFAULT_LIBRARY_NAME = process.env.DEFAULT_LIBRARY || 'boox';

export function getLibraryPath(libraryName: string = DEFAULT_LIBRARY_NAME): string {
  // Strip .. components to prevent traversal, but keep path separators for nested libraries
  const sanitizedName = libraryName.replace(/\.\./g, '');
  
  if (!sanitizedName) {
    throw new Error('Invalid library name');
  }

  // Allow resolving in cwd if it matches our basic metadata.db heuristic
  const relPath = path.join(process.cwd(), sanitizedName);
  const resolvedRelPath = path.resolve(relPath);
  if (resolvedRelPath.startsWith(path.resolve(process.cwd()) + path.sep) && fs.existsSync(path.join(resolvedRelPath, 'metadata.db'))) {
    return resolvedRelPath;
  }
  
  // Standard base dir resolution
  const basePath = path.join(DEFAULT_CALIBRE_BASE_DIR, sanitizedName);
  const resolvedBasePath = path.resolve(basePath);
  if (!resolvedBasePath.startsWith(path.resolve(DEFAULT_CALIBRE_BASE_DIR) + path.sep)) {
    throw new Error('Path escape detected');
  }
  return resolvedBasePath;
}
