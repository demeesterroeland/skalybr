import { getAllLibraries, upsertLibraryRecord } from './db/skalybr-db';

export interface LibrarySettings {
  hiddenLibraries: string[];
  customNames: Record<string, string>; // originalPath / name -> customDisplayName
}

/**
 * Retrieves library display names and visibility settings from skalybr.db
 */
export function getLibrarySettings(): LibrarySettings {
  try {
    const allLibs = getAllLibraries(true);
    const hiddenLibraries: string[] = [];
    const customNames: Record<string, string> = {};

    for (const lib of allLibs) {
      if (lib.isHidden) {
        hiddenLibraries.push(lib.name);
      }
      if (lib.displayName && lib.displayName.trim() !== '') {
        customNames[lib.name] = lib.displayName;
      }
    }

    return { hiddenLibraries, customNames };
  } catch (e) {
    console.error('Error reading library settings from skalybr.db:', e);
    return { hiddenLibraries: [], customNames: {} };
  }
}

/**
 * Persists library display names and visibility settings to skalybr.db
 */
export function saveLibrarySettings(settings: LibrarySettings): void {
  try {
    const allKeys = new Set([
      ...Object.keys(settings.customNames || {}),
      ...(settings.hiddenLibraries || []),
    ]);

    for (const name of allKeys) {
      const displayName = settings.customNames[name] || null;
      const isHidden = settings.hiddenLibraries?.includes(name) ?? false;
      upsertLibraryRecord({
        name,
        displayName,
        isHidden,
      });
    }
  } catch (e) {
    console.error('Error saving library settings to skalybr.db:', e);
  }
}
