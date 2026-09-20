'use client';

import React from 'react';
import { BookFlattened } from '@/lib/types';
import BookCard from './BookCard';
import BookTable from './BookTable';
import { ChevronLeft, ChevronRight, BookDashed } from 'lucide-react';

interface BookGridProps {
  books: BookFlattened[];
  libraryName: string;
  isLoading: boolean;
  total: number;
  page: number;
  pageSize: number;
  viewMode?: 'gallery' | 'table';
  onPageChange: (page: number) => void;
  onSelectBook: (book: BookFlattened) => void;
}

export default function BookGrid({
  books,
  libraryName,
  isLoading,
  total,
  page,
  pageSize,
  viewMode = 'gallery',
  onPageChange,
  onSelectBook,
}: BookGridProps) {
  const totalPages = Math.ceil(total / pageSize) || 1;

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6 animate-pulse">
        {Array.from({ length: 18 }).map((_, i) => (
          <div
            key={i}
            className="flex flex-col bg-slate-900/40 border border-slate-800/50 rounded-2xl overflow-hidden aspect-[2/3.8]"
          >
            <div className="aspect-[2/3] bg-slate-800/50 w-full" />
            <div className="p-3 space-y-2">
              <div className="h-3.5 bg-slate-800/80 rounded w-3/4" />
              <div className="h-2.5 bg-slate-800/50 rounded w-1/2" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-4">
          <BookDashed className="w-8 h-8 text-slate-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-200">No books found</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-1">
          Try clearing search terms or removing active filters to see your library.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Book Catalog (Gallery vs Table) */}
      {viewMode === 'table' ? (
        <BookTable
          books={books}
          libraryName={libraryName}
          isLoading={isLoading}
          onSelectBook={onSelectBook}
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 sm:gap-6">
          {books.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              libraryName={libraryName}
              onClick={() => onSelectBook(book)}
            />
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-800/80 pt-6">
          <p className="text-xs text-slate-400">
            Showing <span className="font-semibold text-slate-200">{(page - 1) * pageSize + 1}</span> to{' '}
            <span className="font-semibold text-slate-200">
              {Math.min(page * pageSize, total)}
            </span>{' '}
            of <span className="font-semibold text-slate-200">{total}</span> books
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <span className="text-xs font-medium text-slate-400 px-2">
              Page {page} of {totalPages}
            </span>

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white hover:border-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-all cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
