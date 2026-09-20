'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import OnboardingZeroState from '@/components/onboarding-zero-state';
import LibraryManagerModal from '@/components/LibraryManagerModal';
import { LibraryInfo } from '@/lib/types';
import { BookOpen, Plus, Settings2, Sparkles, BookMarked, Layers, ArrowRight } from 'lucide-react';

// Deterministic theme assignment based on library name
function getThemeIndex(name: string): number {
  if (name.toLowerCase().includes('demo')) return 0;
  if (name.toLowerCase().includes('boox')) return 2;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 4;
}

const THEMES = [
  {
    name: 'celestial',
    gradient: 'from-violet-600/30 via-indigo-900/40 to-slate-950',
    accentBorder: 'group-hover:border-violet-500/60 group-hover:shadow-violet-500/20',
    tagBg: 'bg-violet-500/10 text-violet-300 border-violet-500/20',
    glowColor: '#8b5cf6',
    icon: Sparkles,
  },
  {
    name: 'emerald',
    gradient: 'from-emerald-600/30 via-teal-900/40 to-slate-950',
    accentBorder: 'group-hover:border-emerald-500/60 group-hover:shadow-emerald-500/20',
    tagBg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    glowColor: '#10b981',
    icon: BookMarked,
  },
  {
    name: 'amber',
    gradient: 'from-amber-600/30 via-rose-900/40 to-slate-950',
    accentBorder: 'group-hover:border-amber-500/60 group-hover:shadow-amber-500/20',
    tagBg: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    glowColor: '#f59e0b',
    icon: BookOpen,
  },
  {
    name: 'sapphire',
    gradient: 'from-sky-600/30 via-blue-900/40 to-slate-950',
    accentBorder: 'group-hover:border-sky-500/60 group-hover:shadow-sky-500/20',
    tagBg: 'bg-sky-500/10 text-sky-300 border-sky-500/20',
    glowColor: '#0ea5e9',
    icon: Layers,
  },
];

function LibraryArtworkIllustration({ themeIndex }: { themeIndex: number }) {
  if (themeIndex === 0) {
    // Celestial Open Book
    return (
      <svg className="w-36 h-36 drop-shadow-2xl transition-transform duration-500 group-hover:scale-110" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="80" cy="80" r="65" stroke="url(#c-orb)" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
        <circle cx="80" cy="80" r="48" stroke="url(#c-orb2)" strokeWidth="1.5" opacity="0.6" />
        {/* Radiating Light */}
        <path d="M80 35 V20M48 48 L36 36M112 48 L124 36" stroke="#c4b5fd" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
        {/* Open Book Wings */}
        <path d="M80 68 C80 68 55 60 30 68 C27 69 25 72 25 76 V116 C25 120 28 122 32 121 C55 114 80 120 80 120 C80 120 105 114 128 121 C132 122 135 120 135 116 V76 C135 72 133 69 130 68 C105 60 80 68 80 68 Z" fill="url(#c-book-bg)" stroke="#a78bfa" strokeWidth="2" />
        {/* Book Spine Center */}
        <path d="M80 68 V120" stroke="#c4b5fd" strokeWidth="2.5" strokeLinecap="round" />
        {/* Page lines */}
        <path d="M38 82 C52 78 68 81 72 82 M38 94 C52 90 68 93 72 94 M38 106 C52 102 68 105 72 106" stroke="#ddd6fe" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <path d="M122 82 C108 78 92 81 88 82 M122 94 C108 90 92 93 88 94 M122 106 C108 102 92 105 88 106" stroke="#ddd6fe" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        {/* Floating Sparkles */}
        <polygon points="80,42 82,47 87,49 82,51 80,56 78,51 73,49 78,47" fill="#f5d0fe" />
        <polygon points="120,62 121,65 124,66 121,67 120,70 119,67 116,66 119,65" fill="#f5d0fe" />
        <polygon points="40,62 41,65 44,66 41,67 40,70 39,67 36,66 39,65" fill="#f5d0fe" />
        <defs>
          <linearGradient id="c-orb" x1="15" y1="15" x2="145" y2="145" gradientUnits="userSpaceOnUse">
            <stop stopColor="#a78bfa" />
            <stop offset="1" stopColor="#4338ca" />
          </linearGradient>
          <linearGradient id="c-orb2" x1="32" y1="32" x2="128" y2="128" gradientUnits="userSpaceOnUse">
            <stop stopColor="#c084fc" />
            <stop offset="1" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="c-book-bg" x1="25" y1="65" x2="135" y2="125" gradientUnits="userSpaceOnUse">
            <stop stopColor="#312e81" />
            <stop offset="1" stopColor="#1e1b4b" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (themeIndex === 1) {
    // Emerald Classical Arched Library
    return (
      <svg className="w-36 h-36 drop-shadow-2xl transition-transform duration-500 group-hover:scale-110" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M40 135 V60 C40 38 58 20 80 20 C102 20 120 38 120 60 V135" stroke="#34d399" strokeWidth="2" strokeDasharray="3 3" opacity="0.5" />
        <path d="M50 135 V62 C50 45 63 32 80 32 C97 32 110 45 110 62 V135" fill="url(#e-arch)" stroke="#10b981" strokeWidth="1.5" />
        {/* Bookshelf Racks */}
        <rect x="58" y="70" width="44" height="2" fill="#6ee7b7" opacity="0.8" />
        <rect x="58" y="102" width="44" height="2" fill="#6ee7b7" opacity="0.8" />
        {/* Top Books Row */}
        <rect x="62" y="48" width="6" height="22" rx="1" fill="#10b981" />
        <rect x="70" y="44" width="7" height="26" rx="1" fill="#059669" />
        <rect x="79" y="50" width="6" height="20" rx="1" fill="#34d399" />
        <rect x="87" y="46" width="8" height="24" rx="1" fill="#047857" />
        {/* Middle Books Row */}
        <rect x="62" y="78" width="7" height="24" rx="1" fill="#059669" />
        <rect x="71" y="82" width="6" height="20" rx="1" fill="#34d399" />
        <rect x="79" y="76" width="8" height="26" rx="1" fill="#10b981" />
        <rect x="89" y="80" width="6" height="22" rx="1" fill="#047857" />
        {/* Bottom Pedestal */}
        <path d="M30 135 H130" stroke="#34d399" strokeWidth="3" strokeLinecap="round" />
        <path d="M45 140 H115" stroke="#059669" strokeWidth="2" strokeLinecap="round" />
        <defs>
          <linearGradient id="e-arch" x1="80" y1="32" x2="80" y2="135" gradientUnits="userSpaceOnUse">
            <stop stopColor="#064e3b" stopOpacity="0.8" />
            <stop offset="1" stopColor="#022c22" stopOpacity="0.9" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (themeIndex === 2) {
    // Amber Stately Stacked Hardcovers
    return (
      <svg className="w-36 h-36 drop-shadow-2xl transition-transform duration-500 group-hover:scale-110" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="80" cy="80" r="58" fill="url(#a-glow)" opacity="0.4" />
        {/* Bottom Book */}
        <rect x="30" y="112" width="100" height="18" rx="3" fill="#b45309" stroke="#f59e0b" strokeWidth="1.5" />
        <rect x="38" y="115" width="84" height="12" rx="1" fill="#fef3c7" opacity="0.9" />
        <rect x="30" y="112" width="14" height="18" rx="2" fill="#78350f" />
        <line x1="37" y1="114" x2="37" y2="128" stroke="#f59e0b" strokeWidth="1" />
        {/* Middle Book */}
        <rect x="38" y="90" width="86" height="18" rx="3" fill="#9f1239" stroke="#fb7185" strokeWidth="1.5" transform="rotate(-3 81 99)" />
        <rect x="46" y="93" width="70" height="12" rx="1" fill="#fff1f2" opacity="0.9" transform="rotate(-3 81 99)" />
        {/* Ribbon Bookmark */}
        <path d="M102 92 V118 L98 114 L94 118 V92" fill="#f59e0b" />
        {/* Top Book */}
        <rect x="46" y="68" width="72" height="18" rx="3" fill="#d97706" stroke="#fbbf24" strokeWidth="1.5" transform="rotate(2 82 77)" />
        <rect x="52" y="71" width="58" height="12" rx="1" fill="#fef3c7" opacity="0.9" transform="rotate(2 82 77)" />
        {/* Open Coffee Mug / Accent */}
        <circle cx="80" cy="46" r="14" fill="#78350f" stroke="#f59e0b" strokeWidth="1.5" />
        <path d="M74 46 C74 42 86 42 86 46" stroke="#fde68a" strokeWidth="1.5" strokeLinecap="round" />
        <defs>
          <radialGradient id="a-glow" cx="0.5" cy="0.5" r="0.5" fx="0.5" fy="0.5">
            <stop stopColor="#f59e0b" />
            <stop offset="1" stopColor="#451a03" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
    );
  }

  // Sapphire Modern Digital Codex
  return (
    <svg className="w-36 h-36 drop-shadow-2xl transition-transform duration-500 group-hover:scale-110" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="30" y="30" width="100" height="100" rx="20" stroke="#38bdf8" strokeWidth="1" strokeDasharray="4 4" opacity="0.4" />
      {/* Isometric Books */}
      <g transform="translate(80, 85)">
        {/* Isometric Book Left */}
        <path d="M-40 -20 L0 0 L0 35 L-40 15 Z" fill="#0284c7" stroke="#38bdf8" strokeWidth="1.5" />
        {/* Isometric Book Right */}
        <path d="M40 -20 L0 0 L0 35 L40 15 Z" fill="#0369a1" stroke="#0ea5e9" strokeWidth="1.5" />
        {/* Isometric Book Top Left */}
        <path d="M-40 -20 L0 -40 L40 -20 L0 0 Z" fill="#38bdf8" stroke="#7dd3fc" strokeWidth="1.5" />
        {/* Data rings */}
        <ellipse cx="0" cy="-45" rx="25" ry="10" stroke="#bae6fd" strokeWidth="1" strokeDasharray="3 3" />
        <circle cx="0" cy="-45" r="3" fill="#e0f2fe" />
      </g>
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
        <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-sky-400 animate-spin" />
        <p className="mt-4 text-slate-400 text-sm font-medium">Scanning libraries...</p>
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 sm:p-12 selection:bg-sky-500/30">
      {/* Glow Background Backdrop */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-sky-500/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[400px] bg-violet-500/10 rounded-full blur-[140px]" />
      </div>

      {/* Header Title Section */}
      <div className="text-center max-w-2xl mb-12 animate-in fade-in slide-in-from-bottom-3 duration-700">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/80 border border-slate-800 text-xs font-medium text-slate-400 mb-4 shadow-inner">
          <BookOpen className="w-3.5 h-3.5 text-sky-400" />
          <span>Skalybr Calibre Hub</span>
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold text-white tracking-tight">
          Who&apos;s reading?
        </h1>
        <p className="text-slate-400 text-base sm:text-lg mt-3">
          Select a Calibre library to open your collection and resume reading.
        </p>
      </div>

      {/* Library Cards Grid */}
      <div className="flex flex-wrap items-stretch justify-center gap-8 max-w-6xl w-full">
        {libraries.map((lib) => {
          const themeIdx = getThemeIndex(lib.name);
          const theme = THEMES[themeIdx];
          const displayName = lib.displayName || cleanLibraryName(lib.name);
          const ThemeIcon = theme.icon;

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
              className={`group relative flex flex-col w-64 sm:w-72 rounded-3xl bg-slate-900/60 border border-slate-800/80 backdrop-blur-md overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:scale-[1.02] shadow-xl hover:shadow-2xl ${theme.accentBorder}`}
            >
              {/* Top Banner Artwork */}
              <div
                className={`relative h-48 sm:h-52 w-full bg-gradient-to-b ${theme.gradient} flex items-center justify-center p-6 overflow-hidden border-b border-slate-800/60`}
              >
                {/* Subtle Radial Glow */}
                <div
                  className="absolute inset-0 opacity-40 group-hover:opacity-70 transition-opacity duration-500 blur-2xl"
                  style={{
                    background: `radial-gradient(circle at center, ${theme.glowColor} 0%, transparent 70%)`,
                  }}
                />

                {/* Badge in corner */}
                <div className="absolute top-3.5 left-3.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-950/60 backdrop-blur-md border border-white/10 text-[11px] font-medium text-slate-300">
                  <ThemeIcon className="w-3 h-3 text-white/80" />
                  <span className="capitalize">{theme.name}</span>
                </div>

                {/* Main Illustration */}
                <LibraryArtworkIllustration themeIndex={themeIdx} />
              </div>

              {/* Card Footer Info */}
              <div className="flex-1 p-5 flex flex-col justify-between bg-slate-900/90">
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight group-hover:text-sky-300 transition-colors truncate">
                    {displayName}
                  </h3>
                  <p className="text-xs font-mono text-slate-400 mt-1 truncate">
                    {lib.name}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-5 pt-3.5 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                    <BookOpen className="w-3.5 h-3.5 text-slate-400" />
                    <span>{lib.bookCount ?? 0} books</span>
                  </div>

                  <div className="flex items-center gap-1 text-xs font-semibold text-sky-400 group-hover:translate-x-1 transition-transform">
                    <span>Enter</span>
                    <ArrowRight className="w-3.5 h-3.5" />
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
          className="group flex flex-col items-center justify-center w-64 sm:w-72 min-h-[300px] rounded-3xl border-2 border-dashed border-slate-800 hover:border-sky-500/70 bg-slate-900/30 hover:bg-slate-900/70 p-6 text-center cursor-pointer transition-all duration-300 hover:-translate-y-2 shadow-lg hover:shadow-sky-500/10 backdrop-blur-sm"
        >
          <div className="w-16 h-16 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-center text-slate-400 group-hover:text-sky-400 group-hover:scale-110 group-hover:border-sky-500/50 transition-all duration-300 shadow-inner">
            <Plus className="w-8 h-8" />
          </div>
          <h4 className="text-lg font-bold text-slate-200 group-hover:text-white mt-5 transition-colors">
            Add Library
          </h4>
          <p className="text-xs text-slate-500 mt-1.5 max-w-[200px] leading-relaxed">
            Upload a Calibre .zip archive or connect existing directories
          </p>
        </div>
      </div>

      {/* Footer Management Button */}
      <div className="mt-14 flex items-center gap-4">
        <button
          onClick={() => setIsManagerOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition-all shadow-md active:scale-95"
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
