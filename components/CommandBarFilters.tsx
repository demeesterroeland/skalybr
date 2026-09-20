'use client';

import React, { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import {
  Users,
  Languages,
  Layers,
  Building2,
  Star,
  Tags,
  Bookmark,
  ChevronDown,
  Search,
  Check,
  X,
  Plus,
} from 'lucide-react';
import { BookQueryOptions } from '@/lib/types';

interface FacetItem {
  name: string;
  count: number;
  rating?: number;
}

interface FilterPopoverProps {
  title: string;
  icon: React.ElementType;
  items: FacetItem[];
  selectedValues: string[];
  isHighCardinality: boolean;
  onToggle: (val: string) => void;
  onClear: () => void;
  accentColor: string;
}

function FilterPopoverButton({
  title,
  icon: Icon,
  items,
  selectedValues,
  isHighCardinality,
  onToggle,
  onClear,
  accentColor,
}: FilterPopoverProps) {
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);

  const filteredItems = search
    ? items.filter((item) => item.name.toLowerCase().includes(search.toLowerCase()))
    : items;

  const hasSelection = selectedValues.length > 0;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer select-none border ${
            hasSelection
              ? 'bg-sky-500/15 text-sky-300 border-sky-500/40 shadow-sm shadow-sky-500/10'
              : 'bg-slate-900/90 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700'
          }`}
        >
          <Icon className={`w-3.5 h-3.5 ${hasSelection ? 'text-sky-400' : 'text-slate-400'}`} />
          <span>{title}</span>
          {hasSelection && (
            <span className="px-1.5 py-0.2 text-[10px] font-bold bg-sky-500 text-white rounded-full">
              {selectedValues.length}
            </span>
          )}
          <ChevronDown className="w-3 h-3 text-slate-500" />
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-50 w-64 p-2 bg-slate-900/95 border border-slate-800 rounded-2xl shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 text-xs text-slate-200"
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800 px-1">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Icon className="w-3.5 h-3.5 text-sky-400" /> {title}
            </span>
            {hasSelection && (
              <button
                onClick={onClear}
                className="text-[11px] text-rose-400 hover:text-rose-300 font-medium cursor-pointer"
              >
                Clear ({selectedValues.length})
              </button>
            )}
          </div>

          {/* Search inside high cardinality */}
          {items.length > 6 && (
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
              <input
                type="text"
                placeholder={`Search ${title.toLowerCase()}...`}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-6 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {/* Item List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
            {filteredItems.slice(0, isHighCardinality && !search ? 30 : undefined).map((item) => {
              const itemVal = item.rating !== undefined ? String(item.rating) : item.name;
              const isSelected = selectedValues.includes(itemVal);

              return (
                <button
                  key={item.name}
                  onClick={() => onToggle(itemVal)}
                  className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-xs transition-colors cursor-pointer text-left ${
                    isSelected
                      ? 'bg-sky-500/20 text-sky-200 font-medium'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate pr-2">
                    <div
                      className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all shrink-0 ${
                        isSelected
                          ? 'bg-sky-500 border-sky-500 text-white'
                          : 'border-slate-700 bg-slate-950'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span className="truncate">
                      {title === 'Languages' ? item.name.toUpperCase() : item.name}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 font-mono shrink-0">
                    {item.count}
                  </span>
                </button>
              );
            })}

            {filteredItems.length === 0 && (
              <p className="text-slate-500 italic text-center py-2">No items found</p>
            )}

            {isHighCardinality && !search && items.length > 30 && (
              <p className="text-[10px] text-slate-500 px-2 pt-1 text-center">
                + {items.length - 30} more (use search)
              </p>
            )}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

interface CommandBarFiltersProps {
  facets: {
    authors?: FacetItem[];
    languages?: FacetItem[];
    series?: FacetItem[];
    formats?: FacetItem[];
    publishers?: FacetItem[];
    ratings?: FacetItem[];
    tags?: FacetItem[];
    collections?: FacetItem[];
  };
  filters: BookQueryOptions;
  onFilterChange: (filters: Partial<BookQueryOptions>) => void;
}

export default function CommandBarFilters({
  facets,
  filters,
  onFilterChange,
}: CommandBarFiltersProps) {
  const toggleMultiSelect = (
    key: 'authors' | 'tags' | 'seriesList' | 'collections' | 'publishers' | 'languages' | 'formats' | 'ratings',
    value: string
  ) => {
    if (key === 'ratings') {
      const numVal = parseFloat(value);
      const current = filters.ratings || [];
      const updated = current.includes(numVal)
        ? current.filter((v) => v !== numVal)
        : [...current, numVal];
      onFilterChange({ ratings: updated.length > 0 ? updated : undefined, page: 1 });
      return;
    }

    const current = (filters[key] as string[]) || [];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];

    onFilterChange({ [key]: updated.length > 0 ? updated : undefined, page: 1 });
  };

  const clearKey = (key: keyof BookQueryOptions) => {
    onFilterChange({ [key]: undefined, page: 1 });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-1">
      {/* 1. Authors Popover */}
      {(facets.authors?.length || 0) > 0 && (
        <FilterPopoverButton
          title="Authors"
          icon={Users}
          items={facets.authors || []}
          selectedValues={filters.authors || (filters.author ? [filters.author] : [])}
          isHighCardinality={true}
          onToggle={(val) => toggleMultiSelect('authors', val)}
          onClear={() => clearKey('authors')}
          accentColor="indigo"
        />
      )}

      {/* 2. Languages Popover */}
      {(facets.languages?.length || 0) > 0 && (
        <FilterPopoverButton
          title="Languages"
          icon={Languages}
          items={facets.languages || []}
          selectedValues={filters.languages || (filters.language ? [filters.language] : [])}
          isHighCardinality={false}
          onToggle={(val) => toggleMultiSelect('languages', val)}
          onClear={() => clearKey('languages')}
          accentColor="cyan"
        />
      )}

      {/* 3. Series Popover */}
      {(facets.series?.length || 0) > 0 && (
        <FilterPopoverButton
          title="Series"
          icon={Bookmark}
          items={facets.series || []}
          selectedValues={filters.seriesList || (filters.series ? [filters.series] : [])}
          isHighCardinality={(facets.series?.length || 0) > 8}
          onToggle={(val) => toggleMultiSelect('seriesList', val)}
          onClear={() => clearKey('seriesList')}
          accentColor="blue"
        />
      )}

      {/* 4. Formats Popover */}
      {(facets.formats?.length || 0) > 0 && (
        <FilterPopoverButton
          title="Formats"
          icon={Layers}
          items={facets.formats || []}
          selectedValues={filters.formats || (filters.format ? [filters.format] : [])}
          isHighCardinality={false}
          onToggle={(val) => toggleMultiSelect('formats', val)}
          onClear={() => clearKey('formats')}
          accentColor="purple"
        />
      )}

      {/* 5. Publishers Popover */}
      {(facets.publishers?.length || 0) > 0 && (
        <FilterPopoverButton
          title="Publishers"
          icon={Building2}
          items={facets.publishers || []}
          selectedValues={filters.publishers || (filters.publisher ? [filters.publisher] : [])}
          isHighCardinality={true}
          onToggle={(val) => toggleMultiSelect('publishers', val)}
          onClear={() => clearKey('publishers')}
          accentColor="amber"
        />
      )}

      {/* 6. Rating Popover */}
      {(facets.ratings?.length || 0) > 0 && (
        <FilterPopoverButton
          title="Rating"
          icon={Star}
          items={facets.ratings || []}
          selectedValues={(filters.ratings || []).map(String)}
          isHighCardinality={false}
          onToggle={(val) => toggleMultiSelect('ratings', val)}
          onClear={() => clearKey('ratings')}
          accentColor="amber"
        />
      )}

      {/* 7. Tags Popover */}
      {(facets.tags?.length || 0) > 0 && (
        <FilterPopoverButton
          title="Tags"
          icon={Tags}
          items={facets.tags || []}
          selectedValues={filters.tags || (filters.tag ? [filters.tag] : [])}
          isHighCardinality={true}
          onToggle={(val) => toggleMultiSelect('tags', val)}
          onClear={() => clearKey('tags')}
          accentColor="emerald"
        />
      )}

      {/* 8. Collections Popover */}
      {(facets.collections?.length || 0) > 0 && (
        <FilterPopoverButton
          title="Collections"
          icon={Bookmark}
          items={facets.collections || []}
          selectedValues={filters.collections || (filters.collection ? [filters.collection] : [])}
          isHighCardinality={false}
          onToggle={(val) => toggleMultiSelect('collections', val)}
          onClear={() => clearKey('collections')}
          accentColor="sky"
        />
      )}
    </div>
  );
}
