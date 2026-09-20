'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import Header from '@/components/Header';
import SearchFilters from '@/components/SearchFilters';
import FilterSidebar from '@/components/FilterSidebar';
import CommandBarFilters from '@/components/CommandBarFilters';
import BookGrid from '@/components/BookGrid';
import BookDetailModal from '@/components/BookDetailModal';
import { BookFlattened, BookListResponse, BookQueryOptions } from '@/lib/types';
import { DEFAULT_LIBRARY_NAME } from '@/lib/constants';

// Helper: Parse URL query string into application state
function parseUrlState(searchStr: string) {
  const sp = new URLSearchParams(searchStr);
  const library = sp.get('library') || DEFAULT_LIBRARY_NAME;
  const viewMode: 'gallery' | 'table' = sp.get('view') === 'table' ? 'table' : 'gallery';
  const filterLayout: 'sidebar' | 'commandBar' = sp.get('layout') === 'commandBar' ? 'commandBar' : 'sidebar';

  const filters: BookQueryOptions = {
    sort: (sp.get('sort') as any) || 'id',
    order: (sp.get('order') as any) || 'desc',
    pageSize: 30,
  };

  if (sp.get('search')) filters.search = sp.get('search')!;
  if (sp.get('authors')) filters.authors = sp.get('authors')!.split(',').filter(Boolean);
  else if (sp.get('author')) filters.authors = [sp.get('author')!];

  if (sp.get('tags')) filters.tags = sp.get('tags')!.split(',').filter(Boolean);
  else if (sp.get('tag')) filters.tags = [sp.get('tag')!];

  if (sp.get('seriesList')) filters.seriesList = sp.get('seriesList')!.split(',').filter(Boolean);
  else if (sp.get('series')) filters.seriesList = [sp.get('series')!];

  if (sp.get('collections')) filters.collections = sp.get('collections')!.split(',').filter(Boolean);
  else if (sp.get('collection')) filters.collections = [sp.get('collection')!];

  if (sp.get('publishers')) filters.publishers = sp.get('publishers')!.split(',').filter(Boolean);
  else if (sp.get('publisher')) filters.publishers = [sp.get('publisher')!];

  if (sp.get('languages')) filters.languages = sp.get('languages')!.split(',').filter(Boolean);
  else if (sp.get('language')) filters.languages = [sp.get('language')!];

  if (sp.get('formats')) filters.formats = sp.get('formats')!.split(',').filter(Boolean);
  else if (sp.get('format')) filters.formats = [sp.get('format')!];

  if (sp.get('ratings')) filters.ratings = sp.get('ratings')!.split(',').map(Number).filter((n) => !isNaN(n));
  else if (sp.get('rating')) filters.rating = Number(sp.get('rating'));

  if (sp.get('hasCover') !== null) {
    const hc = sp.get('hasCover');
    if (hc === 'true' || hc === '1') filters.hasCover = true;
    else if (hc === 'false' || hc === '0') filters.hasCover = false;
  }

  return { library, viewMode, filterLayout, filters };
}

// Helper: Serialize application state into URL search string
function serializeUrlState(
  library: string,
  viewMode: 'gallery' | 'table',
  filterLayout: 'sidebar' | 'commandBar',
  filters: BookQueryOptions
): string {
  const sp = new URLSearchParams();
  if (library) {
    sp.set('library', library);
  }
  if (viewMode !== 'gallery') {
    sp.set('view', viewMode);
  }
  if (filterLayout !== 'sidebar') {
    sp.set('layout', filterLayout);
  }
  if (filters.search) sp.set('search', filters.search);
  if (filters.authors && filters.authors.length > 0) sp.set('authors', filters.authors.join(','));
  if (filters.tags && filters.tags.length > 0) sp.set('tags', filters.tags.join(','));
  if (filters.seriesList && filters.seriesList.length > 0) sp.set('seriesList', filters.seriesList.join(','));
  if (filters.collections && filters.collections.length > 0) sp.set('collections', filters.collections.join(','));
  if (filters.publishers && filters.publishers.length > 0) sp.set('publishers', filters.publishers.join(','));
  if (filters.languages && filters.languages.length > 0) sp.set('languages', filters.languages.join(','));
  if (filters.formats && filters.formats.length > 0) sp.set('formats', filters.formats.join(','));
  if (filters.ratings && filters.ratings.length > 0) sp.set('ratings', filters.ratings.join(','));
  if (filters.hasCover !== undefined) sp.set('hasCover', String(filters.hasCover));
  if (filters.sort && filters.sort !== 'id') sp.set('sort', filters.sort);
  if (filters.order && filters.order !== 'desc') sp.set('order', filters.order);

  const queryStr = sp.toString();
  return queryStr ? `?${queryStr}` : window.location.pathname;
}

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

  const isInitialized = useRef(false);

  // Initialize state from URL on first mount
  useEffect(() => {
    let lib = DEFAULT_LIBRARY_NAME;
    let vm: 'gallery' | 'table' = 'gallery';
    let fl: 'sidebar' | 'commandBar' = 'sidebar';
    let f: BookQueryOptions = {
      sort: 'id',
      order: 'desc',
      pageSize: 30,
    };

    if (typeof window !== 'undefined' && window.location.search) {
      const parsed = parseUrlState(window.location.search);
      lib = parsed.library;
      vm = parsed.viewMode;
      fl = parsed.filterLayout;
      f = parsed.filters;

      setCurrentLibrary(lib);
      setViewMode(vm);
      setFilterLayout(fl);
      setFilters(f);
    }

    isInitialized.current = true;
    const initialUrl = serializeUrlState(lib, vm, fl, f);
    window.history.replaceState(null, '', initialUrl);
  }, []);

  // Sync state to URL in address bar whenever filters, library, view, or sort change
  useEffect(() => {
    if (!isInitialized.current) return;
    const newUrl = serializeUrlState(currentLibrary, viewMode, filterLayout, filters);
    window.history.replaceState(null, '', newUrl);
  }, [currentLibrary, viewMode, filterLayout, filters]);

  // Support Browser Back/Forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseUrlState(window.location.search);
      setCurrentLibrary(parsed.library);
      setViewMode(parsed.viewMode);
      setFilterLayout(parsed.filterLayout);
      setFilters(parsed.filters);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

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
