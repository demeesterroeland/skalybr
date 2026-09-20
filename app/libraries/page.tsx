'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import OnboardingZeroState from '@/components/onboarding-zero-state';
import LibraryManagerModal from '@/components/LibraryManagerModal';
import { LibraryInfo } from '@/lib/types';
import { BookOpen, Plus, Settings2, ArrowRight, FolderArchive } from 'lucide-react';

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
 * Geometric Abstract Wallpaper Palettes inspired by modern OS wallpapers
 */
const WALLPAPER_THEMES = [
  // Theme 0: Cyan, Teal, Coral Pink & Sunset Amber (Exact user reference match!)
  {
    sky: '#0284c7',
    skyGradient: ['#0284c7', '#38bdf8'],
    band: '#0d9488',
    diagonalGradient: ['#e11d48', '#f97316'],
    domeGradient: ['#1d4ed8', '#06b6d4'],
    accentCircle: '#f59e0b',
  },
  // Theme 1: Sunset Rose, Plum, Magenta & Warm Gold
  {
    sky: '#4c1d95',
    skyGradient: ['#4c1d95', '#7c3aed'],
    band: '#be185d',
    diagonalGradient: ['#f43f5e', '#fb923c'],
    domeGradient: ['#6366f1', '#ec4899'],
    accentCircle: '#fbbf24',
  },
  // Theme 2: Emerald Forest, Sage, Teal & Sun Ochre
  {
    sky: '#064e3b',
    skyGradient: ['#064e3b', '#059669'],
    band: '#047857',
    diagonalGradient: ['#0284c7', '#10b981'],
    domeGradient: ['#0f766e', '#14b8a6'],
    accentCircle: '#f59e0b',
  },
  // Theme 3: Deep Midnight Indigo, Klein Blue, Tangerine & Coral
  {
    sky: '#1e1b4b',
    skyGradient: ['#1e1b4b', '#312e81'],
    band: '#1d4ed8',
    diagonalGradient: ['#ea580c', '#e11d48'],
    domeGradient: ['#2563eb', '#38bdf8'],
    accentCircle: '#fb923c',
  },
];

/**
 * Full-bleed geometric abstract wallpaper SVG
 * Matches the user's reference image with large sweeping circular curves,
 * sharp diagonal cut planes, horizontal color bands, and intersecting gradients.
 */
function GeometricWallpaperSVG({ seed }: { seed: string }) {
  const { theme, variant, id } = useMemo(() => {
    const prng = createPRNG(seed);
    const themeIndex = Math.floor(prng() * WALLPAPER_THEMES.length);
    const variant = Math.floor(prng() * 3);
    const id = seed.replace(/[^a-zA-Z0-9]/g, '');
    return { theme: WALLPAPER_THEMES[themeIndex], variant, id };
  }, [seed]);

  if (variant === 0) {
    // Style A: Classic Reference (User's image: Left sky + teal band, Right diagonal coral, Bottom sweeping dome)
    return (
      <svg
        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        viewBox="0 0 320 420"
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

        {/* Base: Top Left Sky Blue */}
        <rect x="0" y="0" width="320" height="420" fill={`url(#sky-${id})`} />

        {/* Mid-height horizontal block */}
        <rect x="0" y="140" width="320" height="130" fill={theme.band} />

        {/* Right Sharp Diagonal Plane */}
        <polygon points="180,0 320,0 320,420 120,420" fill={`url(#diag-${id})`} />

        {/* Big Sweeping Bottom Curve (Dome / Arc) */}
        <ellipse
          cx="100"
          cy="380"
          rx="170"
          ry="170"
          fill={`url(#dome-${id})`}
          opacity="0.92"
        />

        {/* Overlapping intersection crescent */}
        <ellipse
          cx="80"
          cy="420"
          rx="140"
          ry="130"
          fill="#38bdf8"
          opacity="0.35"
        />
      </svg>
    );
  }

  if (variant === 1) {
    // Style B: Inverted dynamic diagonal with top arch and floating horizon
    return (
      <svg
        className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        viewBox="0 0 320 420"
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

        {/* Base Background */}
        <rect x="0" y="0" width="320" height="420" fill={theme.band} />

        {/* Large sweeping diagonal band */}
        <polygon points="0,60 320,0 320,240 0,340" fill={`url(#diag1-${id})`} />

        {/* Giant Circle Arc */}
        <circle cx="240" cy="320" r="180" fill={`url(#dome1-${id})`} opacity="0.9" />

        {/* Top Floating Arc */}
        <ellipse cx="60" cy="40" rx="90" ry="90" fill={theme.skyGradient[1]} opacity="0.85" />
      </svg>
    );
  }

  // Style C: Architectural vertical partition with oversized intersecting hemisphere
  return (
    <svg
      className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
      viewBox="0 0 320 420"
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

      {/* Left Vertical Half */}
      <rect x="0" y="0" width="170" height="420" fill={`url(#v-sky-${id})`} />

      {/* Right Vertical Half with Angle */}
      <polygon points="170,0 320,0 320,420 120,420" fill={`url(#v-diag-${id})`} />

      {/* Mid Horizontal Stripe */}
      <rect x="0" y="160" width="150" height="90" fill={theme.band} opacity="0.9" />

      {/* Prominent Intersecting Bottom Hemisphere */}
      <ellipse cx="160" cy="370" rx="160" ry="150" fill={`url(#v-dome-${id})`} opacity="0.95" />

      {/* Accent Geometry */}
      <circle cx="260" cy="110" r="45" fill={theme.accentCircle} opacity="0.8" />
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
        <div className="w-10 h-10 rounded-full border-2 border-slate-800 border-t-cyan-400 animate-spin" />
        <p className="mt-4 text-slate-400 text-sm font-medium">Loading libraries...</p>
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 sm:p-12 selection:bg-cyan-500/30">
      {/* Glow Backdrop */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-cyan-500/10 rounded-full blur-[140px]" />
        <div className="absolute bottom-10 left-1/3 w-[600px] h-[400px] bg-rose-500/10 rounded-full blur-[160px]" />
      </div>

      {/* Header Title Section */}
      <div className="text-center max-w-xl mb-12 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Who&apos;s reading?
        </h1>
        <p className="text-slate-400 text-base sm:text-lg mt-3">
          Select your Calibre library to enter your collection.
        </p>
      </div>

      {/* Library Wallpaper Cards Grid */}
      <div className="flex flex-wrap items-stretch justify-center gap-8 max-w-6xl w-full">
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
              className="group relative flex flex-col w-72 sm:w-80 h-[420px] rounded-3xl overflow-hidden cursor-pointer shadow-2xl transition-all duration-300 hover:scale-[1.03] hover:-translate-y-2 hover:shadow-cyan-500/25 border border-white/10"
            >
              {/* Full Tile Wallpaper Art */}
              <div className="absolute inset-0 w-full h-full overflow-hidden -z-10">
                <GeometricWallpaperSVG seed={lib.name} />
              </div>

              {/* Top Glass Badge Header */}
              <div className="p-5 flex items-center justify-between z-10">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/35 backdrop-blur-md border border-white/20 text-white/95 text-xs font-medium shadow-sm">
                  <BookOpen className="w-3.5 h-3.5 text-cyan-300" />
                  <span>{lib.bookCount ?? 0} books</span>
                </div>

                <div className="w-8 h-8 rounded-full bg-black/30 backdrop-blur-md border border-white/20 flex items-center justify-center text-white/80 group-hover:text-white group-hover:bg-black/50 transition-all shadow-sm">
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>

              {/* Bottom Scrim & Informative Text Overlay */}
              <div className="mt-auto p-6 pt-20 bg-gradient-to-t from-black/90 via-black/55 to-transparent flex flex-col justify-end z-10">
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight drop-shadow-md group-hover:text-cyan-200 transition-colors truncate">
                  {displayName}
                </h3>
                
                <div className="flex items-center gap-1.5 text-xs font-mono text-white/70 mt-1.5 drop-shadow">
                  <FolderArchive className="w-3.5 h-3.5 text-cyan-300/80" />
                  <span className="truncate">{lib.name}</span>
                </div>

                {/* Subtle Hover Action Bar */}
                <div className="mt-4 pt-3 border-t border-white/15 flex items-center justify-between text-xs font-semibold text-white/90 group-hover:text-cyan-300 transition-colors">
                  <span>Enter Collection</span>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    Explore &rarr;
                  </span>
                </div>
              </div>
            </div>
          );
        })}

        {/* Add Library Card */}
        <div
          role="button"
          tabIndex={0}
          onClick={() => setIsManagerOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              setIsManagerOpen(true);
            }
          }}
          className="group flex flex-col items-center justify-center w-72 sm:w-80 h-[420px] rounded-3xl border-2 border-dashed border-slate-700/80 hover:border-cyan-400/80 bg-slate-900/40 hover:bg-slate-900/70 p-6 text-center cursor-pointer transition-all duration-300 hover:scale-[1.03] hover:-translate-y-2 shadow-xl hover:shadow-cyan-500/10 backdrop-blur-md"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 border border-slate-700/70 flex items-center justify-center text-slate-300 group-hover:text-cyan-300 group-hover:scale-110 group-hover:border-cyan-500/50 transition-all duration-300 shadow-inner">
            <Plus className="w-8 h-8" />
          </div>
          <h4 className="text-xl font-bold text-slate-100 group-hover:text-white mt-5 transition-colors">
            Add Library
          </h4>
          <p className="text-xs text-slate-400 mt-2 max-w-[200px] leading-relaxed">
            Upload a Calibre .zip archive or connect existing directories
          </p>
        </div>
      </div>

      {/* Footer Management Button */}
      <div className="mt-12 flex items-center">
        <button
          onClick={() => setIsManagerOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-semibold tracking-wide transition-all shadow-md active:scale-95"
        >
          <Settings2 className="w-4 h-4 text-slate-400" />
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
