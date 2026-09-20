import fs from 'fs';
import path from 'path';

export interface LibrarySettings {
  hiddenLibraries: string[];
  customNames: Record<string, string>; // originalPath -> customDisplayName
}

const SETTINGS_FILE = path.join(process.cwd(), '.skalybr-libraries.json');

export function getLibrarySettings(): LibrarySettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
      return {
        hiddenLibraries: Array.isArray(data.hiddenLibraries) ? data.hiddenLibraries : [],
        customNames: typeof data.customNames === 'object' && data.customNames !== null ? data.customNames : {},
      };
    }
  } catch (e) {
    console.error('Error reading library settings:', e);
  }
  return { hiddenLibraries: [], customNames: {} };
}

export function saveLibrarySettings(settings: LibrarySettings): void {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving library settings:', e);
  }
}
