'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import OnboardingZeroState from '@/components/onboarding-zero-state';
import LibraryManagerModal from '@/components/LibraryManagerModal';
import { LibraryInfo } from '@/lib/types';
import { Plus } from 'lucide-react';

/**
 * Seeded pseudo-random number generator (Mulberry32)
 */
function createPRNG(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function () {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

/**
 * Geometric Abstract Wallpaper Palettes
 */
const WALLPAPER_THEMES = [
  {
    skyGradient: ['#0284c7', '#38bdf8'],
    band: '#0d9488',
    diagonalGradient: ['#e11d48', '#f97316'],
    domeGradient: ['#1d4ed8', '#06b6d4'],
  },
  {
    skyGradient: ['#4c1d95', '#7c3aed'],
    band: '#be185d',
    diagonalGradient: ['#f43f5e', '#fb923c'],
    domeGradient: ['#6366f1', '#ec4899'],
  },
  {
    skyGradient: ['#064e3b', '#059669'],
    band: '#047857',
    diagonalGradient: ['#0284c7', '#10b981'],
    domeGradient: ['#0f766e', '#14b8a6'],
  },
  {
    skyGradient: ['#1e1b4b', '#312e81'],
    band: '#1d4ed8',
    diagonalGradient: ['#ea580c', '#e11d48'],
    domeGradient: ['#2563eb', '#38bdf8'],
  },
];

/**
 * Geometric Abstract Wallpaper SVG for Avatar Circle
 */
function GeometricWallpaperAvatarSVG({ seed }: { seed: string }) {
  const { theme, variant, id } = useMemo(() => {
    const prng = createPRNG(seed);
    const themeIndex = Math.floor(prng() * WALLPAPER_THEMES.length);
    const variant = Math.floor(prng() * 3);
    const id = seed.replace(/[^a-zA-Z0-9]/g, '');
    return { theme: WALLPAPER_THEMES[themeIndex], variant, id };
  }, [seed]);

  if (variant === 0) {
    return (
      <svg
        className="w-full h-full object-cover"
        viewBox="0 0 200 200"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`sky-${id}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={theme.skyGradient[0]} />
            <stop offset="100%" stopColor={theme.skyGradient[1]} />
          </linearGradient>
          <linearGradient id={`diag-${id}`} x1="0" y1="0" x2="0.8" y2="1">
            <stop offset="0%" stopColor={theme.diagonalGradient[0]} />
            <stop offset="100%" stopColor={theme.diagonalGradient[1]} />
          </linearGradient>
          <linearGradient id={`dome-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme.domeGradient[0]} />
            <stop offset="100%" stopColor={theme.domeGradient[1]} />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="200" height="200" fill={`url(#sky-${id})`} />
        <rect x="0" y="70" width="200" height="60" fill={theme.band} />
        <polygon points="90,0 200,0 200,200 60,200" fill={`url(#diag-${id})`} />
        <ellipse cx="60" cy="180" rx="90" ry="90" fill={`url(#dome-${id})`} opacity="0.95" />
      </svg>
    );
  }

  if (variant === 1) {
    return (
      <svg
        className="w-full h-full object-cover"
        viewBox="0 0 200 200"
        preserveAspectRatio="xMidYMid slice"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id={`diag1-${id}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={theme.diagonalGradient[0]} />
            <stop offset="100%" stopColor={theme.diagonalGradient[1]} />
          </linearGradient>
          <linearGradient id={`dome1-${id}`} x1="0" y1="1" x2="1" y2="0">
            <stop offset="0%" stopColor={theme.domeGradient[0]} />
            <stop offset="100%" stopColor={theme.domeGradient[1]} />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="200" height="200" fill={theme.band} />
        <polygon points="0,30 200,0 200,120 0,170" fill={`url(#diag1-${id})`} />
        <circle cx="140" cy="150" r="90" fill={`url(#dome1-${id})`} opacity="0.9" />
        <ellipse cx="30" cy="20" rx="50" ry="50" fill={theme.skyGradient[1]} opacity="0.85" />
      </svg>
    );
  }

  return (
    <svg
      className="w-full h-full object-cover"
      viewBox="0 0 200 200"
      preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={`v-sky-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.skyGradient[0]} />
          <stop offset="100%" stopColor={theme.skyGradient[1]} />
        </linearGradient>
        <linearGradient id={`v-diag-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={theme.diagonalGradient[0]} />
          <stop offset="100%" stopColor={theme.diagonalGradient[1]} />
        </linearGradient>
        <linearGradient id={`v-dome-${id}`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.domeGradient[0]} />
          <stop offset="100%" stopColor={theme.domeGradient[1]} />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width="100" height="200" fill={`url(#v-sky-${id})`} />
      <polygon points="100,0 200,0 200,200 60,200" fill={`url(#v-diag-${id})`} />
      <rect x="0" y="80" width="80" height="50" fill={theme.band} opacity="0.9" />
      <ellipse cx="100" cy="175" rx="85" ry="80" fill={`url(#v-dome-${id})`} opacity="0.95" />
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
      <div className="min-h-screen bg-[#0e0e10] flex flex-col items-center justify-center">
        <div className="w-10 h-10 rounded-full border-2 border-neutral-800 border-t-neutral-400 animate-spin" />
        <p className="mt-4 text-neutral-500 text-sm">Loading libraries...</p>
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
    <div className="min-h-screen bg-[#0e0e10] flex flex-col items-center justify-center p-8 sm:p-16 selection:bg-neutral-800">
      <div className="w-full max-w-5xl">
        {/* Header - Simple, clean like Plex Select User */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-neutral-100 tracking-tight">
            Select Library
          </h1>
        </div>

        {/* Card Grid with ample whitespace */}
        <div className="flex flex-wrap items-start gap-6 sm:gap-7">
          {libraries.map((lib) => {
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
                className="group flex flex-col w-44 sm:w-48 rounded-xl overflow-hidden cursor-pointer border border-neutral-800 hover:border-neutral-600 hover:ring-2 hover:ring-neutral-600/40 transition-all duration-200 shadow-md bg-[#282828]"
              >
                {/* Top Gray Square with Avatar Circle */}
                <div className="h-44 sm:h-48 w-full bg-[#282828] flex items-center justify-center p-4">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-[#383838] group-hover:border-neutral-500 transition-colors shadow-inner flex items-center justify-center bg-black/40">
                    <GeometricWallpaperAvatarSVG seed={lib.name} />
                  </div>
                </div>

                {/* Bottom Darker Gray Area: Display Name at top, Book count at bottom */}
                <div className="h-16 sm:h-18 px-3 py-2.5 flex flex-col justify-center items-center text-center bg-[#1c1c1c] border-t border-neutral-800/80">
                  <span className="text-sm sm:text-base font-medium text-neutral-200 group-hover:text-white truncate w-full">
                    {displayName}
                  </span>
                  <span className="text-xs text-neutral-400 mt-0.5">
                    {lib.bookCount ?? 0} books
                  </span>
                </div>
              </div>
            );
          })}

          {/* Add Library Card - Matching Avatar Style */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setIsManagerOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                setIsManagerOpen(true);
              }
            }}
            className="group flex flex-col w-44 sm:w-48 rounded-xl overflow-hidden cursor-pointer border border-neutral-800 hover:border-neutral-600 hover:ring-2 hover:ring-neutral-600/40 transition-all duration-200 shadow-md bg-[#282828]"
          >
            {/* Top Gray Square with Avatar Circle & Orange Plus */}
            <div className="h-44 sm:h-48 w-full bg-[#282828] flex items-center justify-center p-4">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border border-neutral-700 bg-[#1c1c1c] group-hover:border-neutral-500 transition-colors shadow-inner flex items-center justify-center">
                <Plus className="w-12 h-12 text-[#d97706] stroke-[3]" />
              </div>
            </div>

            {/* Bottom Darker Gray Area: Add Library... */}
            <div className="h-16 sm:h-18 px-3 py-2.5 flex items-center justify-center text-center bg-[#1c1c1c] border-t border-neutral-800/80">
              <span className="text-sm font-medium text-neutral-400 group-hover:text-neutral-200">
                Add Library...
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Library Manager Modal (triggered by clicking "Add Library...") */}
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
