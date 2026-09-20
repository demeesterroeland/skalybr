import fs from 'fs';
import path from 'path';
import { getDatabaseConnection } from './db';
import { DEFAULT_CALIBRE_BASE_DIR, getLibraryPath } from '../config';
import { BookFlattened, BookListResponse, BookQueryOptions, LibraryInfo, UpdateBookInput } from '../types';

export class FlatBookRepository {
  private libraryPath: string;

  constructor(libraryName?: string) {
    this.libraryPath = getLibraryPath(libraryName);
  }

  public static listAvailableLibraries(baseDir: string = DEFAULT_CALIBRE_BASE_DIR): LibraryInfo[] {
    if (!fs.existsSync(baseDir)) return [];

    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const libraries: LibraryInfo[] = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const dbPath = path.join(baseDir, entry.name, 'metadata.db');
        if (fs.existsSync(dbPath)) {
          try {
            const db = getDatabaseConnection(path.join(baseDir, entry.name));
            const countRow = db.prepare('SELECT count(*) as count FROM books').get() as { count: number };
            const customColRow = db.prepare('SELECT count(*) as count FROM custom_columns').get() as { count: number };

            libraries.push({
              name: entry.name,
              path: path.join(baseDir, entry.name),
              bookCount: countRow.count,
              hasCustomColumns: customColRow.count > 0,
            });
          } catch (e) {
            // Skip unreadable databases
          }
        }
      }
    }

    return libraries.sort((a, b) => b.bookCount - a.bookCount);
  }

  public getBooks(options: BookQueryOptions = {}): BookListResponse {
    const db = getDatabaseConnection(this.libraryPath);
    const page = Math.max(1, options.page || 1);
    const pageSize = Math.min(100, Math.max(1, options.pageSize || 30));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = ['1=1'];
    const params: any[] = [];

    if (options.search) {
      conditions.push('(title LIKE ? OR authors LIKE ? OR tags LIKE ? OR series_name LIKE ?)');
      const q = `%${options.search}%`;
      params.push(q, q, q, q);
    }

    if (options.author) {
      conditions.push('authors LIKE ?');
      params.push(`%${options.author}%`);
    }

    if (options.authors && options.authors.length > 0) {
      const orClauses = options.authors.map(() => 'authors LIKE ?');
      conditions.push(`(${orClauses.join(' OR ')})`);
      options.authors.forEach((a) => params.push(`%${a}%`));
    }

    if (options.tag) {
      conditions.push('tags LIKE ?');
      params.push(`%${options.tag}%`);
    }

    if (options.tags && options.tags.length > 0) {
      const orClauses = options.tags.map(() => 'tags LIKE ?');
      conditions.push(`(${orClauses.join(' OR ')})`);
      options.tags.forEach((t) => params.push(`%${t}%`));
    }

    if (options.series) {
      conditions.push('series_name = ?');
      params.push(options.series);
    }

    if (options.seriesList && options.seriesList.length > 0) {
      const placeholders = options.seriesList.map(() => '?').join(', ');
      conditions.push(`series_name IN (${placeholders})`);
      params.push(...options.seriesList);
    }

    if (options.collection) {
      conditions.push('collection = ?');
      params.push(options.collection);
    }

    if (options.collections && options.collections.length > 0) {
      const placeholders = options.collections.map(() => '?').join(', ');
      conditions.push(`collection IN (${placeholders})`);
      params.push(...options.collections);
    }

    if (options.publisher) {
      conditions.push('publisher LIKE ?');
      params.push(`%${options.publisher}%`);
    }

    if (options.publishers && options.publishers.length > 0) {
      const orClauses = options.publishers.map(() => 'publisher LIKE ?');
      conditions.push(`(${orClauses.join(' OR ')})`);
      options.publishers.forEach((p) => params.push(`%${p}%`));
    }

    if (options.language) {
      conditions.push('language = ?');
      params.push(options.language);
    }

    if (options.languages && options.languages.length > 0) {
      const placeholders = options.languages.map(() => '?').join(', ');
      conditions.push(`language IN (${placeholders})`);
      params.push(...options.languages);
    }

    if (options.format) {
      conditions.push('formats LIKE ?');
      params.push(`%${options.format}%`);
    }

    if (options.formats && options.formats.length > 0) {
      const orClauses = options.formats.map(() => 'formats LIKE ?');
      conditions.push(`(${orClauses.join(' OR ')})`);
      options.formats.forEach((f) => params.push(`%${f}%`));
    }

    if (options.rating !== undefined) {
      conditions.push('rating >= ?');
      params.push(options.rating);
    }

    if (options.ratings && options.ratings.length > 0) {
      const placeholders = options.ratings.map(() => '?').join(', ');
      conditions.push(`rating IN (${placeholders})`);
      params.push(...options.ratings);
    }

    const whereClause = conditions.join(' AND ');

    // Sorting
    let orderBy = 'id DESC';
    const order = options.order?.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    if (options.sort === 'title') {
      orderBy = `title_sort ${order}`;
    } else if (options.sort === 'authors') {
      orderBy = `author_sort ${order}`;
    } else if (options.sort === 'pubdate') {
      orderBy = `pubdate ${order}`;
    } else if (options.sort === 'rating') {
      orderBy = `rating ${order}`;
    } else {
      orderBy = `id ${order}`;
    }

    // Total count query
    const totalRow = db
      .prepare(`SELECT count(*) as count FROM v_books_flattened WHERE ${whereClause}`)
      .get(...params) as { count: number };
    const total = totalRow.count;

    // Data query
    const dataSql = `
      SELECT 
        id, title, title_sort as titleSort, author_sort as authorSort,
        timestamp, pubdate, has_cover as hasCover, path, uuid, isbn,
        authors, series_name as seriesName, series_index as seriesIndex,
        tags, publisher, language, rating, description, formats, collection
      FROM v_books_flattened
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const rows = db.prepare(dataSql).all(...params, pageSize, offset) as any[];

    const books: BookFlattened[] = rows.map((r) => ({
      id: r.id,
      title: r.title,
      titleSort: r.titleSort,
      authorSort: r.authorSort,
      timestamp: r.timestamp,
      pubdate: r.pubdate,
      hasCover: Boolean(r.hasCover),
      path: r.path,
      uuid: r.uuid,
      isbn: r.isbn,
      authors: r.authors,
      seriesName: r.seriesName,
      seriesIndex: r.seriesIndex,
      tags: r.tags,
      publisher: r.publisher,
      language: r.language,
      rating: r.rating,
      description: r.description,
      formats: r.formats,
      collection: r.collection,
    }));

    return {
      books,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  public getBookById(id: number): BookFlattened | null {
    const db = getDatabaseConnection(this.libraryPath);
    const row = db
      .prepare(`
        SELECT 
          id, title, title_sort as titleSort, author_sort as authorSort,
          timestamp, pubdate, has_cover as hasCover, path, uuid, isbn,
          authors, series_name as seriesName, series_index as seriesIndex,
          tags, publisher, language, rating, description, formats, collection
        FROM v_books_flattened
        WHERE id = ?
      `)
      .get(id) as any;

    if (!row) return null;

    return {
      id: row.id,
      title: row.title,
      titleSort: row.titleSort,
      authorSort: row.authorSort,
      timestamp: row.timestamp,
      pubdate: row.pubdate,
      hasCover: Boolean(row.hasCover),
      path: row.path,
      uuid: row.uuid,
      isbn: row.isbn,
      authors: row.authors,
      seriesName: row.seriesName,
      seriesIndex: row.seriesIndex,
      tags: row.tags,
      publisher: row.publisher,
      language: row.language,
      rating: row.rating,
      description: row.description,
      formats: row.formats,
      collection: row.collection,
    };
  }

  public getFilterFacets(): {
    authors: { name: string; count: number }[];
    languages: { name: string; count: number }[];
    series: { name: string; count: number }[];
    formats: { name: string; count: number }[];
    publishers: { name: string; count: number }[];
    ratings: { name: string; rating: number; count: number }[];
    tags: { name: string; count: number }[];
    collections: { name: string; count: number }[];
  } {
    const db = getDatabaseConnection(this.libraryPath);

    const authors = db
      .prepare(`
        SELECT a.name, count(bal.book) as count
        FROM authors a
        JOIN books_authors_link bal ON bal.author = a.id
        GROUP BY a.id
        ORDER BY count DESC, a.name ASC
      `)
      .all() as any[];

    const languages = db
      .prepare(`
        SELECT l.lang_code as name, count(bll.book) as count
        FROM languages l
        JOIN books_languages_link bll ON bll.lang_code = l.id
        GROUP BY l.id
        ORDER BY count DESC, l.lang_code ASC
      `)
      .all() as any[];

    const series = db
      .prepare(`
        SELECT s.name, count(bsl.book) as count
        FROM series s
        JOIN books_series_link bsl ON bsl.series = s.id
        GROUP BY s.id
        ORDER BY count DESC, s.name ASC
      `)
      .all() as any[];

    const formats = db
      .prepare(`
        SELECT d.format as name, count(d.book) as count
        FROM data d
        GROUP BY d.format
        ORDER BY count DESC
      `)
      .all() as any[];

    const publishers = db
      .prepare(`
        SELECT p.name, count(bpl.book) as count
        FROM publishers p
        JOIN books_publishers_link bpl ON bpl.publisher = p.id
        GROUP BY p.id
        ORDER BY count DESC, p.name ASC
      `)
      .all() as any[];

    const ratingsRaw = db
      .prepare(`
        SELECT r.rating as rawRating, count(brl.book) as count
        FROM ratings r
        JOIN books_ratings_link brl ON brl.rating = r.id
        GROUP BY r.id
        ORDER BY r.rating DESC
      `)
      .all() as any[];

    const ratings = ratingsRaw.map((r) => ({
      name: `${(r.rawRating / 2).toFixed(1)} Stars`,
      rating: r.rawRating / 2,
      count: r.count,
    }));

    const tags = db
      .prepare(`
        SELECT t.name, count(btl.book) as count
        FROM tags t
        JOIN books_tags_link btl ON btl.tag = t.id
        GROUP BY t.id
        ORDER BY count DESC, t.name ASC
      `)
      .all() as any[];

    let collections: any[] = [];
    const hasCustomCol1 = db
      .prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='custom_column_1'")
      .get() as { count: number };

    if (hasCustomCol1.count > 0) {
      collections = db
        .prepare(`
          SELECT cc1.value as name, count(bccl.book) as count
          FROM custom_column_1 cc1
          JOIN books_custom_column_1_link bccl ON bccl.value = cc1.id
          GROUP BY cc1.id
          ORDER BY count DESC, cc1.value ASC
        `)
        .all() as any[];
    }

    return { authors, languages, series, formats, publishers, ratings, tags, collections };
  }

  public updateBookMetadata(id: number, input: UpdateBookInput): BookFlattened | null {
    const db = getDatabaseConnection(this.libraryPath);
    const book = this.getBookById(id);
    if (!book) return null;

    const updateTx = db.transaction(() => {
      // 1. Update Title if provided
      if (input.title !== undefined) {
        db.prepare('UPDATE books SET title = ? WHERE id = ?').run(input.title, id);
      }

      // 2. Update Description / Comments
      if (input.description !== undefined) {
        if (input.description === null || input.description === '') {
          db.prepare('DELETE FROM comments WHERE book = ?').run(id);
        } else {
          const existing = db.prepare('SELECT id FROM comments WHERE book = ?').get(id);
          if (existing) {
            db.prepare('UPDATE comments SET text = ? WHERE book = ?').run(input.description, id);
          } else {
            db.prepare('INSERT INTO comments (book, text) VALUES (?, ?)').run(id, input.description);
          }
        }
      }

      // 3. Update Rating
      if (input.rating !== undefined) {
        db.prepare('DELETE FROM books_ratings_link WHERE book = ?').run(id);
        if (input.rating !== null && input.rating > 0) {
          const calibreRating = Math.round(input.rating * 2);
          let ratingRow = db.prepare('SELECT id FROM ratings WHERE rating = ?').get(calibreRating) as any;
          if (!ratingRow) {
            const insertRating = db.prepare('INSERT INTO ratings (rating) VALUES (?)').run(calibreRating);
            ratingRow = { id: insertRating.lastInsertRowid };
          }
          db.prepare('INSERT INTO books_ratings_link (book, rating) VALUES (?, ?)').run(id, ratingRow.id);
        }
      }
    });

    updateTx();
    return this.getBookById(id);
  }

  public deleteBook(id: number): boolean {
    const db = getDatabaseConnection(this.libraryPath);
    const book = this.getBookById(id);
    if (!book) return false;

    const deleteTx = db.transaction(() => {
      db.prepare('DELETE FROM books_authors_link WHERE book = ?').run(id);
      db.prepare('DELETE FROM books_tags_link WHERE book = ?').run(id);
      db.prepare('DELETE FROM books_series_link WHERE book = ?').run(id);
      db.prepare('DELETE FROM books_ratings_link WHERE book = ?').run(id);
      db.prepare('DELETE FROM books_languages_link WHERE book = ?').run(id);
      db.prepare('DELETE FROM books_publishers_link WHERE book = ?').run(id);
      db.prepare('DELETE FROM books_custom_column_1_link WHERE book = ?').run(id);
      db.prepare('DELETE FROM comments WHERE book = ?').run(id);
      db.prepare('DELETE FROM data WHERE book = ?').run(id);
      db.prepare('DELETE FROM identifiers WHERE book = ?').run(id);
      db.prepare('DELETE FROM books WHERE id = ?').run(id);
    });

    deleteTx();
    return true;
  }
}
