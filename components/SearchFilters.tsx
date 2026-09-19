'use client';

import React from 'react';
import { Search, SlidersHorizontal, ArrowUpDown, X, Tag, Bookmark, Layers } from 'lucide-react';
import { BookQueryOptions } from '@/lib/types';
import { useQuery } from '@tanstack/react-query';

interface SearchFiltersProps {
  currentLibrary: string;
  filters: BookQueryOptions;
  onFilterChange: (filters: Partial<BookQueryOptions>) => void;
  onReset: () => void;
}

export default function SearchFilters({
  currentLibrary,
  filters,
  onFilterChange,
  onReset,
}: SearchFiltersProps) {
  const { data: facets } = useQuery({
    queryKey: ['facets', currentLibrary],
    queryFn: async () => {
      const res = await fetch(`/api/v1/facets?library=${encodeURIComponent(currentLibrary)}`);
      const json = await res.json();
      return json.data || { authors: [], tags: [], series: [], collections: [], formats: [] };
    },
  });

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.author ||
      filters.tag ||
      filters.series ||
      filters.collection ||
      filters.format
  );

  return (
    <div className="space-y-3.5 mb-6">
      {/* Search and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search by title, author, series, or tags..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
            className="w-full pl-10 pr-10 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500/80 focus:ring-1 focus:ring-sky-500/80 transition-all shadow-inner"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '', page: 1 })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={`${filters.sort || 'id'}-${filters.order || 'desc'}`}
              onChange={(e) => {
                const [sort, order] = e.target.value.split('-') as [any, any];
                onFilterChange({ sort, order, page: 1 });
              }}
              className="appearance-none pl-3 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 hover:border-slate-700 focus:outline-none focus:border-sky-500 transition-colors cursor-pointer"
            >
              <option value="id-desc">Recently Added</option>
              <option value="title-asc">Title (A-Z)</option>
              <option value="title-desc">Title (Z-A)</option>
              <option value="authors-asc">Author (A-Z)</option>
              <option value="authors-desc">Author (Z-A)</option>
              <option value="pubdate-desc">Publication Date (Newest)</option>
              <option value="rating-desc">Highest Rated</option>
            </select>
            <ArrowUpDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500 pointer-events-none" />
          </div>

          {hasActiveFilters && (
            <button
              onClick={onReset}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-xl transition-all cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Facet Pills */}
      {facets && (
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          {/* Collection Filter */}
          {facets.collections?.length > 0 && (
            <div className="flex items-center gap-1">
              <span className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
                <Bookmark className="w-3 h-3 text-sky-400" /> Collections:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {facets.collections.map((c: any) => {
                  const active = filters.collection === c.name;
                  return (
                    <button
                      key={c.name}
                      onClick={() =>
                        onFilterChange({ collection: active ? undefined : c.name, page: 1 })
                      }
                      className={`px-2.5 py-1 rounded-lg transition-all font-medium cursor-pointer ${
                        active
                          ? 'bg-sky-500 text-white shadow-sm shadow-sky-500/30'
                          : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      {c.name} ({c.count})
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Formats */}
          {facets.formats?.length > 0 && (
            <div className="flex items-center gap-1 ml-auto">
              <span className="text-slate-500 text-[11px] font-medium flex items-center gap-1">
                <Layers className="w-3 h-3 text-cyan-400" /> Format:
              </span>
              <div className="flex flex-wrap gap-1">
                {facets.formats.slice(0, 4).map((f: any) => {
                  const active = filters.format === f.name;
                  return (
                    <button
                      key={f.name}
                      onClick={() => onFilterChange({ format: active ? undefined : f.name, page: 1 })}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono uppercase transition-all cursor-pointer ${
                        active
                          ? 'bg-cyan-500 text-white font-bold'
                          : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                      }`}
                    >
                      {f.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
