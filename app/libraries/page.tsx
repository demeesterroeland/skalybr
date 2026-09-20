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

/**
 * Unified Card Component used for both Library Cards and the Add Library Card.
 * Guarantees identical form, dimensions, avatar circle, and bottom section height.
 */
interface LibraryCardProps {
  title: string;
  subtitle?: string;
  seed?: string;
  isAddButton?: boolean;
  onClick: () => void;
}

function LibraryCard({
  title,
  subtitle,
  seed = 'default',
  isAddButton = false,
  onClick,
}: LibraryCardProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick();
        }
      }}
      className="group flex flex-col w-48 sm:w-52 rounded-2xl overflow-hidden cursor-pointer border border-zinc-600/50 hover:border-zinc-300 hover:ring-2 hover:ring-zinc-400/40 transition-all duration-200 shadow-xl shadow-black/50 select-none shrink-0"
    >
      {/* Top Section: Light Gray area around the circle */}
      <div className="h-44 sm:h-48 w-full bg-[#484a51] flex items-center justify-center p-4">
        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden border-2 border-white/30 group-hover:border-white/70 transition-colors shadow-lg flex items-center justify-center shrink-0 aspect-square relative bg-[#2a2c33]">
          {isAddButton ? (
            <>
              {/* Wallpaper image with a soft dark glass tint behind the large orange plus */}
              <GeometricWallpaperAvatarSVG seed="add-library-seed" />
              <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center">
                <Plus className="w-14 h-14 text-amber-400 drop-shadow-md stroke-[3] group-hover:scale-110 transition-transform" />
              </div>
            </>
          ) : (
            <GeometricWallpaperAvatarSVG seed={seed} />
          )}
        </div>
      </div>

      {/* Bottom Section: Medium Darker Gray area with identical height (h-20) */}
      <div className="h-20 w-full px-3 py-2 flex flex-col justify-center items-center text-center bg-[#2a2c33] border-t border-zinc-600/40">
        <span className="text-sm sm:text-base font-semibold text-white group-hover:text-amber-300 transition-colors truncate w-full">
          {title}
        </span>
        {subtitle ? (
          <span className="text-xs text-zinc-300 font-medium mt-1">
            {subtitle}
          </span>
        ) : null}
      </div>
    </div>
  );
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
      <div className="min-h-screen bg-[#0e0e12] flex flex-col items-center justify-center">
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
    <div className="min-h-screen bg-[#0e0e12] flex flex-col items-center justify-center p-6 sm:p-12 selection:bg-neutral-800">
      <div className="w-full max-w-5xl flex flex-col items-center justify-center">
        {/* Header - Centered */}
        <div className="mb-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Select Library
          </h1>
        </div>

        {/* Card Grid - All cards use the exact same LibraryCard component */}
        <div className="flex flex-wrap items-center justify-center gap-7 sm:gap-8 w-full">
          {libraries.map((lib) => {
            const displayName = lib.displayName || cleanLibraryName(lib.name);

            return (
              <LibraryCard
                key={lib.name}
                title={displayName}
                subtitle={`${lib.bookCount ?? 0} books`}
                seed={lib.name}
                onClick={() => handleSelect(lib.name)}
              />
            );
          })}

          {/* Add Library Card - Exact same LibraryCard component with isAddButton */}
          <LibraryCard
            isAddButton
            title="Add Library..."
            seed="add-library-button"
            onClick={() => setIsManagerOpen(true)}
          />
        </div>
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
