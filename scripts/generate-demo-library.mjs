import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const TARGET_BASE_DIR = path.resolve(process.cwd(), 'demo-library');
const LIBRARY_NAME = 'demo';
const LIBRARY_DIR = path.join(TARGET_BASE_DIR, LIBRARY_NAME);
const DB_PATH = path.join(LIBRARY_DIR, 'metadata.db');

fs.mkdirSync(LIBRARY_DIR, { recursive: true });

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// Create Complete Calibre Schema
db.exec(`
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT 'Unknown',
  sort TEXT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  pubdate TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  series_index REAL NOT NULL DEFAULT 1.0,
  author_sort TEXT,
  isbn TEXT DEFAULT '',
  lccn TEXT DEFAULT '',
  path TEXT NOT NULL DEFAULT '',
  flags INTEGER NOT NULL DEFAULT 1,
  uuid TEXT,
  has_cover BOOL DEFAULT 0,
  last_modified TIMESTAMP NOT NULL DEFAULT '2024-01-01 00:00:00+00:00'
);

CREATE TABLE IF NOT EXISTS authors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE,
  sort TEXT COLLATE NOCASE,
  link TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS books_authors_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book INTEGER NOT NULL,
  author INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS books_tags_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book INTEGER NOT NULL,
  tag INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS series (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE,
  sort TEXT COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS books_series_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book INTEGER NOT NULL,
  series INTEGER NOT NULL,
  series_index REAL NOT NULL DEFAULT 1.0
);

CREATE TABLE IF NOT EXISTS publishers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL COLLATE NOCASE,
  sort TEXT COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS books_publishers_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book INTEGER NOT NULL,
  publisher INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS languages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lang_code TEXT NOT NULL COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS books_languages_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book INTEGER NOT NULL,
  lang_code INTEGER NOT NULL,
  item_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rating INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS books_ratings_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book INTEGER NOT NULL,
  rating INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book INTEGER NOT NULL,
  text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS identifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'isbn' COLLATE NOCASE,
  val TEXT NOT NULL COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS data (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book INTEGER NOT NULL,
  format TEXT NOT NULL COLLATE NOCASE,
  uncompressed_size INTEGER NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_columns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL,
  name TEXT NOT NULL,
  datatype TEXT NOT NULL,
  mark_for_delete BOOL NOT NULL DEFAULT 0,
  editable BOOL NOT NULL DEFAULT 1,
  display TEXT NOT NULL DEFAULT '{}',
  is_multiple BOOL NOT NULL DEFAULT 0,
  normalized BOOL NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS custom_column_1 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  value TEXT NOT NULL COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS books_custom_column_1_link (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book INTEGER NOT NULL,
  value INTEGER NOT NULL
);
`);

// Insert custom column definition
db.prepare(`
  INSERT INTO custom_columns (id, label, name, datatype, is_multiple, normalized)
  VALUES (1, 'collection', 'Collections', 'text', 0, 1)
`).run();

const COLLECTIONS = [
  'Essential Non-Fiction',
  'Deep Ecology & Earth Systems',
  'Consciousness & Plant Medicine',
  'Sociocracy & Cooperative Governance',
  'Software Craft & Systems Thinking',
  'Philosophy & Existential Thought',
  'Indigenous Wisdom & Shamanism',
  'History & Civilization Dynamics',
  'Art, Aesthetics & Perception',
  'Self-Mastery & Human Potential',
];

const colStmt = db.prepare('INSERT INTO custom_column_1 (id, value) VALUES (?, ?)');
COLLECTIONS.forEach((col, idx) => colStmt.run(idx + 1, col));

const authorMap = new Map();
const tagMap = new Map();
const pubMap = new Map();
const seriesMap = new Map();
const langMap = new Map();

function getOrCreateAuthor(name) {
  if (authorMap.has(name)) return authorMap.get(name);
  const sort = name.split(' ').reverse().join(', ');
  const res = db.prepare('INSERT INTO authors (name, sort) VALUES (?, ?)').run(name, sort);
  authorMap.set(name, res.lastInsertRowid);
  return res.lastInsertRowid;
}

function getOrCreateTag(name) {
  if (tagMap.has(name)) return tagMap.get(name);
  const res = db.prepare('INSERT INTO tags (name) VALUES (?)').run(name);
  tagMap.set(name, res.lastInsertRowid);
  return res.lastInsertRowid;
}

function getOrCreatePublisher(name) {
  if (!name) return null;
  if (pubMap.has(name)) return pubMap.get(name);
  const res = db.prepare('INSERT INTO publishers (name, sort) VALUES (?, ?)').run(name, name);
  pubMap.set(name, res.lastInsertRowid);
  return res.lastInsertRowid;
}

function getOrCreateSeries(name) {
  if (!name) return null;
  if (seriesMap.has(name)) return seriesMap.get(name);
  const res = db.prepare('INSERT INTO series (name, sort) VALUES (?, ?)').run(name, name);
  seriesMap.set(name, res.lastInsertRowid);
  return res.lastInsertRowid;
}

function getOrCreateLang(code = 'eng') {
  if (langMap.has(code)) return langMap.get(code);
  const res = db.prepare('INSERT INTO languages (lang_code) VALUES (?)').run(code);
  langMap.set(code, res.lastInsertRowid);
  return res.lastInsertRowid;
}

function getOrCreateRating(starRating) {
  const calibreVal = Math.round(starRating * 2);
  const existing = db.prepare('SELECT id FROM ratings WHERE rating = ?').get(calibreVal);
  if (existing) return existing.id;
  const res = db.prepare('INSERT INTO ratings (rating) VALUES (?)').run(calibreVal);
  return res.lastInsertRowid;
}

const PALETTES = {
  Technology: { start: '#1e3a8a', end: '#0f172a' },
  Philosophy: { start: '#4c1d95', end: '#1e1b4b' },
  'Art & Aesthetics': { start: '#831843', end: '#3b0764' },
  'Self-Improvement': { start: '#065f46', end: '#064e3b' },
  Software: { start: '#0e7490', end: '#083344' },
  History: { start: '#7c2d12', end: '#451a03' },
  'Sociocracy & Governance': { start: '#0f766e', end: '#042f2e' },
  'Indigenous Religion': { start: '#92400e', end: '#451a03' },
  'Plant Medicine': { start: '#166534', end: '#052e16' },
  Nature: { start: '#15803d', end: '#14532d' },
};

async function generateCover(bookPath, title, author, category) {
  const fullBookDir = path.join(LIBRARY_DIR, bookPath);
  fs.mkdirSync(fullBookDir, { recursive: true });
  const coverPath = path.join(fullBookDir, 'cover.jpg');

  const color = PALETTES[category] || { start: '#1e293b', end: '#0f172a' };

  const escapeXml = (str) =>
    str.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
      }
    });

  const cleanTitle = escapeXml(title);
  const cleanAuthor = escapeXml(author);
  const cleanCategory = escapeXml(category.toUpperCase());

  const words = cleanTitle.split(' ');
  const lines = [];
  let currentLine = '';
  for (const w of words) {
    if ((currentLine + ' ' + w).length > 20) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = w;
    } else {
      currentLine += ' ' + w;
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  const titleSvgText = lines
    .slice(0, 4)
    .map((l, idx) => `<text x="50%" y="${180 + idx * 38}" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">${l}</text>`)
    .join('\n');

  const svg = `
  <svg width="400" height="600" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color.start}" />
        <stop offset="100%" stop-color="${color.end}" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="15%" r="65%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="400" height="600" fill="url(#bgGrad)" />
    <rect width="400" height="600" fill="url(#glow)" />
    <rect x="25" y="25" width="350" height="550" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" rx="4" />
    
    <rect x="50" y="55" width="300" height="28" rx="14" fill="rgba(255,255,255,0.1)" />
    <text x="50%" y="74" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" letter-spacing="2.5" fill="#e2e8f0" text-anchor="middle">${cleanCategory}</text>
    
    ${titleSvgText}
    
    <line x1="130" y1="360" x2="270" y2="360" stroke="rgba(255,255,255,0.3)" stroke-width="2" />
    
    <text x="50%" y="415" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500" fill="#cbd5e1" text-anchor="middle">${cleanAuthor}</text>
    
    <text x="50%" y="535" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" letter-spacing="3" fill="rgba(255,255,255,0.4)" text-anchor="middle">SKALYBR CURATED EDITION</text>
  </svg>
  `;

  await sharp(Buffer.from(svg))
    .jpeg({ quality: 90 })
    .toFile(coverPath);
}

// Write dummy ebook files
function writeDummyBookFiles(bookPath, title, author, formats) {
  const fullBookDir = path.join(LIBRARY_DIR, bookPath);
  fs.mkdirSync(fullBookDir, { recursive: true });

  const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '');
  const safeAuthor = author.replace(/[/\\?%*:|"<>]/g, '');

  formats.forEach((fmt) => {
    const ext = fmt.toLowerCase();
    const filePath = path.join(fullBookDir, `${safeTitle} - ${safeAuthor}.${ext}`);
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `Skalybr Demo E-Book Sample: ${title} by ${author} (${fmt})\n`);
    }
  });
}

// Curated Real Books Database across 10 disciplines (490 real books total)
import { REAL_BOOKS } from './demo-books-dataset.mjs';

console.log(`Inserting ${REAL_BOOKS.length} curated real books into Calibre library...`);

const insertBookStmt = db.prepare(`
  INSERT INTO books (title, sort, author_sort, pubdate, has_cover, path, uuid, isbn)
  VALUES (?, ?, ?, ?, 1, ?, ?, ?)
`);

const insertCommentStmt = db.prepare('INSERT INTO comments (book, text) VALUES (?, ?)');
const insertIdentStmt = db.prepare('INSERT INTO identifiers (book, type, val) VALUES (?, ?, ?)');
const insertDataStmt = db.prepare('INSERT INTO data (book, format, uncompressed_size, name) VALUES (?, ?, ?, ?)');
const linkAuthorStmt = db.prepare('INSERT INTO books_authors_link (book, author) VALUES (?, ?)');
const linkTagStmt = db.prepare('INSERT INTO books_tags_link (book, tag) VALUES (?, ?)');
const linkPubStmt = db.prepare('INSERT INTO books_publishers_link (book, publisher) VALUES (?, ?)');
const linkLangStmt = db.prepare('INSERT INTO books_languages_link (book, lang_code) VALUES (?, ?)');
const linkRatingStmt = db.prepare('INSERT INTO books_ratings_link (book, rating) VALUES (?, ?)');
const linkSeriesStmt = db.prepare('INSERT INTO books_series_link (book, series, series_index) VALUES (?, ?, ?)');
const linkColStmt = db.prepare('INSERT INTO books_custom_column_1_link (book, value) VALUES (?, ?)');

const colIndexMap = new Map();
COLLECTIONS.forEach((col, idx) => colIndexMap.set(col, idx + 1));

async function main() {
  const insertAll = db.transaction(() => {
    let bookId = 0;
    for (const item of REAL_BOOKS) {
      bookId++;
      const authorSort = item.authors[0].split(' ').reverse().join(', ');
      const titleSort = item.title.replace(/^(The|A|An)\s+/i, '');
      const safeAuthor = item.authors[0].replace(/[/\\?%*:|"<>]/g, '');
      const safeTitle = item.title.replace(/[/\\?%*:|"<>]/g, '');
      const relPath = `${safeAuthor}/${safeTitle} (${bookId})`;
      const uuid = `skalybr-demo-${bookId}-${Date.now().toString(36)}`;
      const pubdate = item.pubdate || '2020-01-01 00:00:00+00:00';
      const isbn = item.isbn || `978-${Math.floor(1000000000 + Math.random() * 9000000000)}`;

      insertBookStmt.run(item.title, titleSort, authorSort, pubdate, relPath, uuid, isbn);

      // Authors
      for (const a of item.authors) {
        const aId = getOrCreateAuthor(a);
        linkAuthorStmt.run(bookId, aId);
      }

      // Tags
      for (const t of item.tags) {
        const tId = getOrCreateTag(t);
        linkTagStmt.run(bookId, tId);
      }

      // Category Tag
      const catTagId = getOrCreateTag(item.category);
      linkTagStmt.run(bookId, catTagId);

      // Publisher
      if (item.publisher) {
        const pId = getOrCreatePublisher(item.publisher);
        linkPubStmt.run(bookId, pId);
      }

      // Series
      if (item.series) {
        const sId = getOrCreateSeries(item.series);
        linkSeriesStmt.run(bookId, sId, item.seriesIndex || 1.0);
      }

      // Language
      const lId = getOrCreateLang(item.language || 'eng');
      linkLangStmt.run(bookId, lId);

      // Rating
      if (item.rating) {
        const rId = getOrCreateRating(item.rating);
        linkRatingStmt.run(bookId, rId);
      }

      // Description / Comments
      if (item.description) {
        insertCommentStmt.run(bookId, `<p>${item.description}</p>`);
      }

      // Identifiers
      insertIdentStmt.run(bookId, 'isbn', isbn);

      // Collection
      if (item.collection && colIndexMap.has(item.collection)) {
        const colId = colIndexMap.get(item.collection);
        linkColStmt.run(bookId, colId);
      }

      // Formats & Data entries
      const formats = item.formats || ['EPUB', 'PDF'];
      for (const fmt of formats) {
        const size = Math.floor(1500000 + Math.random() * 8000000);
        insertDataStmt.run(bookId, fmt, size, `${safeTitle} - ${safeAuthor}`);
      }

      // Write files and cover
      writeDummyBookFiles(relPath, item.title, item.authors[0], formats);
    }
  });

  insertAll();

  console.log('Generating dynamic book covers via Sharp...');
  let count = 0;
  for (const item of REAL_BOOKS) {
    count++;
    const safeAuthor = item.authors[0].replace(/[/\\?%*:|"<>]/g, '');
    const safeTitle = item.title.replace(/[/\\?%*:|"<>]/g, '');
    const relPath = `${safeAuthor}/${safeTitle} (${count})`;
    await generateCover(relPath, item.title, item.authors.join(' & '), item.category);
    if (count % 100 === 0) {
      console.log(`Generated ${count} / ${REAL_BOOKS.length} covers...`);
    }
  }

  console.log(`✅ Successfully generated demo library with ${REAL_BOOKS.length} books at ${LIBRARY_DIR}!`);
}

main().catch(console.error);
