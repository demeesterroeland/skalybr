'use client';

import React, { useState } from 'react';
import { BookFlattened } from '@/lib/types';
import { Star, Book, Layers, Sparkles } from 'lucide-react';

interface BookCardProps {
  book: BookFlattened;
  libraryName: string;
  onClick: () => void;
}

export default function BookCard({ book, libraryName, onClick }: BookCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const coverUrl = `/api/v1/books/${book.id}/cover?library=${encodeURIComponent(
    libraryName
  )}&width=360&format=webp`;

  const formatList = book.formats ? book.formats.split(',').filter(Boolean) : [];

  return (
    <div
      onClick={onClick}
      className="group relative flex flex-col bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-sky-500/40 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:shadow-sky-500/5 transition-all duration-300 cursor-pointer"
    >
      {/* Cover Image Container */}
      <div className="relative aspect-[2/3] w-full bg-slate-950 overflow-hidden flex items-center justify-center">
        {book.hasCover && !imageError ? (
          <img
            src={coverUrl}
            alt={book.title}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
            onError={() => setImageError(true)}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${
              imageLoaded ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4 text-center">
            <Book className="w-10 h-10 text-slate-700 mb-2" />
            <span className="text-xs font-medium text-slate-500 line-clamp-2">{book.title}</span>
          </div>
        )}

        {/* Formats badges overlay */}
        {formatList.length > 0 && (
          <div className="absolute top-2 right-2 flex flex-wrap gap-1 justify-end max-w-[80%]">
            {formatList.slice(0, 2).map((fmt) => (
              <span
                key={fmt}
                className="px-1.5 py-0.5 rounded bg-slate-950/80 backdrop-blur-md text-[10px] font-mono font-semibold uppercase text-sky-300 border border-slate-700/50"
              >
                {fmt}
              </span>
            ))}
            {formatList.length > 2 && (
              <span className="px-1.5 py-0.5 rounded bg-slate-950/80 backdrop-blur-md text-[10px] font-mono text-slate-400 border border-slate-700/50">
                +{formatList.length - 2}
              </span>
            )}
          </div>
        )}

        {/* Rating overlay */}
        {book.rating !== null && book.rating > 0 && (
          <div className="absolute bottom-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-950/85 backdrop-blur-md border border-slate-800 text-amber-400 text-xs font-semibold">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span>{book.rating.toFixed(1)}</span>
          </div>
        )}

        {/* Custom collection tag badge */}
        {book.collection && (
          <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-sky-500/90 text-white text-[10px] font-semibold backdrop-blur-md shadow-sm">
            {book.collection}
          </div>
        )}
      </div>

      {/* Book Metadata */}
      <div className="p-3.5 flex flex-col flex-1">
        {book.seriesName && (
          <p className="text-[11px] font-semibold text-sky-400 line-clamp-1 mb-0.5">
            {book.seriesName} {book.seriesIndex ? `#${book.seriesIndex}` : ''}
          </p>
        )}

        <h3 className="text-sm font-bold text-slate-100 group-hover:text-sky-300 line-clamp-2 leading-snug transition-colors">
          {book.title}
        </h3>

        <p className="text-xs text-slate-400 line-clamp-1 mt-1 font-medium">
          {book.authors || 'Unknown Author'}
        </p>

        {book.tags && (
          <div className="mt-auto pt-2.5 flex flex-wrap gap-1">
            {book.tags
              .split(',')
              .slice(0, 2)
              .map((tag) => (
                <span
                  key={tag.trim()}
                  className="text-[10px] px-2 py-0.5 rounded-md bg-slate-800/80 text-slate-400 border border-slate-700/30 line-clamp-1"
                >
                  {tag.trim()}
                </span>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
