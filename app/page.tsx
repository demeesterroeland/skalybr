'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Header from '@/components/Header';
import SearchFilters from '@/components/SearchFilters';
import BookGrid from '@/components/BookGrid';
import BookDetailModal from '@/components/BookDetailModal';
import { BookFlattened, BookListResponse, BookQueryOptions } from '@/lib/types';
import { DEFAULT_LIBRARY_NAME } from '@/lib/constants';

export default function HomePage() {
  const queryClient = useQueryClient();
  const [currentLibrary, setCurrentLibrary] = useState<string>(DEFAULT_LIBRARY_NAME);
  const [selectedBook, setSelectedBook] = useState<BookFlattened | null>(null);

  const [filters, setFilters] = useState<BookQueryOptions>({
    sort: 'id',
    order: 'desc',
    page: 1,
    pageSize: 30,
  });

  const queryParams = new URLSearchParams();
  queryParams.set('library', currentLibrary);
  if (filters.search) queryParams.set('search', filters.search);
  if (filters.author) queryParams.set('author', filters.author);
  if (filters.tag) queryParams.set('tag', filters.tag);
  if (filters.series) queryParams.set('series', filters.series);
  if (filters.collection) queryParams.set('collection', filters.collection);
  if (filters.format) queryParams.set('format', filters.format);
  if (filters.sort) queryParams.set('sort', filters.sort);
  if (filters.order) queryParams.set('order', filters.order);
  queryParams.set('page', String(filters.page || 1));
  queryParams.set('pageSize', String(filters.pageSize || 30));

  const { data, isLoading } = useQuery<BookListResponse>({
    queryKey: ['books', currentLibrary, filters],
    queryFn: async () => {
      const res = await fetch(`/api/v1/books?${queryParams.toString()}`);
      const json = await res.json();
      return json.data || { books: [], total: 0, page: 1, pageSize: 30, totalPages: 1 };
    },
  });

  const handleFilterChange = (newFilters: Partial<BookQueryOptions>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({
      sort: 'id',
      order: 'desc',
      page: 1,
      pageSize: 30,
    });
  };

  const handleSelectLibrary = (newLibrary: string) => {
    setCurrentLibrary(newLibrary);
    handleResetFilters();
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* Top Navigation */}
      <Header currentLibrary={currentLibrary} onSelectLibrary={handleSelectLibrary} />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filters Bar */}
        <SearchFilters
          currentLibrary={currentLibrary}
          filters={filters}
          onFilterChange={handleFilterChange}
          onReset={handleResetFilters}
        />

        {/* Book Grid */}
        <BookGrid
          books={data?.books || []}
          libraryName={currentLibrary}
          isLoading={isLoading}
          total={data?.total || 0}
          page={filters.page || 1}
          pageSize={filters.pageSize || 30}
          onPageChange={(p) => handleFilterChange({ page: p })}
          onSelectBook={(book) => setSelectedBook(book)}
        />
      </main>

      {/* Book Detail & Edit Modal */}
      <BookDetailModal
        book={selectedBook}
        libraryName={currentLibrary}
        isOpen={Boolean(selectedBook)}
        onClose={() => setSelectedBook(null)}
        onBookUpdated={(updated) => {
          setSelectedBook(updated);
          queryClient.invalidateQueries({ queryKey: ['books'] });
          queryClient.invalidateQueries({ queryKey: ['facets'] });
        }}
        onBookDeleted={(id) => {
          setSelectedBook(null);
          queryClient.invalidateQueries({ queryKey: ['books'] });
          queryClient.invalidateQueries({ queryKey: ['facets'] });
          queryClient.invalidateQueries({ queryKey: ['libraries'] });
        }}
      />
    </div>
  );
}
