import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'demo-library/demo/metadata.db');
const BASE_DIR = path.resolve(process.cwd(), 'demo-library/demo');

if (!fs.existsSync(DB_PATH)) {
  console.error('Demo database not found at:', DB_PATH);
  process.exit(1);
}

const db = new Database(DB_PATH);
const books = db.prepare(`
  SELECT id, title, authors, path 
  FROM v_books_flattened 
  ORDER BY id ASC
`).all();

console.log(`Starting online cover fetcher for ${books.length} books in demo-library...`);

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    return null;
  }
}

async function searchOpenLibrary(title, author) {
  const cleanTitle = title.replace(/[:\-–—].*$/, '').trim(); // Primary title without subtitle
  const cleanAuthor = (author || '').split('&')[0].trim();
  const query = `${cleanTitle} ${cleanAuthor}`;

  try {
    const searchUrl = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=1&fields=title,cover_i,isbn`;
    const res = await fetchWithTimeout(searchUrl, {
      headers: { 'User-Agent': 'SkalybrCoverFetcher/1.0 (contact@skalybr.dev)' }
    });
    if (!res || !res.ok) return null;
    const data = await res.json();
    const doc = data.docs?.[0];
    if (doc?.cover_i && doc.cover_i > 0) {
      return `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
    }
    if (doc?.isbn?.[0]) {
      return `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-L.jpg`;
    }
  } catch (e) {}
  return null;
}

async function downloadCover(imageUrl, targetPath) {
  try {
    const res = await fetchWithTimeout(imageUrl, {
      headers: { 'User-Agent': 'SkalybrCoverFetcher/1.0' }
    });
    if (!res || !res.ok) return false;
    const buffer = Buffer.from(await res.arrayBuffer());
    // Ensure image is at least 1000 bytes (not a 1x1 blank pixel placeholder)
    if (buffer.length > 1500) {
      fs.writeFileSync(targetPath, buffer);
      return true;
    }
  } catch (e) {}
  return false;
}

async function run() {
  let downloadedCount = 0;
  let skippedCount = 0;

  // Process concurrently with a pool of 5 workers
  const CONCURRENCY = 5;
  let index = 0;

  async function worker(workerId) {
    while (index < books.length) {
      const currentIndex = index++;
      const book = books[currentIndex];
      const bookDir = path.join(BASE_DIR, book.path);
      const coverPath = path.join(bookDir, 'cover.jpg');

      if (!fs.existsSync(bookDir)) {
        fs.mkdirSync(bookDir, { recursive: true });
      }

      const coverUrl = await searchOpenLibrary(book.title, book.authors);
      if (coverUrl) {
        const success = await downloadCover(coverUrl, coverPath);
        if (success) {
          downloadedCount++;
          console.log(`[${currentIndex + 1}/${books.length}] ✅ Downloaded cover for: "${book.title}"`);
        } else {
          skippedCount++;
        }
      } else {
        skippedCount++;
      }

      // Polite delay between API requests
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  const workers = Array.from({ length: CONCURRENCY }, (_, i) => worker(i));
  await Promise.all(workers);

  console.log(`\n🎉 Finished fetching covers!`);
  console.log(`Successfully fetched real covers: ${downloadedCount}`);
  console.log(`Kept generated typographic covers for: ${skippedCount}`);
}

run();
