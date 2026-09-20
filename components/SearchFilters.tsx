'use client';

import React from 'react';
import {
  Search,
  ArrowUpDown,
  X,
  SlidersHorizontal,
  Bookmark,
  Users,
  Tags,
  Building2,
  Languages,
  Layers,
  Star,
  PanelLeft,
  Command,
} from 'lucide-react';
import { BookQueryOptions } from '@/lib/types';

interface SearchFiltersProps {
  currentLibrary: string;
  filters: BookQueryOptions;
  onFilterChange: (filters: Partial<BookQueryOptions>) => void;
  onReset: () => void;
  onOpenMobileFilters: () => void;
  activeFilterCount: number;
  filterLayout: 'sidebar' | 'commandBar';
  onToggleFilterLayout: (mode: 'sidebar' | 'commandBar') => void;
}

export default function SearchFilters({
  currentLibrary,
  filters,
  onFilterChange,
  onReset,
  onOpenMobileFilters,
  activeFilterCount,
  filterLayout,
  onToggleFilterLayout,
}: SearchFiltersProps) {
  const removeChip = (
    key: 'authors' | 'tags' | 'seriesList' | 'collections' | 'publishers' | 'languages' | 'formats' | 'ratings',
    val: string | number
  ) => {
    if (key === 'ratings') {
      const current = filters.ratings || [];
      const updated = current.filter((v) => v !== val);
      onFilterChange({ ratings: updated.length > 0 ? updated : undefined, page: 1 });
      return;
    }
    const current = (filters[key] as string[]) || [];
    const updated = current.filter((v) => v !== val);
    onFilterChange({ [key]: updated.length > 0 ? updated : undefined, page: 1 });
  };

  const hasAnyFilter =
    Boolean(filters.search) ||
    activeFilterCount > 0 ||
    Boolean(filters.author || filters.tag || filters.series || filters.collection || filters.format);

  return (
    <div className="space-y-3 mb-6">
      {/* Search, Layout Switcher, and Sort Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Mobile Filter Button (only relevant when in sidebar mode) */}
        {filterLayout === 'sidebar' && (
          <button
            type="button"
            onClick={onOpenMobileFilters}
            className="lg:hidden flex items-center justify-center gap-2 px-3.5 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs font-semibold text-slate-200 hover:border-slate-700 cursor-pointer transition-colors shadow-sm"
          >
            <SlidersHorizontal className="w-4 h-4 text-sky-400" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 text-[10px] font-bold bg-sky-500 text-white rounded-full">
                {activeFilterCount}
              </span>
            )}
          </button>
        )}

        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search catalog by title, author, series, or tags..."
            value={filters.search || ''}
            onChange={(e) => onFilterChange({ search: e.target.value, page: 1 })}
            className="w-full pl-10 pr-10 py-2 bg-slate-900/90 border border-slate-800 rounded-xl text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all shadow-inner"
          />
          {filters.search && (
            <button
              onClick={() => onFilterChange({ search: '', page: 1 })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Layout Switcher & Sort Selector */}
        <div className="flex items-center gap-2">
          {/* Pattern Switcher: Sidebar vs Top Command Bar */}
          <div className="flex items-center bg-slate-900 border border-slate-800 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => onToggleFilterLayout('sidebar')}
              title="Pattern A: Calibre Sidebar Layout"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                filterLayout === 'sidebar'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <PanelLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onToggleFilterLayout('commandBar')}
              title="Pattern B: Command-Bar & Popovers Layout"
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                filterLayout === 'commandBar'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Command className="w-4 h-4" />
            </button>
          </div>

          {/* Sort Selector */}
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

          {hasAnyFilter && (
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

      {/* Active Multi-Select Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-[11px] font-semibold text-slate-500 mr-1">Active:</span>

          {/* Collections */}
          {filters.collections?.map((col) => (
            <span
              key={col}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-sky-500/15 text-sky-300 border border-sky-500/30"
            >
              <Bookmark className="w-3 h-3 text-sky-400" />
              <span>{col}</span>
              <button
                onClick={() => removeChip('collections', col)}
                className="hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Authors */}
          {filters.authors?.map((auth) => (
            <span
              key={auth}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-indigo-500/15 text-indigo-300 border border-indigo-500/30"
            >
              <Users className="w-3 h-3 text-indigo-400" />
              <span>{auth}</span>
              <button
                onClick={() => removeChip('authors', auth)}
                className="hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Tags */}
          {filters.tags?.map((tg) => (
            <span
              key={tg}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
            >
              <Tags className="w-3 h-3 text-emerald-400" />
              <span>{tg}</span>
              <button
                onClick={() => removeChip('tags', tg)}
                className="hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Publishers */}
          {filters.publishers?.map((pub) => (
            <span
              key={pub}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30"
            >
              <Building2 className="w-3 h-3 text-amber-400" />
              <span>{pub}</span>
              <button
                onClick={() => removeChip('publishers', pub)}
                className="hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Languages */}
          {filters.languages?.map((lang) => (
            <span
              key={lang}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-cyan-500/15 text-cyan-300 border border-cyan-500/30"
            >
              <Languages className="w-3 h-3 text-cyan-400" />
              <span>{lang.toUpperCase()}</span>
              <button
                onClick={() => removeChip('languages', lang)}
                className="hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Formats */}
          {filters.formats?.map((fmt) => (
            <span
              key={fmt}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-purple-500/15 text-purple-300 border border-purple-500/30 uppercase font-mono"
            >
              <Layers className="w-3 h-3 text-purple-400" />
              <span>{fmt}</span>
              <button
                onClick={() => removeChip('formats', fmt)}
                className="hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Ratings */}
          {filters.ratings?.map((rat) => (
            <span
              key={rat}
              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30"
            >
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
              <span>{rat}★</span>
              <button
                onClick={() => removeChip('ratings', rat)}
                className="hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
