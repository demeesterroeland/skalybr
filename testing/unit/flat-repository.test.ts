import { describe, it, expect } from 'vitest';
import { FlatBookRepository } from '../../lib/calibre/repository';
import { getResizedCover } from '../../lib/calibre/cover';
import { DEFAULT_CALIBRE_BASE_DIR, getLibraryPath } from '../../lib/config';

describe('Skalybr FlatBookRepository', () => {
  it('should list available Calibre libraries', () => {
    const libraries = FlatBookRepository.listAvailableLibraries(DEFAULT_CALIBRE_BASE_DIR);
    expect(libraries.length).toBeGreaterThanOrEqual(1);
    expect(libraries[0].name).toBeDefined();
    expect(libraries[0].bookCount).toBeGreaterThanOrEqual(0);
  });

  it('should fetch paginated books with flattened attributes', () => {
    const libraries = FlatBookRepository.listAvailableLibraries(DEFAULT_CALIBRE_BASE_DIR);
    const targetLib = libraries[0]?.name;
    const repo = new FlatBookRepository(targetLib);
    const result = repo.getBooks({ page: 1, pageSize: 20 });

    expect(result.total).toBeGreaterThan(0);
    expect(result.books.length).toBeGreaterThan(0);

    const book = result.books[0];
    expect(book).toBeDefined();
    expect(book.id).toBeTypeOf('number');
    expect(book.title).toBeTypeOf('string');
  });

  it('should search books by title or author', () => {
    const libraries = FlatBookRepository.listAvailableLibraries(DEFAULT_CALIBRE_BASE_DIR);
    const targetLib = libraries[0]?.name;
    const repo = new FlatBookRepository(targetLib);
    const allBooks = repo.getBooks({ pageSize: 5 });
    const query = allBooks.books[0]?.title?.slice(0, 3) || 'a';
    const result = repo.getBooks({ search: query });

    expect(result.total).toBeGreaterThan(0);
    expect(result.books.length).toBeGreaterThan(0);
  });

  it('should get a single book by ID', () => {
    const libraries = FlatBookRepository.listAvailableLibraries(DEFAULT_CALIBRE_BASE_DIR);
    const targetLib = libraries[0]?.name;
    const repo = new FlatBookRepository(targetLib);
    const firstBook = repo.getBooks({ pageSize: 1 }).books[0];
    if (firstBook) {
      const book = repo.getBookById(firstBook.id);
      expect(book).toBeDefined();
      expect(book?.id).toBe(firstBook.id);
      expect(book?.title).toBeTruthy();
    }
  });

  it('should fetch all 8 Calibre filter facets', () => {
    const libraries = FlatBookRepository.listAvailableLibraries(DEFAULT_CALIBRE_BASE_DIR);
    const targetLib = libraries[0]?.name;
    const repo = new FlatBookRepository(targetLib);
    const facets = repo.getFilterFacets();

    expect(facets.authors).toBeInstanceOf(Array);
    expect(facets.languages).toBeInstanceOf(Array);
    expect(facets.series).toBeInstanceOf(Array);
    expect(facets.formats).toBeInstanceOf(Array);
    expect(facets.publishers).toBeInstanceOf(Array);
    expect(facets.ratings).toBeInstanceOf(Array);
    expect(facets.tags).toBeInstanceOf(Array);
    expect(facets.collections).toBeInstanceOf(Array);
  });

  it('should support multi-select OR querying across authors, tags, and languages', () => {
    const libraries = FlatBookRepository.listAvailableLibraries(DEFAULT_CALIBRE_BASE_DIR);
    const targetLib = libraries[0]?.name;
    const repo = new FlatBookRepository(targetLib);
    const sample = repo.getBooks({ pageSize: 10 });
    const auth1 = sample.books[0]?.authors?.split('&')[0]?.trim();
    const auth2 = sample.books[1]?.authors?.split('&')[0]?.trim();

    if (auth1 && auth2) {
      const result = repo.getBooks({ authors: [auth1, auth2] });
      expect(result.books.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('should generate a WebP resized cover stream', async () => {
    const libraries = FlatBookRepository.listAvailableLibraries(DEFAULT_CALIBRE_BASE_DIR);
    const targetLib = libraries[0]?.name;
    const repo = new FlatBookRepository(targetLib);
    const bookWithCover = repo.getBooks({ pageSize: 50 }).books.find((b) => b.hasCover);

    if (bookWithCover) {
      const buffer = await getResizedCover(getLibraryPath(targetLib), bookWithCover.path, 200, 'webp');
      expect(buffer).toBeInstanceOf(Buffer);
      expect(buffer!.length).toBeGreaterThan(100);
    }
  });

  it('should support sorting by various fields', () => {
    const libraries = FlatBookRepository.listAvailableLibraries(DEFAULT_CALIBRE_BASE_DIR);
    const targetLib = libraries[0]?.name;
    const repo = new FlatBookRepository(targetLib);

    const sortFields = ['title', 'authors', 'pubdate', 'rating', 'series', 'collection', 'tags', 'formats', 'id'] as const;
    for (const field of sortFields) {
      const ascResult = repo.getBooks({ sort: field, order: 'asc', pageSize: 5 });
      expect(ascResult.books).toBeInstanceOf(Array);

      const descResult = repo.getBooks({ sort: field, order: 'desc', pageSize: 5 });
      expect(descResult.books).toBeInstanceOf(Array);
    }
  });
});
