'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { LibraryInfo } from '@/lib/types';
import { BookOpen, ChevronDown } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

interface LibrarySelectorProps {
  currentLibrary: string;
  onSelectLibrary: (lib: string) => void;
  onOpenManager?: () => void;
}

export default function LibrarySelector({
  currentLibrary,
  onSelectLibrary,
  onOpenManager,
}: LibrarySelectorProps) {
  const { data: libraries = [] } = useQuery<LibraryInfo[]>({
    queryKey: ['libraries'],
    queryFn: async () => {
      const res = await fetch('/api/v1/libraries');
      const json = await res.json();
      return json.data || [];
    },
  });

  const active = libraries.find((l) => l.name === currentLibrary);

  // Don't render if no libraries exist
  if (libraries.length === 0) {
    return null;
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 text-sm font-medium transition-all text-slate-200 hover:text-white shadow-sm cursor-pointer">
          <BookOpen className="w-4 h-4 text-sky-400" />
          {active ? (
            <>
              <span className="max-w-[140px] sm:max-w-[200px] truncate">
                {active.displayName || active.name}
              </span>
              {active.bookCount > 0 && (
                <span className="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded-md font-mono">
                  {active.bookCount}
                </span>
              )}
            </>
          ) : (
            <span className="max-w-[140px] sm:max-w-[200px] truncate text-sky-300 font-medium">
              &lt; select a library &gt;
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-1" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="min-w-[240px] bg-slate-900/95 backdrop-blur-md rounded-xl p-1.5 shadow-2xl border border-slate-800 text-slate-200 z-50 animate-in fade-in-50 zoom-in-95"
          sideOffset={6}
          align="start"
        >
          <div className="px-2.5 py-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Calibre Libraries</span>
            {onOpenManager && (
              <button
                onClick={onOpenManager}
                className="text-[11px] text-sky-400 hover:text-sky-300 font-semibold lowercase cursor-pointer"
              >
                + manage
              </button>
            )}
          </div>

          {libraries.map((lib) => (
            <DropdownMenu.Item
              key={lib.name}
              onClick={() => onSelectLibrary(lib.name)}
              className={`flex items-center justify-between px-3 py-2 text-sm rounded-lg cursor-pointer outline-none transition-colors ${
                lib.name === currentLibrary
                  ? 'bg-sky-500/15 text-sky-400 font-medium'
                  : 'hover:bg-slate-800/80 text-slate-300 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2 truncate pr-2">
                <BookOpen
                  className={`w-4 h-4 shrink-0 ${
                    lib.name === currentLibrary ? 'text-sky-400' : 'text-slate-500'
                  }`}
                />
                <span className="truncate">{lib.displayName || lib.name}</span>
              </div>
              <span className="text-xs text-slate-500 font-mono bg-slate-800/60 px-1.5 py-0.5 rounded shrink-0">
                {lib.bookCount}
              </span>
            </DropdownMenu.Item>
          ))}

          {onOpenManager && (
            <div className="pt-1.5 mt-1.5 border-t border-slate-800/80">
              <DropdownMenu.Item
                onClick={onOpenManager}
                className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-semibold text-sky-400 hover:text-sky-300 hover:bg-slate-800/80 rounded-lg cursor-pointer transition-colors"
              >
                <span>Upload or Manage Libraries...</span>
              </DropdownMenu.Item>
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
