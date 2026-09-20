'use client';

import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import OnboardingZeroState from '@/components/onboarding-zero-state';
import LibraryManagerModal from '@/components/LibraryManagerModal';
import { LibraryInfo } from '@/lib/types';
import { BookOpen, Plus, Settings2, ArrowRight } from 'lucide-react';

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
 * 3-Tone palettes inspired by nice-color-palettes & generative-placeholders
 */
const PALETTES = [
  { bg: '#0f172a', primary: '#cbd5e1', accent: '#f59e0b', stroke: '#94a3b8' }, // Slate & Warm Amber
  { bg: '#0b192c', primary: '#e2e8f0', accent: '#008b8b', stroke: '#64748b' }, // Midnight & Teal
  { bg: '#18181b', primary: '#f4f4f5', accent: '#e11d48', stroke: '#71717a' }, // Charcoal & Crimson
  { bg: '#06201b', primary: '#d1fae5', accent: '#ca8a04', stroke: '#34d399' }, // Forest & Ochre
  { bg: '#172554', primary: '#e0f2fe', accent: '#f97316', stroke: '#60a5fa' }, // Deep Blue & Tangerine
];

/**
 * Generative Style 1: Cubic Disarray (Georg Nees, 1968)
 * A grid of squares that progressively jitter and rotate with increasing entropy.
 */
function renderCubicDisarray(prng: () => number, palette: typeof PALETTES[0]) {
  const cols = 9;
  const rows = 6;
  const size = 26;
  const startX = 25;
  const startY = 22;
  const squares = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const entropy = (y / (rows - 1));
      const rotate = entropy * (prng() - 0.5) * 45;
      const offsetX = entropy * (prng() - 0.5) * 12;
      const offsetY = entropy * (prng() - 0.5) * 12;
      const isAccent = prng() < 0.12;

      squares.push(
        <rect
          key={`${x}-${y}`}
          x={-size / 2}
          y={-size / 2}
          width={size}
          height={size}
          fill={isAccent ? palette.accent : 'none'}
          fillOpacity={isAccent ? 0.85 : 0}
          stroke={isAccent ? palette.accent : palette.primary}
          strokeWidth={1.5}
          transform={`translate(${startX + x * size + size / 2 + offsetX}, ${startY + y * size + size / 2 + offsetY}) rotate(${rotate})`}
        />
      );
    }
  }

  return squares;
}

/**
 * Generative Style 2: 10 PRINT Maze (Commodore 64 algorithm)
 * Rhythmic maze patterns formed from procedurally angled slash lines.
 */
function render10Print(prng: () => number, palette: typeof PALETTES[0]) {
  const cols = 12;
  const rows = 8;
  const stepX = 280 / cols;
  const stepY = 190 / rows;
  const elements = [];

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const leftToRight = prng() > 0.5;
      const isAccent = prng() < 0.15;
      const strokeColor = isAccent ? palette.accent : palette.primary;
      const strokeWidth = isAccent ? 2.5 : 1.5;

      const x1 = 10 + x * stepX;
      const y1 = 10 + y * stepY;
      const x2 = x1 + stepX;
      const y2 = y1 + stepY;

      if (leftToRight) {
        elements.push(
          <line
            key={`line-${x}-${y}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );
      } else {
        elements.push(
          <line
            key={`line-${x}-${y}`}
            x1={x1}
            y1={y2}
            x2={x2}
            y2={y1}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
        );
      }

      // Occasional geometric dot at intersections
      if (prng() < 0.08) {
        elements.push(
          <circle
            key={`dot-${x}-${y}`}
            cx={x1}
            cy={y1}
            r={3}
            fill={palette.accent}
          />
        );
      }
    }
  }

  return elements;
}

/**
 * Generative Style 3: Joy Division / Unknown Pleasures Pulse Waves
 * Stacked topographic elevation waveforms with centered noise peaks.
 */
function renderJoyDivision(prng: () => number, palette: typeof PALETTES[0]) {
  const lineCount = 14;
  const pointsPerLine = 32;
  const width = 280;
  const height = 190;
  const stepY = (height - 40) / lineCount;
  const paths = [];

  for (let i = 0; i < lineCount; i++) {
    const baseY = 25 + i * stepY;
    let d = `M 20 ${baseY}`;

    for (let j = 0; j <= pointsPerLine; j++) {
      const x = 20 + (j / pointsPerLine) * (width - 40);
      const distFromCenter = Math.abs(j - pointsPerLine / 2) / (pointsPerLine / 2);
      const bell = Math.max(0, 1 - distFromCenter * distFromCenter);
      const noise = (prng() * 18 + 2) * Math.pow(bell, 2.5);
      const y = baseY - noise;
      d += ` L ${x} ${y}`;
    }

    const isAccent = i === Math.floor(lineCount / 2);

    paths.push(
      <g key={`wave-${i}`}>
        {/* Fill to occlude lines behind it */}
        <path
          d={`${d} L 260 ${baseY + 12} L 20 ${baseY + 12} Z`}
          fill={palette.bg}
        />
        {/* Stroke line */}
        <path
          d={d}
          fill="none"
          stroke={isAccent ? palette.accent : palette.primary}
          strokeWidth={isAccent ? 2 : 1.5}
          strokeLinecap="round"
        />
      </g>
    );
  }

  return paths;
}

/**
 * Generative Style 4: Piet Mondrian De Stijl Partition
 * Recursive rectangular divisions with primary accent blocks.
 */
function renderMondrian(prng: () => number, palette: typeof PALETTES[0]) {
  const width = 270;
  const height = 180;
  const xSplits = [40, 100, 175, 230].sort((a, b) => a - b);
  const ySplits = [40, 95, 140].sort((a, b) => a - b);
  const rects = [];

  const allX = [15, ...xSplits, width + 15];
  const allY = [15, ...ySplits, height + 15];

  for (let i = 0; i < allX.length - 1; i++) {
    for (let j = 0; j < allY.length - 1; j++) {
      const rx = allX[i];
      const ry = allY[j];
      const rw = allX[i + 1] - rx;
      const rh = allY[j + 1] - ry;

      const fillRoll = prng();
      let fill = 'none';
      if (fillRoll < 0.12) fill = palette.accent;
      else if (fillRoll < 0.28) fill = palette.stroke;

      rects.push(
        <rect
          key={`m-${i}-${j}`}
          x={rx}
          y={ry}
          width={rw}
          height={rh}
          fill={fill}
          fillOpacity={fill === 'none' ? 0 : 0.85}
          stroke={palette.primary}
          strokeWidth={2}
        />
      );
    }
  }

  return rects;
}

/**
 * Deterministic Generative Placeholder Component
 */
function GenerativePlaceholder({ seed }: { seed: string }) {
  const { palette, styleName, content } = useMemo(() => {
    const prng = createPRNG(seed);
    const paletteIndex = Math.floor(prng() * PALETTES.length);
    const palette = PALETTES[paletteIndex];
    const stylePick = Math.floor(prng() * 4);

    let content;
    let styleName = 'Cubic Disarray';

    if (stylePick === 0) {
      styleName = 'Cubic Disarray';
      content = renderCubicDisarray(prng, palette);
    } else if (stylePick === 1) {
      styleName = '10 PRINT';
      content = render10Print(prng, palette);
    } else if (stylePick === 2) {
      styleName = 'Pulse Waves';
      content = renderJoyDivision(prng, palette);
    } else {
      styleName = 'Mondrian';
      content = renderMondrian(prng, palette);
    }

    return { palette, styleName, content };
  }, [seed]);

  return (
    <div
      className="relative w-full h-full flex items-center justify-center overflow-hidden"
      style={{ backgroundColor: palette.bg }}
    >
      <svg
        className="w-full h-full p-2 transition-transform duration-500 ease-out group-hover:scale-105"
        viewBox="0 0 300 200"
        preserveAspectRatio="xMidYMid meet"
      >
        {content}
      </svg>
    </div>
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
          Select a Calibre library to open your collection.
        </p>
      </div>

      {/* Library Cards Grid */}
      <div className="flex flex-wrap items-stretch justify-center gap-8 max-w-5xl w-full">
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
              className="group flex flex-col w-64 sm:w-72 rounded-2xl bg-slate-900 border border-slate-800 hover:border-slate-600 overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1.5 shadow-lg hover:shadow-2xl hover:shadow-black/50"
            >
              {/* Top Banner with Generative 3-Tone Artwork */}
              <div className="relative h-48 sm:h-52 w-full border-b border-slate-800 overflow-hidden">
                <GenerativePlaceholder seed={lib.name} />
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
