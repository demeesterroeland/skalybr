import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const TARGET_BASE_DIR = path.resolve(process.cwd(), 'demo');
const LIBRARY_NAME = 'large';
const LIBRARY_DIR = path.join(TARGET_BASE_DIR, LIBRARY_NAME);
const DB_PATH = path.join(LIBRARY_DIR, 'metadata.db');

console.log(`[Large Demo Generator] Target directory: ${LIBRARY_DIR}`);

// Ensure demo directory exists
fs.mkdirSync(LIBRARY_DIR, { recursive: true });

if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
}

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');

// 1. Create Complete Calibre Schema
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
  has_cover BOOL DEFAULT 1,
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

CREATE INDEX IF NOT EXISTS books_idx ON books (sort COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS authors_idx ON authors (name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS tags_idx ON tags (name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS series_idx ON series (name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS publishers_idx ON publishers (name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS bal_idx ON books_authors_link (book, author);
CREATE INDEX IF NOT EXISTS btl_idx ON books_tags_link (book, tag);
CREATE INDEX IF NOT EXISTS bsl_idx ON books_series_link (book, series);
CREATE INDEX IF NOT EXISTS bpl_idx ON books_publishers_link (book, publisher);
CREATE INDEX IF NOT EXISTS data_idx ON data (book, format);
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
  'Cyberpunk & Posthumanism',
  'Quantum Realism & Cosmology',
];

const colStmt = db.prepare('INSERT INTO custom_column_1 (id, value) VALUES (?, ?)');
COLLECTIONS.forEach((col, idx) => colStmt.run(idx + 1, col));

// 2. 500 Realistic Authors Across Diverse Eras & Disciplines
const FAMOUS_AUTHORS = [
  // Science Fiction & Speculative
  'Isaac Asimov', 'Arthur C. Clarke', 'Philip K. Dick', 'Ursula K. Le Guin', 'Frank Herbert',
  'William Gibson', 'Octavia Butler', 'Stanislaw Lem', 'Ted Chiang', 'Cixin Liu',
  'Brandon Sanderson', 'Neil Gaiman', 'Terry Pratchett', 'J.R.R. Tolkien', 'Dan Simmons',
  'Greg Egan', 'Vernor Vinge', 'Iain M. Banks', 'Alastair Reynolds', 'Neal Stephenson',
  'Ray Bradbury', 'H.G. Wells', 'Jules Verne', 'Robert A. Heinlein', 'Gene Wolfe',
  'Kim Stanley Robinson', 'Ann Leckie', 'N.K. Jemisin', 'Adrian Tchaikovsky', 'Peter Watts',
  'Arkady Martine', 'Martha Wells', 'Jeff VanderMeer', 'China Miéville', 'Charles Stross',
  'Cory Doctorow', 'Paolo Bacigalupi', 'Hugh Howey', 'James S.A. Corey', 'John Scalzi',
  
  // Computer Science & Software Craft
  'Donald Knuth', 'Alan Turing', 'Edsger W. Dijkstra', 'Grace Hopper', 'Claude Shannon',
  'Leslie Lamport', 'Martin Fowler', 'Robert C. Martin', 'Kent Beck', 'Linus Torvalds',
  'John Carmack', 'Rich Hickey', 'Douglas Hofstadter', 'Brian Kernighan', 'Dennis Ritchie',
  'Ken Thompson', 'Bjarne Stroustrup', 'Andrew Tanenbaum', 'Harold Abelson', 'Gerald Jay Sussman',
  'Donald Norman', 'Fred Brooks', 'Erich Gamma', 'Richard Helm', 'Ralph Johnson',
  'John Vlissides', 'Michael Feathers', 'Eric Evans', 'Sandi Metz', 'Martin Odersky',
  
  // Philosophy & Existential Thought
  'Friedrich Nietzsche', 'Jean-Paul Sartre', 'Albert Camus', 'Simone de Beauvoir', 'Hannah Arendt',
  'Ludwig Wittgenstein', 'Michel Foucault', 'Gilles Deleuze', 'Jacques Derrida', 'Baruch Spinoza',
  'Arthur Schopenhauer', 'Søren Kierkegaard', 'Immanuel Kant', 'Georg Wilhelm Friedrich Hegel', 'René Descartes',
  'Thomas Aquinas', 'Marcus Aurelius', 'Seneca', 'Epictetus', 'Plato',
  'Aristotle', 'Heraclitus', 'Laozi', 'Zhuangzi', 'Nagarjuna',
  'Bertrand Russell', 'Karl Popper', 'Thomas Kuhn', 'Paul Feyerabend', 'Slavoj Žižek',
  
  // Science, Physics & Mathematics
  'Albert Einstein', 'Richard Feynman', 'Carl Sagan', 'Stephen Hawking', 'Marie Curie',
  'Charles Darwin', 'Kurt Gödel', 'Ada Lovelace', 'Paul Erdős', 'Norbert Wiener',
  'Erwin Schrödinger', 'Werner Heisenberg', 'Niels Bohr', 'Max Planck', 'James Clerk Maxwell',
  'Roger Penrose', 'Carlo Rovelli', 'David Deutsch', 'Sean Carroll', 'Brian Greene',
  'Douglas Adams', 'E.O. Wilson', 'Jane Goodall', 'Richard Dawkins', 'Stephen Jay Gould',
  'Ilya Prigogine', 'Benoit Mandelbrot', 'Stanislas Dehaene', 'Antonio Damasio', 'Oliver Sacks',
  
  // History & Civilization
  'Yuval Noah Harari', 'Jared Diamond', 'Howard Zinn', 'Edward Said', 'Will Durant',
  'Barbara Tuchman', 'David Graeber', 'Eric Hobsbawm', 'Fernand Braudel', 'Arnold J. Toynbee',
  'William Dalrymple', 'Timothy Snyder', 'Tony Judt', 'Peter Frankopan', 'Niall Ferguson',
  'Mary Beard', 'Tom Holland', 'Simon Schama', 'David Wengrow', 'Rutger Bregman',
  
  // Literature, Essays & Poetry
  'Leo Tolstoy', 'Fyodor Dostoevsky', 'Jane Austen', 'Virginia Woolf', 'James Joyce',
  'Marcel Proust', 'Franz Kafka', 'Emily Dickinson', 'Gabriel García Márquez', 'Jorge Luis Borges',
  'Herman Melville', 'Walt Whitman', 'T.S. Eliot', 'Rainer Maria Rilke', 'Italo Calvino',
  'Umberto Eco', 'Milan Kundera', 'Haruki Murakami', 'Yukio Mishima', 'Kenzaburo Oe',
  'W.G. Sebald', 'Cormac McCarthy', 'Don DeLillo', 'Thomas Pynchon', 'David Foster Wallace',
  'Margaret Atwood', 'Toni Morrison', 'Chimamanda Ngozi Adichie', 'Kazuo Ishiguro', 'J.M. Coetzee',
  
  // Ecology, Wisdom & Systems
  'Robin Wall Kimmerer', 'Wade Davis', 'Terence McKenna', 'Michael Pollan', 'Aldous Huxley',
  'Alan Watts', 'Gregory Bateson', 'Donella Meadows', 'Fritjof Capra', 'Vandana Shiva',
  'Suzanne Simard', 'Merlin Sheldrake', 'James Lovelock', 'Lynn Margulis', 'Peter Wohlleben',
  'Barry Lopez', 'Gary Snyder', 'Wendell Berry', 'Rachel Carson', 'Aldo Leopold'
];

// Generate remainder of 500 authors with realistic global names
const FIRST_NAMES = [
  'Alexander', 'Elena', 'Marcus', 'Sophia', 'Julian', 'Claire', 'David', 'Miriam',
  'Adrian', 'Astrid', 'Matteo', 'Amara', 'Lucas', 'Freja', 'Siddharth', 'Fatima',
  'Nikolai', 'Ingrid', 'Gabriel', 'Zoe', 'Henrik', 'Leila', 'Tariq', 'Camille',
  'Sebastian', 'Noor', 'Dmitri', 'Ananya', 'Felix', 'Valentina', 'Mateo', 'Klara',
  'Johan', 'Aria', 'Kenji', 'Mei', 'Hiroshi', 'Yuki', 'Sunil', 'Priya',
  'Elias', 'Soren', 'Thalia', 'Rowan', 'Arlo', 'Seraphina', 'Magnus', 'Lyra'
];

const LAST_NAMES = [
  'Vance', 'Lindqvist', 'Moreau', 'Kowalski', 'Novak', 'Castillo', 'Abebe', 'Nakamura',
  'O\'Connor', 'Thorvaldsen', 'Schneider', 'Petrov', 'Choudhury', 'Al-Mansoor', 'De Vries',
  'Mercier', 'Bergstrom', 'Fontana', 'Haddad', 'Takahashi', 'Ivanov', 'Reyes',
  'Svensson', 'Dubois', 'Kaufmann', 'Solovyov', 'Bhattacharya', 'Larsson', 'Mendoza',
  'Olsen', 'Navarro', 'Holloway', 'Sinclair', 'Fairfax', 'Pendleton', 'Hawthorne',
  'Sterling', 'Blackwood', 'Montague', 'Ashford', 'Winterbourne', 'Kingsley', 'Somerset'
];

const ALL_AUTHORS = [...FAMOUS_AUTHORS];
let fIdx = 0;
let lIdx = 0;
while (ALL_AUTHORS.length < 500) {
  const name = `${FIRST_NAMES[fIdx % FIRST_NAMES.length]} ${LAST_NAMES[lIdx % LAST_NAMES.length]}`;
  if (!ALL_AUTHORS.includes(name)) {
    ALL_AUTHORS.push(name);
  }
  fIdx++;
  if (fIdx % FIRST_NAMES.length === 0) lIdx++;
}

console.log(`[Large Demo Generator] Prepared ${ALL_AUTHORS.length} unique authors.`);

// 3. Procedural Title Generation Components
const TITLE_PREFIXES = [
  'The Architecture of', 'Principles of', 'The Nature of', 'Foundations of',
  'A Treatise on', 'The Dynamics of', 'Exploring', 'The Anatomy of',
  'Beyond', 'The Future of', 'Conversations on', 'The Art of',
  'Mastering', 'Reflections on', 'The Evolution of', 'Understanding',
  'A Journey Through', 'The Science of', 'The Geometry of', 'Echoes of',
  'The Book of', 'Chronicles of', 'Studies in', 'The Paradox of',
  'Structures of', 'The Symphony of', 'Rethinking', 'The Elements of'
];

const TITLE_CORE_NOUNS = [
  'Consciousness', 'Distributed Systems', 'Quantum Mechanics', 'Deep Time',
  'Living Networks', 'Cognitive Flux', 'Emergent Complexity', 'Cybernetic Form',
  'Modern Philosophy', 'Silent Thought', 'Sacred Geometries', 'Ecological Balance',
  'Neural Landscapes', 'Digital Sovereignty', 'Artificial Minds', 'Planetary Futures',
  'The Void', 'Cosmic Harmony', 'Memory and Myth', 'Autonomous Worlds',
  'Perception', 'Parallel Realities', 'The Quantum Mind', 'Collective Intelligence',
  'Temporal Drift', 'The Infinite Canvas', 'Algorithmic Beauty', 'Deep Ecology',
  'Social Architecture', 'Living Language', 'The Hidden Cosmos', 'Molecular Elegance'
];

const TITLE_SUFFIXES = [
  'in the Digital Age', 'for the Modern Mind', 'Across Space and Time',
  'and the Quest for Meaning', 'in an Interconnected World', 'from First Principles',
  'A Critical Investigation', 'Essays and Dialogues', 'A Comprehensive Survey',
  'in Practice and Theory', 'and Other Paradoxes', 'A Manifesto for Tomorrow',
  'Vol. I', 'Vol. II', 'Selected Writings', 'The Definitive Guide'
];

const FICTION_NOUNS = [
  'Shadow', 'Empire', 'Singularity', 'Prophet', 'Starlight', 'Eclipse',
  'Nexus', 'Labyrinth', 'Vortex', 'Leviathan', 'Citadel', 'Oasis',
  'Nebula', 'Chronicle', 'Horizon', 'Threshold', 'Voyager', 'Sanctuary',
  'Archipelago', 'Abyss', 'Genesis', 'Specter', 'Tesseract', 'Mirage'
];

const FICTION_MODIFIERS = [
  'Fractured', 'Obsidian', 'Infinite', 'Celestial', 'Silent', 'Forgotten',
  'Quantum', 'Sovereign', 'Synthetic', 'Emerald', 'Spectral', 'Iron',
  'Crimson', 'Hollow', 'Radiant', 'Frozen', 'Ephemeral', 'Subterranean'
];

const SERIES_NAMES = [
  'The Foundation Continuum', 'Sprawl Archives', 'The Culture Cycle',
  'Mars Terraforming Annals', 'Hyperion Chronicles', 'Metamathematics Series',
  'The Distributed Systems Tracts', 'Chronicles of Deep Time', 'Cognitive Frontiers',
  'The Quantum Paradox Saga', 'Ecology of Mind', 'Posthuman Dialogues',
  'The Stellar Expanse', 'Solaris Investigations', 'The Silicon Horizon',
  'Voices of Earthsea', 'The Remembrance Sequence', 'Antigravity Monographs',
  'The Alexandria Project', 'Algorithms of Antiquity', 'Philosophy in Action',
  'The Nomadic Mind', 'The Permaculture Codex', 'Sovereign Systems'
];

const TAGS = [
  'Science Fiction', 'Computer Science', 'Philosophy', 'Physics', 'Mathematics',
  'Cyberpunk', 'Space Opera', 'Artificial Intelligence', 'Ecology', 'History',
  'Cognitive Science', 'Essays', 'Complexity', 'Systems Architecture', 'Biography',
  'Evolution', 'Poetry', 'Economics', 'Sociology', 'Anthropology', 'Art & Design',
  'Mindfulness', 'Quantum Computing', 'Epistemology', 'Ethics', 'Non-Fiction',
  'Speculative Fiction', 'Distributed Systems', 'Software Engineering', 'Neuroscience'
];

const PUBLISHERS = [
  'MIT Press', 'O\'Reilly Media', 'Tor Books', 'Penguin Classics', 'Harper Voyager',
  'Vintage Books', 'Oxford University Press', 'Cambridge University Press', 'Faber & Faber',
  'Verso', 'Basic Books', 'W.W. Norton', 'Farrar, Straus and Giroux', 'Gollancz',
  'Addison-Wesley', 'Pragmatic Bookshelf', 'No Starch Press', 'Zone Books', 'Semiotext(e)'
];

// Pre-create Maps for caching database IDs
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

const ratings = [2, 4, 6, 8, 10]; // 1, 2, 3, 4, 5 stars
const ratingIdMap = new Map();
ratings.forEach((val) => {
  const res = db.prepare('INSERT INTO ratings (rating) VALUES (?)').run(val);
  ratingIdMap.set(val, res.lastInsertRowid);
});

// Seed all 500 authors upfront
console.log(`[Large Demo Generator] Seeding 500 authors into database...`);
ALL_AUTHORS.forEach((a) => getOrCreateAuthor(a));

// 4. Generate ~12 Beautiful Distinct SVG Covers for Category Palettes
const PALETTES = [
  { name: 'Technology', start: '#1e3a8a', end: '#0f172a' },
  { name: 'Philosophy', start: '#4c1d95', end: '#1e1b4b' },
  { name: 'Art', start: '#831843', end: '#3b0764' },
  { name: 'Self-Mastery', start: '#065f46', end: '#064e3b' },
  { name: 'Software', start: '#0e7490', end: '#083344' },
  { name: 'History', start: '#7c2d12', end: '#451a03' },
  { name: 'Governance', start: '#0f766e', end: '#042f2e' },
  { name: 'Cosmology', start: '#312e81', end: '#1e1b4b' },
  { name: 'Deep Ecology', start: '#166534', end: '#052e16' },
  { name: 'Cyberpunk', start: '#991b1b', end: '#450a0a' },
  { name: 'Quantum', start: '#581c87', end: '#2e1065' },
  { name: 'Classic', start: '#334155', end: '#0f172a' }
];

console.log(`[Large Demo Generator] Pre-rendering ${PALETTES.length} palette master covers...`);
const coverBuffers = [];

for (const p of PALETTES) {
  const svg = `
  <svg width="400" height="600" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${p.start}" />
        <stop offset="100%" stop-color="${p.end}" />
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
    <text x="50%" y="74" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" letter-spacing="2.5" fill="#e2e8f0" text-anchor="middle">${p.name.toUpperCase()}</text>
    <circle cx="200" cy="240" r="45" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" />
    <path d="M 180 240 L 220 240 M 200 220 L 200 260" stroke="rgba(255,255,255,0.4)" stroke-width="2" />
    <line x1="130" y1="360" x2="270" y2="360" stroke="rgba(255,255,255,0.3)" stroke-width="2" />
    <text x="50%" y="415" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500" fill="#cbd5e1" text-anchor="middle">SKALYBR CURATED</text>
    <text x="50%" y="535" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" letter-spacing="3" fill="rgba(255,255,255,0.4)" text-anchor="middle">LARGE DEMO EDITION</text>
  </svg>`;
  
  const buf = await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer();
  coverBuffers.push(buf);
}

// 5. Prepared Statements for Maximum Bulk Insert Performance
const insertBookStmt = db.prepare(`
  INSERT INTO books (id, title, sort, author_sort, pubdate, has_cover, path, uuid, isbn)
  VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
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

const TOTAL_BOOKS = 10000;
console.log(`[Large Demo Generator] Generating ${TOTAL_BOOKS} books across 500 authors...`);

const sampleEpubBuffer = Buffer.from('PK\x03\x04\x14\x00\x00\x00\x08\x00mimetypeapplication/epub+zipSkalybr Large Demo E-Book Sample\n');

const startTime = Date.now();

// 6. Execute Bulk Inserts in One Atomic SQLite Transaction
const generateDatabaseRecords = db.transaction(() => {
  for (let id = 1; id <= TOTAL_BOOKS; id++) {
    // Select primary author (and optional co-author)
    const authorIndex = (id - 1) % ALL_AUTHORS.length;
    const authorName = ALL_AUTHORS[authorIndex];
    const authorId = authorMap.get(authorName);
    const authorSort = authorName.split(' ').reverse().join(', ');

    // Procedural Title Generation
    let title = '';
    const style = id % 3;
    if (style === 0) {
      const prefix = TITLE_PREFIXES[(id * 7) % TITLE_PREFIXES.length];
      const noun = TITLE_CORE_NOUNS[(id * 13) % TITLE_CORE_NOUNS.length];
      const suffix = (id % 5 === 0) ? ` ${TITLE_SUFFIXES[(id * 3) % TITLE_SUFFIXES.length]}` : '';
      title = `${prefix} ${noun}${suffix}`;
    } else if (style === 1) {
      const mod = FICTION_MODIFIERS[(id * 11) % FICTION_MODIFIERS.length];
      const noun = FICTION_NOUNS[(id * 17) % FICTION_NOUNS.length];
      title = `The ${mod} ${noun}`;
    } else {
      const noun1 = TITLE_CORE_NOUNS[(id * 5) % TITLE_CORE_NOUNS.length];
      const noun2 = FICTION_NOUNS[(id * 19) % FICTION_NOUNS.length];
      title = `${noun1} of the ${noun2}`;
    }

    const titleSort = title.replace(/^(The|A|An)\s+/i, '');
    const safeAuthor = authorName.replace(/[/\\?%*:|"<>]/g, '');
    const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '').slice(0, 50);
    const relPath = `${safeAuthor}/${safeTitle} (${id})`;
    const uuid = `skalybr-large-${id}-${id.toString(36)}`;
    const year = 1950 + (id % 76);
    const pubdate = `${year}-0${(id % 9) + 1}-15 00:00:00+00:00`;
    const isbn = `978-${Math.floor(1000000000 + ((id * 7919) % 9000000000))}`;

    insertBookStmt.run(id, title, titleSort, authorSort, pubdate, relPath, uuid, isbn);

    // Link Author
    linkAuthorStmt.run(id, authorId);
    // 10% of books have a second co-author
    if (id % 10 === 0) {
      const coAuthorName = ALL_AUTHORS[(authorIndex + 23) % ALL_AUTHORS.length];
      const coAuthorId = authorMap.get(coAuthorName);
      linkAuthorStmt.run(id, coAuthorId);
    }

    // Link Tags (2 to 4 tags per book)
    const tag1 = TAGS[id % TAGS.length];
    const tag2 = TAGS[(id * 3) % TAGS.length];
    linkTagStmt.run(id, getOrCreateTag(tag1));
    if (tag1 !== tag2) {
      linkTagStmt.run(id, getOrCreateTag(tag2));
    }

    // Link Series (~40% of books belong to a series)
    if (id % 5 !== 0) {
      const seriesName = SERIES_NAMES[id % SERIES_NAMES.length];
      const seriesId = getOrCreateSeries(seriesName);
      const seriesIndex = ((Math.floor(id / SERIES_NAMES.length) % 10) + 1) * 1.0;
      linkSeriesStmt.run(id, seriesId, seriesIndex);
    }

    // Link Publisher
    const publisherName = PUBLISHERS[id % PUBLISHERS.length];
    linkPubStmt.run(id, getOrCreatePublisher(publisherName));

    // Link Language (95% eng, 5% others)
    const langCode = id % 20 === 0 ? (id % 40 === 0 ? 'fra' : 'deu') : 'eng';
    linkLangStmt.run(id, getOrCreateLang(langCode));

    // Link Rating
    const ratingVal = ratings[id % ratings.length];
    linkRatingStmt.run(id, ratingIdMap.get(ratingVal));

    // Synopsis
    const synopsis = `<p>An authoritative and thought-provoking exploration of <strong>${title}</strong> by ${authorName}. Explores the intersections of ${tag1} and systemic evolution across the modern intellectual landscape.</p>`;
    insertCommentStmt.run(id, synopsis);

    // Identifiers
    insertIdentStmt.run(id, 'isbn', isbn);

    // Custom Collection
    const colIndex = (id % COLLECTIONS.length) + 1;
    linkColStmt.run(id, colIndex);

    // Formats: EPUB (all books), PDF (50% of books)
    const epubSize = Math.floor(1200000 + ((id * 313) % 4000000));
    insertDataStmt.run(id, 'EPUB', epubSize, `${safeTitle} - ${safeAuthor}`);
    if (id % 2 === 0) {
      const pdfSize = Math.floor(3500000 + ((id * 521) % 8000000));
      insertDataStmt.run(id, 'PDF', pdfSize, `${safeTitle} - ${safeAuthor}`);
    }
  }
});

generateDatabaseRecords();
const dbTime = Date.now();
console.log(`[Large Demo Generator] SQLite database initialized in ${(dbTime - startTime) / 1000}s.`);

// 7. Write Filesystem Book Directories & Covers
console.log(`[Large Demo Generator] Creating 10,000 book directories, covers, and EPUB files...`);

for (let id = 1; id <= TOTAL_BOOKS; id++) {
  const authorIndex = (id - 1) % ALL_AUTHORS.length;
  const authorName = ALL_AUTHORS[authorIndex];
  const safeAuthor = authorName.replace(/[/\\?%*:|"<>]/g, '');

  let title = '';
  const style = id % 3;
  if (style === 0) {
    const prefix = TITLE_PREFIXES[(id * 7) % TITLE_PREFIXES.length];
    const noun = TITLE_CORE_NOUNS[(id * 13) % TITLE_CORE_NOUNS.length];
    const suffix = (id % 5 === 0) ? ` ${TITLE_SUFFIXES[(id * 3) % TITLE_SUFFIXES.length]}` : '';
    title = `${prefix} ${noun}${suffix}`;
  } else if (style === 1) {
    const mod = FICTION_MODIFIERS[(id * 11) % FICTION_MODIFIERS.length];
    const noun = FICTION_NOUNS[(id * 17) % FICTION_NOUNS.length];
    title = `The ${mod} ${noun}`;
  } else {
    const noun1 = TITLE_CORE_NOUNS[(id * 5) % TITLE_CORE_NOUNS.length];
    const noun2 = FICTION_NOUNS[(id * 19) % FICTION_NOUNS.length];
    title = `${noun1} of the ${noun2}`;
  }

  const safeTitle = title.replace(/[/\\?%*:|"<>]/g, '').slice(0, 50);
  const fullBookDir = path.join(LIBRARY_DIR, safeAuthor, `${safeTitle} (${id})`);
  fs.mkdirSync(fullBookDir, { recursive: true });

  // Write cover.jpg using one of the pre-rendered palette master covers
  const coverBuffer = coverBuffers[id % coverBuffers.length];
  fs.writeFileSync(path.join(fullBookDir, 'cover.jpg'), coverBuffer);

  // Write dummy EPUB sample
  fs.writeFileSync(path.join(fullBookDir, `${safeTitle} - ${safeAuthor}.epub`), sampleEpubBuffer);

  if (id % 2000 === 0) {
    console.log(`[Large Demo Generator] Written ${id} / ${TOTAL_BOOKS} book folders...`);
  }
}

const totalTime = Date.now();
console.log(`✅ [Large Demo Generator] Successfully generated 10,000 books and 500 authors in ${(totalTime - startTime) / 1000}s!`);
console.log(`Database: ${DB_PATH}`);
db.close();
