import fs from 'fs';
import path from 'path';

// Ensure libraries/demo exists for test runs using the committed demo-library
const baseDir = process.env.CALIBRE_BASE_DIR || path.join(process.cwd(), 'libraries');
const demoSrc = path.join(process.cwd(), 'demo-library', 'demo');
const demoDest = path.join(baseDir, 'demo');

if (fs.existsSync(demoSrc) && !fs.existsSync(demoDest)) {
  fs.mkdirSync(path.dirname(demoDest), { recursive: true });
  fs.cpSync(demoSrc, demoDest, { recursive: true });
}

if (!process.env.DEFAULT_LIBRARY) {
  process.env.DEFAULT_LIBRARY = 'demo';
}
