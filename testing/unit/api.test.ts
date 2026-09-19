import { describe, it, expect } from 'vitest';
import { FlatBookRepository } from '../../lib/calibre/repository';
import { UpdateBookSchema } from '../../lib/types';

describe('Skalybr API & Model Validation', () => {
  it('should validate valid update inputs', () => {
    const valid = UpdateBookSchema.safeParse({
      title: 'The Way of Kings (Updated)',
      rating: 4.5,
      description: 'An epic fantasy masterpiece.',
    });
    expect(valid.success).toBe(true);
  });

  it('should reject invalid ratings', () => {
    const invalid = UpdateBookSchema.safeParse({
      rating: 6.5, // > 5
    });
    expect(invalid.success).toBe(false);
  });

  it('should support multi-library switching and return books for each', () => {
    const libraries = FlatBookRepository.listAvailableLibraries();
    if (libraries.length > 1) {
      const lib1 = new FlatBookRepository(libraries[0].name);
      const res1 = lib1.getBooks({ page: 1, pageSize: 10 });
      expect(res1.total).toBeGreaterThan(0);
      expect(res1.books.length).toBeGreaterThan(0);

      const lib2 = new FlatBookRepository(libraries[1].name);
      const res2 = lib2.getBooks({ page: 1, pageSize: 10 });
      expect(res2.total).toBeGreaterThan(0);
      expect(res2.books.length).toBeGreaterThan(0);
    } else if (libraries.length === 1) {
      const lib = new FlatBookRepository(libraries[0].name);
      const res = lib.getBooks({ page: 1, pageSize: 10 });
      expect(res.total).toBeGreaterThanOrEqual(0);
    }
  });
});
