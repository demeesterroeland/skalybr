'use client';

import React, { useState, useMemo } from 'react';
import {
  Users,
  Languages,
  Layers,
  Building2,
  Star,
  Tags,
  Bookmark,
  ChevronDown,
  ChevronRight,
  Search,
  Check,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { BookQueryOptions } from '@/lib/types';

interface FacetItem {
  name: string;
  count: number;
  rating?: number;
}

interface FilterSidebarProps {
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
  onReset: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

interface SectionConfig {
  id: string;
  title: string;
  icon: React.ElementType;
  items: FacetItem[];
  selectedValues: string[];
  keyName: keyof BookQueryOptions;
  isHighCardinality: boolean;
}

export default function FilterSidebar({
  facets,
  filters,
  onFilterChange,
  onReset,
  isOpenMobile,
  onCloseMobile,
}: FilterSidebarProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    collections: true,
    languages: true,
    formats: true,
    authors: false,
    tags: false,
    publishers: false,
    ratings: true,
    series: false,
  });

  const [searchQueries, setSearchQueries] = useState<Record<string, string>>({});

  const toggleSection = (id: string) => {
    setExpandedSections((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleSearchChange = (id: string, q: string) => {
    setSearchQueries((prev) => ({ ...prev, [id]: q }));
  };

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

  const sections: SectionConfig[] = useMemo(() => {
    return [
      {
        id: 'authors',
        title: 'Authors',
        icon: Users,
        items: facets?.authors || [],
        selectedValues: filters.authors || (filters.author ? [filters.author] : []),
        keyName: 'authors',
        isHighCardinality: true,
      },
      {
        id: 'languages',
        title: 'Languages',
        icon: Languages,
        items: facets?.languages || [],
        selectedValues: filters.languages || (filters.language ? [filters.language] : []),
        keyName: 'languages',
        isHighCardinality: false,
      },
      {
        id: 'series',
        title: 'Series',
        icon: Bookmark,
        items: facets?.series || [],
        selectedValues: filters.seriesList || (filters.series ? [filters.series] : []),
        keyName: 'seriesList',
        isHighCardinality: (facets?.series || []).length > 8,
      },
      {
        id: 'formats',
        title: 'Formats',
        icon: Layers,
        items: facets?.formats || [],
        selectedValues: filters.formats || (filters.format ? [filters.format] : []),
        keyName: 'formats',
        isHighCardinality: false,
      },
      {
        id: 'publishers',
        title: 'Publishers',
        icon: Building2,
        items: facets?.publishers || [],
        selectedValues: filters.publishers || (filters.publisher ? [filters.publisher] : []),
        keyName: 'publishers',
        isHighCardinality: true,
      },
      {
        id: 'ratings',
        title: 'Rating',
        icon: Star,
        items: facets?.ratings || [],
        selectedValues: (filters.ratings || []).map(String),
        keyName: 'ratings',
        isHighCardinality: false,
      },
      {
        id: 'tags',
        title: 'Tags',
        icon: Tags,
        items: facets?.tags || [],
        selectedValues: filters.tags || (filters.tag ? [filters.tag] : []),
        keyName: 'tags',
        isHighCardinality: true,
      },
      {
        id: 'collections',
        title: 'Collections',
        icon: Bookmark,
        items: facets?.collections || [],
        selectedValues: filters.collections || (filters.collection ? [filters.collection] : []),
        keyName: 'collections',
        isHighCardinality: false,
      },
    ];
  }, [facets, filters]);

  const activeFilterCount =
    (filters.authors?.length || 0) +
    (filters.tags?.length || 0) +
    (filters.seriesList?.length || 0) +
    (filters.collections?.length || 0) +
    (filters.publishers?.length || 0) +
    (filters.languages?.length || 0) +
    (filters.formats?.length || 0) +
    (filters.ratings?.length || 0);

  const renderContent = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-800/80 bg-slate-900/60">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-slate-200">Library Filters</h3>
          {activeFilterCount > 0 && (
            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-full">
              {activeFilterCount}
            </span>
          )}
        </div>
        {activeFilterCount > 0 && (
          <button
            onClick={onReset}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Accordion Sections */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-800/40 p-2 space-y-1">
        {sections.map((sec) => {
          if (!sec.items || sec.items.length === 0) return null;
          const isExpanded = expandedSections[sec.id];
          const query = searchQueries[sec.id] || '';
          const Icon = sec.icon;

          const filteredItems = query
            ? sec.items.filter((item) =>
                item.name.toLowerCase().includes(query.toLowerCase())
              )
            : sec.items;

          return (
            <div key={sec.id} className="pt-2 pb-1">
              {/* Accordion Trigger */}
              <button
                type="button"
                onClick={() => toggleSection(sec.id)}
                className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-900/80 text-left transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-slate-400 group-hover:text-sky-400 transition-colors" />
                  <span className="text-xs font-semibold text-slate-300 group-hover:text-slate-100">
                    {sec.title}
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    ({sec.items.length})
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {sec.selectedValues.length > 0 && (
                    <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300" />
                  )}
                </div>
              </button>

              {/* Accordion Body */}
              {isExpanded && (
                <div className="mt-1.5 px-1 space-y-1.5">
                  {/* Search inside high-cardinality facets */}
                  {sec.isHighCardinality && sec.items.length > 6 && (
                    <div className="relative px-1 mb-2">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
                      <input
                        type="text"
                        placeholder={`Filter ${sec.title.toLowerCase()}...`}
                        value={query}
                        onChange={(e) => handleSearchChange(sec.id, e.target.value)}
                        className="w-full pl-8 pr-6 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                      />
                      {query && (
                        <button
                          onClick={() => handleSearchChange(sec.id, '')}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  )}

                  {/* Item Checkbox List */}
                  <div
                    className={`space-y-0.5 pr-1 ${
                      sec.isHighCardinality ? 'max-h-48 overflow-y-auto' : ''
                    }`}
                  >
                    {filteredItems.slice(0, sec.isHighCardinality && !query ? 25 : undefined).map((item) => {
                      const itemVal = sec.id === 'ratings' && item.rating !== undefined ? String(item.rating) : item.name;
                      const isSelected = sec.selectedValues.includes(itemVal);

                      return (
                        <label
                          key={item.name}
                          onClick={(e) => {
                            e.preventDefault();
                            toggleMultiSelect(sec.keyName as any, itemVal);
                          }}
                          className={`flex items-center justify-between px-2 py-1 rounded-lg text-xs transition-colors cursor-pointer select-none ${
                            isSelected
                              ? 'bg-sky-500/15 text-sky-300 font-medium border border-sky-500/30'
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate pr-2">
                            <div
                              className={`w-3.5 h-3.5 rounded flex items-center justify-center border transition-all ${
                                isSelected
                                  ? 'bg-sky-500 border-sky-500 text-white'
                                  : 'border-slate-700 bg-slate-950'
                              }`}
                            >
                              {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                            </div>
                            <span className="truncate">
                              {sec.id === 'languages' ? item.name.toUpperCase() : item.name}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono shrink-0">
                            {item.count}
                          </span>
                        </label>
                      );
                    })}

                    {filteredItems.length === 0 && (
                      <p className="text-[11px] text-slate-600 px-2 py-1 italic">
                        No matches found
                      </p>
                    )}

                    {sec.isHighCardinality && !query && sec.items.length > 25 && (
                      <p className="text-[10px] text-slate-500 px-2 pt-1">
                        + {sec.items.length - 25} more (use search)
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden lg:block w-72 shrink-0 bg-slate-900/40 border border-slate-800/80 rounded-2xl overflow-hidden backdrop-blur-sm shadow-xl sticky top-20 max-h-[calc(100vh-6rem)]">
        {renderContent()}
      </aside>

      {/* Mobile Drawer / Modal Overlay */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm animate-in fade-in"
            onClick={onCloseMobile}
          />
          {/* Slide-in panel */}
          <div className="relative w-80 max-w-[85vw] bg-slate-950 border-r border-slate-800 h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-left">
            <div className="absolute right-3 top-3.5 z-20">
              <button
                onClick={onCloseMobile}
                className="p-1 text-slate-400 hover:text-slate-200 bg-slate-900 rounded-lg border border-slate-800 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {renderContent()}
          </div>
        </div>
      )}
    </>
  );
}
