import path from 'path';

export const DEFAULT_CALIBRE_BASE_DIR =
  process.env.CALIBRE_BASE_DIR || path.join(process.cwd(), 'demo-library');

export const DEFAULT_LIBRARY_NAME = process.env.DEFAULT_LIBRARY || 'demo';

export function getLibraryPath(libraryName: string = DEFAULT_LIBRARY_NAME): string {
  return path.join(DEFAULT_CALIBRE_BASE_DIR, libraryName);
}
