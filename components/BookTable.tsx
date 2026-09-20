'use client';

import React from 'react';
import { BookFlattened, BookQueryOptions } from '@/lib/types';
import { Star, Download, Bookmark, FileText, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface BookTableProps {
  books: BookFlattened[];
  libraryName: string;
  isLoading: boolean;
  onSelectBook: (book: BookFlattened) => void;
  sort?: BookQueryOptions['sort'];
  order?: 'asc' | 'desc';
  onSortChange?: (sort: BookQueryOptions['sort'], order: 'asc' | 'desc') => void;
}

export default function BookTable({
  books,
  libraryName,
  isLoading,
  onSelectBook,
  sort,
  order = 'desc',
  onSortChange,
}: BookTableProps) {
  const handleHeaderClick = (
    sortKey: NonNullable<BookQueryOptions['sort']>,
    defaultOrder: 'asc' | 'desc' = 'asc'
  ) => {
    if (!onSortChange) return;
    if (sort === sortKey) {
      // Toggle order
      const newOrder = order === 'asc' ? 'desc' : 'asc';
      onSortChange(sortKey, newOrder);
    } else {
      onSortChange(sortKey, defaultOrder);
    }
  };

  const renderSortableHeader = (
    label: string,
    sortKey: NonNullable<BookQueryOptions['sort']>,
    className: string = '',
    align: 'left' | 'center' | 'right' = 'left',
    defaultOrder: 'asc' | 'desc' = 'asc'
  ) => {
    const isActive = sort === sortKey;
    const isAsc = isActive && order === 'asc';
    const isDesc = isActive && order === 'desc';

    return (
      <th
        scope="col"
        onClick={() => handleHeaderClick(sortKey, defaultOrder)}
        className={`py-3 px-4 select-none cursor-pointer transition-colors group/th ${
          isActive
            ? 'text-sky-300 font-bold bg-slate-800/60'
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/30'
        } ${className}`}
        title={`Sort by ${label} (${
          isActive
            ? isAsc
              ? 'Click for descending'
              : 'Click for ascending'
            : `Click to sort ${defaultOrder === 'asc' ? 'ascending' : 'descending'}`
        })`}
      >
        <div
          className={`flex items-center gap-1.5 ${
            align === 'center'
              ? 'justify-center'
              : align === 'right'
              ? 'justify-end'
              : 'justify-start'
          }`}
        >
          <span>{label}</span>
          <span className="inline-flex items-center">
            {isActive ? (
              isAsc ? (
                <ArrowUp className="w-3.5 h-3.5 text-sky-400 transition-transform" />
              ) : (
                <ArrowDown className="w-3.5 h-3.5 text-sky-400 transition-transform" />
              )
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-600 opacity-0 group-hover/th:opacity-100 transition-opacity" />
            )}
          </span>
        </div>
      </th>
    );
  };

  if (isLoading) {
    return (
      <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden animate-pulse">
        <div className="h-12 bg-slate-900 border-b border-slate-800/80" />
        {Array.from({ length: 10 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 px-4 py-3.5 border-b border-slate-800/40"
          >
            <div className="w-9 h-13 bg-slate-800/80 rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-slate-800/80 rounded w-1/3" />
              <div className="h-3 bg-slate-800/50 rounded w-1/4" />
            </div>
            <div className="h-4 bg-slate-800/50 rounded w-20 hidden md:block" />
            <div className="h-4 bg-slate-800/50 rounded w-16 hidden sm:block" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-xl backdrop-blur-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-900/90 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800 tracking-wider">
            <tr>
              <th scope="col" className="py-3 px-4 w-16 text-center text-slate-500 font-semibold">
                Cover
              </th>
              {renderSortableHeader('Title & Series', 'title', 'min-w-[200px]', 'left', 'asc')}
              {renderSortableHeader('Authors', 'authors', 'min-w-[140px]', 'left', 'asc')}
              {renderSortableHeader('Collection', 'collection', 'min-w-[120px] hidden md:table-cell', 'left', 'asc')}
              {renderSortableHeader('Tags', 'tags', 'min-w-[140px] hidden lg:table-cell', 'left', 'asc')}
              {renderSortableHeader('Rating', 'rating', 'py-3 px-3 w-20', 'center', 'desc')}
              {renderSortableHeader('Formats', 'formats', 'w-28 hidden sm:table-cell', 'center', 'asc')}
              {renderSortableHeader('Year', 'pubdate', 'py-3 px-3 w-16 hidden xl:table-cell', 'right', 'desc')}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {books.map((book) => {
              const timestamp = book.timestamp ? new Date(book.timestamp).getTime() : Date.now();
              const coverUrl = `/api/v1/books/${book.id}/cover?library=${encodeURIComponent(
                libraryName
              )}&width=120&format=webp&v=${encodeURIComponent(book.uuid || String(book.id))}_${
                book.hasCover ? 1 : 0
              }_${timestamp}`;

              const formatList = book.formats ? book.formats.split(',').filter(Boolean) : [];
              const tagList = book.tags ? book.tags.split(',').filter(Boolean) : [];
              const pubYear = book.pubdate ? new Date(book.pubdate).getFullYear() : null;

              return (
                <tr
                  key={book.id}
                  onClick={() => onSelectBook(book)}
                  className="hover:bg-slate-800/50 transition-colors cursor-pointer group"
                >
                  {/* Thumbnail Cover */}
                  <td className="py-2.5 px-4 text-center">
                    <div className="w-10 h-14 bg-slate-950 rounded-lg overflow-hidden border border-slate-800 mx-auto shadow-sm group-hover:border-sky-500/50 transition-colors">
                      <img
                        src={coverUrl}
                        alt={book.title}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  </td>

                  {/* Title & Series */}
                  <td className="py-2.5 px-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-100 group-hover:text-sky-300 transition-colors line-clamp-1 text-sm">
                        {book.title}
                      </span>
                      {book.seriesName && (
                        <span className="text-[11px] font-medium text-sky-400 flex items-center gap-1 mt-0.5">
                          <Bookmark className="w-3 h-3" />
                          {book.seriesName} {book.seriesIndex ? `#${book.seriesIndex}` : ''}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Authors */}
                  <td className="py-2.5 px-4 font-medium text-slate-300">
                    <span className="line-clamp-1">{book.authors || 'Unknown Author'}</span>
                  </td>

                  {/* Collection */}
                  <td className="py-2.5 px-4 hidden md:table-cell">
                    {book.collection ? (
                      <span className="inline-block px-2 py-0.5 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 text-[11px] font-medium line-clamp-1">
                        {book.collection}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  {/* Tags */}
                  <td className="py-2.5 px-4 hidden lg:table-cell">
                    <div className="flex flex-wrap gap-1 max-w-[200px]">
                      {tagList.slice(0, 2).map((tg) => (
                        <span
                          key={tg.trim()}
                          className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] border border-slate-700/40"
                        >
                          {tg.trim()}
                        </span>
                      ))}
                      {tagList.length > 2 && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          +{tagList.length - 2}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Rating */}
                  <td className="py-2.5 px-3 text-center">
                    {book.rating !== null && book.rating > 0 ? (
                      <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold text-xs">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        <span>{book.rating.toFixed(1)}</span>
                      </div>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </td>

                  {/* Formats */}
                  <td className="py-2.5 px-4 text-center hidden sm:table-cell">
                    <div className="flex items-center justify-center gap-1">
                      {formatList.slice(0, 2).map((fmt) => (
                        <span
                          key={fmt}
                          className="px-1.5 py-0.5 rounded bg-slate-950 text-sky-300 text-[10px] font-mono font-bold uppercase border border-slate-700/50"
                        >
                          {fmt}
                        </span>
                      ))}
                      {formatList.length > 2 && (
                        <span className="text-[10px] text-slate-500 font-mono">
                          +{formatList.length - 2}
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Pub Year */}
                  <td className="py-2.5 px-3 text-right text-slate-400 font-mono hidden xl:table-cell">
                    {pubYear || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
