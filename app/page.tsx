'use client';

import React, { useState } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Header from '@/components/Header';
import SearchFilters from '@/components/SearchFilters';
import FilterSidebar from '@/components/FilterSidebar';
import CommandBarFilters from '@/components/CommandBarFilters';
import BookGrid from '@/components/BookGrid';
import BookDetailModal from '@/components/BookDetailModal';
import { BookFlattened, BookListResponse, BookQueryOptions } from '@/lib/types';
import { DEFAULT_LIBRARY_NAME } from '@/lib/constants';

export default function HomePage() {
  const queryClient = useQueryClient();
  const [currentLibrary, setCurrentLibrary] = useState<string>(DEFAULT_LIBRARY_NAME);
  const [selectedBook, setSelectedBook] = useState<BookFlattened | null>(null);
  const [isMobileFiltersOpen, setIsMobileFiltersOpen] = useState<boolean>(false);
  const [filterLayout, setFilterLayout] = useState<'sidebar' | 'commandBar'>('sidebar');
  const [viewMode, setViewMode] = useState<'gallery' | 'table'>('gallery');

  const [filters, setFilters] = useState<BookQueryOptions>({
    sort: 'id',
    order: 'desc',
    pageSize: 30,
  });

  // Fetch all 8 Calibre Facets
  const { data: facets } = useQuery({
    queryKey: ['facets', currentLibrary],
    queryFn: async () => {
      const res = await fetch(`/api/v1/facets?library=${encodeURIComponent(currentLibrary)}`);
      const json = await res.json();
      return json.data || {};
    },
  });

  // Infinite Query for seamless scrolling / lazy loading
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery<BookListResponse>({
    queryKey: ['books', currentLibrary, filters],
    queryFn: async ({ pageParam = 1 }) => {
      const queryParams = new URLSearchParams();
      queryParams.set('library', currentLibrary);
      if (filters.search) queryParams.set('search', filters.search);
      if (filters.author) queryParams.set('author', filters.author);
      if (filters.authors && filters.authors.length > 0) queryParams.set('authors', filters.authors.join(','));
      if (filters.tag) queryParams.set('tag', filters.tag);
      if (filters.tags && filters.tags.length > 0) queryParams.set('tags', filters.tags.join(','));
      if (filters.series) queryParams.set('series', filters.series);
      if (filters.seriesList && filters.seriesList.length > 0) queryParams.set('seriesList', filters.seriesList.join(','));
      if (filters.collection) queryParams.set('collection', filters.collection);
      if (filters.collections && filters.collections.length > 0) queryParams.set('collections', filters.collections.join(','));
      if (filters.publisher) queryParams.set('publisher', filters.publisher);
      if (filters.publishers && filters.publishers.length > 0) queryParams.set('publishers', filters.publishers.join(','));
      if (filters.language) queryParams.set('language', filters.language);
      if (filters.languages && filters.languages.length > 0) queryParams.set('languages', filters.languages.join(','));
      if (filters.format) queryParams.set('format', filters.format);
      if (filters.formats && filters.formats.length > 0) queryParams.set('formats', filters.formats.join(','));
      if (filters.rating !== undefined) queryParams.set('rating', String(filters.rating));
      if (filters.ratings && filters.ratings.length > 0) queryParams.set('ratings', filters.ratings.join(','));
      if (filters.hasCover !== undefined) queryParams.set('hasCover', String(filters.hasCover));
      if (filters.sort) queryParams.set('sort', filters.sort);
      if (filters.order) queryParams.set('order', filters.order);
      queryParams.set('page', String(pageParam));
      queryParams.set('pageSize', String(filters.pageSize || 30));

      const res = await fetch(`/api/v1/books?${queryParams.toString()}`);
      const json = await res.json();
      return json.data || { books: [], total: 0, page: Number(pageParam), pageSize: 30, totalPages: 1 };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      if (lastPage.page < lastPage.totalPages) {
        return lastPage.page + 1;
      }
      return undefined;
    },
  });

  const books = data?.pages.flatMap((page) => page.books) || [];
  const total = data?.pages[0]?.total || 0;

  const handleFilterChange = (newFilters: Partial<BookQueryOptions>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({
      sort: 'id',
      order: 'desc',
      pageSize: 30,
    });
  };

  const handleSelectLibrary = (newLibrary: string) => {
    setCurrentLibrary(newLibrary);
    handleResetFilters();
  };

  const activeFilterCount =
    (filters.authors?.length || 0) +
    (filters.tags?.length || 0) +
    (filters.seriesList?.length || 0) +
    (filters.collections?.length || 0) +
    (filters.publishers?.length || 0) +
    (filters.languages?.length || 0) +
    (filters.formats?.length || 0) +
    (filters.ratings?.length || 0) +
    (filters.hasCover !== undefined ? 1 : 0);

  return (
    <div className="min-h-screen flex flex-col bg-slate-950">
      {/* Top Navigation */}
      <Header currentLibrary={currentLibrary} onSelectLibrary={handleSelectLibrary} />

      {/* Main Content Area: Responsive Flex Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-start gap-6">
          {/* Pattern A: Collapsible Left Facet Sidebar (Desktop & Mobile Drawer) */}
          {filterLayout === 'sidebar' && (
            <FilterSidebar
              facets={facets || {}}
              filters={filters}
              onFilterChange={handleFilterChange}
              onReset={handleResetFilters}
              isOpenMobile={isMobileFiltersOpen}
              onCloseMobile={() => setIsMobileFiltersOpen(false)}
            />
          )}

          {/* Book Catalog Feed */}
          <div className="flex-1 min-w-0">
            {/* Search and Filters Bar with Layout Switcher */}
            <SearchFilters
              currentLibrary={currentLibrary}
              filters={filters}
              onFilterChange={handleFilterChange}
              onReset={handleResetFilters}
              onOpenMobileFilters={() => setIsMobileFiltersOpen(true)}
              activeFilterCount={activeFilterCount}
              filterLayout={filterLayout}
              onToggleFilterLayout={setFilterLayout}
              viewMode={viewMode}
              onToggleViewMode={setViewMode}
            />

            {/* Pattern B: Modern Command-Bar Popovers */}
            {filterLayout === 'commandBar' && (
              <div className="mb-4 p-2 bg-slate-900/50 border border-slate-800/80 rounded-2xl">
                <CommandBarFilters
                  facets={facets || {}}
                  filters={filters}
                  onFilterChange={handleFilterChange}
                />
              </div>
            )}

            {/* Book Catalog (Gallery vs Table with Infinite Scroll / Lazy Load) */}
            <BookGrid
              books={books}
              libraryName={currentLibrary}
              isLoading={isLoading}
              total={total}
              viewMode={viewMode}
              sort={filters.sort}
              order={filters.order}
              onSortChange={(sort, order) => handleFilterChange({ sort, order })}
              onSelectBook={(book) => setSelectedBook(book)}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
            />
          </div>
        </div>
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
