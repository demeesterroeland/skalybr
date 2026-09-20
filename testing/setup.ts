import fs from 'fs';
import path from 'path';
import os from 'os';

// Ensure libraries/demo and libraries/boox exist for test runs using the committed demo-library
const baseDir = process.env.CALIBRE_BASE_DIR || path.join(process.cwd(), 'libraries');
const demoSrc = path.join(process.cwd(), 'demo-library', 'demo');
const demoDest = path.join(baseDir, 'demo');
const booxDest = path.join(baseDir, 'boox');

if (fs.existsSync(demoSrc)) {
  if (!fs.existsSync(demoDest)) {
    fs.mkdirSync(path.dirname(demoDest), { recursive: true });
    fs.cpSync(demoSrc, demoDest, { recursive: true });
  }
  if (!fs.existsSync(booxDest)) {
    fs.mkdirSync(path.dirname(booxDest), { recursive: true });
    fs.cpSync(demoSrc, booxDest, { recursive: true });
  }
}

if (!process.env.DEFAULT_LIBRARY) {
  process.env.DEFAULT_LIBRARY = 'demo';
}

if (!process.env.DATA_DIR) {
  const testDataDir = path.join(os.tmpdir(), `skalybr-test-${process.pid}`);
  fs.mkdirSync(testDataDir, { recursive: true });
  process.env.DATA_DIR = testDataDir;
  process.on('exit', () => {
    try {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  });
}
