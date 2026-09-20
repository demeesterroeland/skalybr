'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import OnboardingZeroState from '@/components/onboarding-zero-state';
import LibraryManagerModal from '@/components/LibraryManagerModal';
import { LibraryInfo } from '@/lib/types';
import { BookOpen, Plus, Settings2, ArrowRight } from 'lucide-react';

// Deterministic artwork theme assignment based on library name
function getThemeIndex(name: string): number {
  if (name.toLowerCase().includes('demo')) return 0;
  if (name.toLowerCase().includes('boox')) return 1;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 4;
}

const THEMES = [
  {
    bg: 'bg-[#181d28]',
    borderHover: 'group-hover:border-amber-500/50',
  },
  {
    bg: 'bg-[#1a2130]',
    borderHover: 'group-hover:border-orange-500/50',
  },
  {
    bg: 'bg-[#142321]',
    borderHover: 'group-hover:border-emerald-500/50',
  },
  {
    bg: 'bg-[#1c1d2e]',
    borderHover: 'group-hover:border-indigo-500/50',
  },
];

/**
 * Clean, modernist abstract 3-tone artwork compositions.
 * Inspired by Swiss graphic design, Bauhaus, and mid-century editorial book jackets.
 */
function AbstractThreeToneArtwork({ themeIndex }: { themeIndex: number }) {
  if (themeIndex === 0) {
    // Composition 1: The Folio Arch (Slate, Oatmeal Cream & Warm Ochre)
    return (
      <svg
        className="w-40 h-40 transition-transform duration-500 ease-out group-hover:scale-105"
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Tone 1: Dark Slate Silhouette / Base Plate */}
        <rect x="24" y="24" width="112" height="112" rx="16" fill="#1e293b" />
        
        {/* Tone 2: Oatmeal Cream Geometric Arch & Spines */}
        <path
          d="M44 116 V74 C44 54.1 60.1 38 80 38 C99.9 38 116 54.1 116 74 V116 H100 V74 C100 62.9 91.1 54 80 54 C68.9 54 60 62.9 60 74 V116 H44 Z"
          fill="#e2e8f0"
        />
        <rect x="68" y="78" width="8" height="38" rx="1" fill="#cbd5e1" />
        <rect x="84" y="72" width="8" height="44" rx="1" fill="#cbd5e1" />

        {/* Tone 3: Ochre Accent Circle */}
        <circle cx="80" cy="50" r="10" fill="#d97706" />
      </svg>
    );
  }

  if (themeIndex === 1) {
    // Composition 2: The Angled Spine (Midnight Blue, Sand & Terracotta)
    return (
      <svg
        className="w-40 h-40 transition-transform duration-500 ease-out group-hover:scale-105"
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Tone 1: Midnight Blue Base */}
        <rect x="24" y="24" width="112" height="112" rx="16" fill="#0f172a" />

        {/* Tone 2: Desert Sand Angled Books & Planes */}
        <path d="M46 116 L76 44 L92 44 L62 116 Z" fill="#e2e8f0" />
        <rect x="94" y="58" width="18" height="58" rx="2" fill="#cbd5e1" />
        <path d="M40 116 H120" stroke="#94a3b8" strokeWidth="3" strokeLinecap="round" />

        {/* Tone 3: Terracotta Accent Wedge */}
        <path d="M72 44 L88 44 L70 86 L54 86 Z" fill="#ea580c" />
        <circle cx="103" cy="46" r="6" fill="#ea580c" />
      </svg>
    );
  }

  if (themeIndex === 2) {
    // Composition 3: The Rhythmic Shelf (Forest Slate, Pale Sage & Mustard Gold)
    return (
      <svg
        className="w-40 h-40 transition-transform duration-500 ease-out group-hover:scale-105"
        viewBox="0 0 160 160"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Tone 1: Forest Slate Base */}
        <rect x="24" y="24" width="112" height="112" rx="16" fill="#0f291e" />

        {/* Tone 2: Pale Sage Staggered Books */}
        <rect x="42" y="66" width="12" height="50" rx="2" fill="#a7f3d0" />
        <rect x="58" y="54" width="10" height="62" rx="2" fill="#d1fae5" />
        <rect x="72" y="74" width="14" height="42" rx="2" fill="#a7f3d0" />
        <rect x="90" y="60" width="12" height="56" rx="2" fill="#d1fae5" />
        <rect x="106" y="70" width="10" height="46" rx="2" fill="#a7f3d0" />
        <path d="M36 116 H124" stroke="#6ee7b7" strokeWidth="2.5" strokeLinecap="round" />

        {/* Tone 3: Mustard Gold Sun / Bookmark */}
        <circle cx="96" cy="46" r="8" fill="#eab308" />
      </svg>
    );
  }

  // Composition 4: The Unfolding Leaf (Indigo Slate, Ice Blue & Coral Red)
  return (
    <svg
      className="w-40 h-40 transition-transform duration-500 ease-out group-hover:scale-105"
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Tone 1: Deep Indigo Slate Base */}
      <rect x="24" y="24" width="112" height="112" rx="16" fill="#172554" />

      {/* Tone 2: Ice Blue Concentric Fan Folio */}
      <path
        d="M50 114 A 54 54 0 0 1 104 60 V114 Z"
        fill="#bfdbfe"
      />
      <path
        d="M50 114 A 36 36 0 0 1 86 78 V114 Z"
        fill="#93c5fd"
      />
      <path d="M44 114 H116" stroke="#93c5fd" strokeWidth="2.5" strokeLinecap="round" />

      {/* Tone 3: Coral Red Circular Focal Point */}
      <circle cx="104" cy="50" r="9" fill="#f43f5e" />
    </svg>
  );
}

function cleanLibraryName(name: string): string {
  const parts = name.split(/[\/\\]/);
  const raw = parts[parts.length - 1] || name;
  return raw
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function LibraryGateway() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isManagerOpen, setIsManagerOpen] = useState(false);

  const { data: libraries = [], isLoading } = useQuery<LibraryInfo[]>({
    queryKey: ['libraries'],
    queryFn: async () => {
      const res = await fetch('/api/v1/libraries');
      const json = await res.json();
      return json.data || [];
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-slate-800 border-t-slate-400 animate-spin" />
        <p className="mt-4 text-slate-500 text-sm">Loading libraries...</p>
      </div>
    );
  }

  if (!libraries || libraries.length === 0) {
    return <OnboardingZeroState />;
  }

  const handleSelect = (libName: string) => {
    try {
      localStorage.setItem('skalybr-last-library', libName);
    } catch {
      // Ignore storage errors
    }
    router.push(`/libraries/${encodeURIComponent(libName)}/books`);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 sm:p-12 selection:bg-slate-800">
      {/* Header Title Section */}
      <div className="text-center max-w-xl mb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 className="text-4xl sm:text-5xl font-bold text-slate-100 tracking-tight">
          Who&apos;s reading?
        </h1>
        <p className="text-slate-400 text-base mt-3">
          Select a library to explore your collection.
        </p>
      </div>

      {/* Library Cards Grid */}
      <div className="flex flex-wrap items-stretch justify-center gap-8 max-w-5xl w-full">
        {libraries.map((lib) => {
          const themeIdx = getThemeIndex(lib.name);
          const theme = THEMES[themeIdx];
          const displayName = lib.displayName || cleanLibraryName(lib.name);

          return (
            <div
              key={lib.name}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(lib.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  handleSelect(lib.name);
                }
              }}
              className={`group flex flex-col w-64 sm:w-72 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-700 overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1.5 shadow-lg hover:shadow-2xl ${theme.borderHover}`}
            >
              {/* Top Banner with Abstract 3-Tone Artwork */}
              <div
                className={`relative h-48 sm:h-52 w-full ${theme.bg} flex items-center justify-center p-4 border-b border-slate-800/80`}
              >
                <AbstractThreeToneArtwork themeIndex={themeIdx} />
              </div>

              {/* Card Footer Info */}
              <div className="flex-1 p-5 flex flex-col justify-between bg-slate-900">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100 tracking-tight group-hover:text-white transition-colors truncate">
                    {displayName}
                  </h3>
                  <p className="text-xs font-mono text-slate-500 mt-1 truncate">
                    {lib.name}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-5 pt-3.5 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <BookOpen className="w-3.5 h-3.5 text-slate-500" />
                    <span>{lib.bookCount ?? 0} books</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-medium text-slate-400 group-hover:text-slate-200 transition-colors">
                    <span>Open</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Library Tile */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsManagerOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setIsManagerOpen(true);
            }
          }}
          className="group flex flex-col items-center justify-center w-64 sm:w-72 min-h-[290px] rounded-2xl border border-dashed border-slate-800 hover:border-slate-600 bg-slate-900/30 hover:bg-slate-900/70 p-6 text-center cursor-pointer transition-all duration-300 hover:-translate-y-1.5 shadow-md"
        >
          <div className="w-14 h-14 rounded-xl bg-slate-800/80 border border-slate-700/60 flex items-center justify-center text-slate-400 group-hover:text-slate-200 group-hover:scale-105 transition-all duration-200">
            <Plus className="w-6 h-6" />
          </div>
          <h4 className="text-base font-semibold text-slate-200 group-hover:text-white mt-4 transition-colors">
            Add Library
          </h4>
          <p className="text-xs text-slate-500 mt-1 max-w-[180px] leading-relaxed">
            Upload a Calibre .zip archive
          </p>
        </div>
      </div>

      {/* Footer Management Button */}
      <div className="mt-12 flex items-center">
        <button
          onClick={() => setIsManagerOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all"
        >
          <Settings2 className="w-3.5 h-3.5 text-slate-500" />
          <span>Manage Libraries</span>
        </button>
      </div>

      {/* Library Manager Modal */}
      <LibraryManagerModal
        isOpen={isManagerOpen}
        onClose={() => {
          setIsManagerOpen(false);
          queryClient.invalidateQueries({ queryKey: ['libraries'] });
        }}
        currentLibrary={libraries[0]?.name || ''}
        onSelectLibrary={(libName) => {
          setIsManagerOpen(false);
          handleSelect(libName);
        }}
      />
    </div>
  );
}
