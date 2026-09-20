import { z } from 'zod';

export interface BookFlattened {
  id: number;
  title: string;
  titleSort: string | null;
  authorSort: string | null;
  authors: string | null;
  seriesName: string | null;
  seriesIndex: number | null;
  tags: string | null;
  publisher: string | null;
  language: string | null;
  rating: number | null;
  description: string | null;
  formats: string | null;
  collection: string | null;
  hasCover: boolean;
  pubdate: string | null;
  timestamp: string;
  path: string;
  uuid: string;
  isbn: string | null;
}

export interface LibraryInfo {
  name: string;
  displayName: string;
  path: string;
  bookCount: number;
  hasCustomColumns: boolean;
  isHidden?: boolean;
  isDefault?: boolean;
  avatarImage?: string | null;
}

export interface LibraryRecord {
  id: number;
  name: string;
  displayName: string | null;
  path: string | null;
  isHidden: boolean;
  isDefault: boolean;
  avatarImage: string | null;
  createdAt: string;
  updatedAt: string;
}

export type ReadingStatus = 'unread' | 'reading' | 'finished' | 'abandoned';

export interface ReadingProgressRecord {
  id: number;
  library: string;
  bookId: number;
  userId: number;
  status: ReadingStatus;
  progressPercent: number;
  currentPage: number | null;
  totalPages: number | null;
  format: string | null;
  locator: string | null;
  timeSpentSeconds: number;
  startedAt: string | null;
  finishedAt: string | null;
  lastReadAt: string;
}

export interface ReadingProgressInput {
  library: string;
  bookId: number;
  userId?: number;
  status?: ReadingStatus;
  progressPercent?: number;
  currentPage?: number | null;
  totalPages?: number | null;
  format?: string | null;
  locator?: string | null;
  timeSpentSeconds?: number;
}

export interface ShelfRecord {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  userId: number;
  isPublic: boolean;
  koboSync: boolean;
  createdAt: string;
}

export interface BookShelfRecord {
  id: number;
  library: string;
  shelfId: number;
  bookId: number;
  orderIndex: number;
  dateAdded: string;
}

export interface SmartShelfRecord {
  id: number;
  uuid: string;
  name: string;
  description: string | null;
  library: string;
  filterJson: string;
  userId: number;
  isPublic: boolean;
  createdAt: string;
}

export interface BookQueryOptions {
  library?: string;
  search?: string;
  author?: string;
  authors?: string[];
  tag?: string;
  tags?: string[];
  series?: string;
  seriesList?: string[];
  collection?: string;
  collections?: string[];
  publisher?: string;
  publishers?: string[];
  language?: string;
  languages?: string[];
  format?: string;
  formats?: string[];
  rating?: number;
  ratings?: number[];
  hasCover?: boolean;
  sort?: 'title' | 'authors' | 'pubdate' | 'rating' | 'id' | 'series' | 'seriesName' | 'collection' | 'tags' | 'formats';
  order?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface BookListResponse {
  books: BookFlattened[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export const UpdateBookSchema = z.object({
  title: z.string().min(1).optional(),
  authors: z.string().optional(),
  seriesName: z.string().nullable().optional(),
  seriesIndex: z.number().nullable().optional(),
  tags: z.string().nullable().optional(),
  publisher: z.string().nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  description: z.string().nullable().optional(),
  collection: z.string().nullable().optional(),
});

export type UpdateBookInput = z.infer<typeof UpdateBookSchema>;
