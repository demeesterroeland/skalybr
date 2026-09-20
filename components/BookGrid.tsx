'use client';

import React, { useEffect, useRef } from 'react';
import { BookFlattened, BookQueryOptions } from '@/lib/types';
import BookCard from './BookCard';
import BookTable from './BookTable';
import { BookDashed, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';

interface BookGridProps {
  books: BookFlattened[];
  libraryName: string;
  isLoading: boolean;
  total: number;
  viewMode?: 'gallery' | 'table';
  sort?: BookQueryOptions['sort'];
  order?: 'asc' | 'desc';
  onSortChange?: (sort: BookQueryOptions['sort'], order: 'asc' | 'desc') => void;
  onSelectBook: (book: BookFlattened) => void;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  fetchNextPage?: () => void;
}

export default function BookGrid({
  books,
  libraryName,
  isLoading,
  total,
  viewMode = 'gallery',
  sort,
  order,
  onSortChange,
  onSelectBook,
  hasNextPage = false,
  isFetchingNextPage = false,
  fetchNextPage,
}: BookGridProps) {
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Auto-fetch next page when bottom sentinel is scrolled into view
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage || !fetchNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          fetchNextPage();
        }
      },
      {
        rootMargin: '350px',
      }
    );

    const target = loadMoreRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      if (target) {
        observer.unobserve(target);
      }
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Initial Full Loading Skeleton
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

  // No Library Selected State
  if (!libraryName) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-slate-900/30 border border-slate-800/60 rounded-2xl p-8 shadow-sm">
        <div className="w-16 h-16 rounded-2xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center mb-4">
          <BookDashed className="w-8 h-8 text-sky-400" />
        </div>
        <h3 className="text-lg font-bold text-slate-200">&lt; Select a Library &gt;</h3>
        <p className="text-sm text-slate-400 max-w-sm mt-1">
          Choose a Calibre library from the dropdown in the header to browse and search your books.
        </p>
      </div>
    );
  }

  // Empty State
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
    <div className="space-y-6">
      {/* Book Catalog (Gallery vs Table) */}
      {viewMode === 'table' ? (
        <BookTable
          books={books}
          libraryName={libraryName}
          isLoading={false}
          onSelectBook={onSelectBook}
          sort={sort}
          order={order}
          onSortChange={onSortChange}
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

      {/* Infinite Scroll / Lazy Load Status & Trigger */}
      <div className="pt-2">
        {hasNextPage && (
          <div ref={loadMoreRef} className="flex flex-col items-center justify-center py-6">
            {isFetchingNextPage ? (
              <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-slate-900/80 border border-slate-800 text-sky-400 shadow-md">
                <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
                <span className="text-xs font-medium text-slate-300">
                  Loading more books ({books.length} of {total})...
                </span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fetchNextPage?.()}
                className="px-5 py-2.5 bg-slate-900 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-850 rounded-xl text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                <span>Load More Books</span>
                <span className="text-[11px] text-slate-500 font-mono">
                  ({books.length} of {total})
                </span>
              </button>
            )}
          </div>
        )}

        {!hasNextPage && books.length > 0 && (
          <div className="flex items-center justify-center py-8 border-t border-slate-850/60 text-slate-500 text-xs gap-2">
            <CheckCircle2 className="w-4 h-4 text-slate-600" />
            <span>All {total} books loaded</span>
          </div>
        )}
      </div>
    </div>
  );
}
