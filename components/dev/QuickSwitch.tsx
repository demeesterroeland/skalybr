'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth/use-auth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FlaskConical,
  User,
  BookOpen,
  Edit3,
  Shield,
  ChevronUp,
  ChevronDown,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

type PersonaKey = 'guest' | 'reader' | 'curator' | 'admin';

interface PersonaOption {
  key: PersonaKey;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  activeClass: string;
}

const PERSONAS: PersonaOption[] = [
  {
    key: 'guest',
    label: 'Guest',
    sublabel: 'Unauthenticated',
    icon: User,
    activeClass: 'bg-slate-700/80 text-white border-slate-500 shadow-sm',
  },
  {
    key: 'reader',
    label: 'Reader',
    sublabel: 'Test Reader',
    icon: BookOpen,
    activeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/40 shadow-sm shadow-sky-500/10',
  },
  {
    key: 'curator',
    label: 'Curator',
    sublabel: 'Test Curator',
    icon: Edit3,
    activeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm shadow-emerald-500/10',
  },
  {
    key: 'admin',
    label: 'Admin',
    sublabel: 'Root Admin',
    icon: Shield,
    activeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm shadow-purple-500/10',
  },
];

export default function QuickSwitch() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, authenticated, isAdmin, role } = useAuth();
  const [isExpanded, setIsExpanded] = useState(true);

  // Determine active persona
  let currentPersona: PersonaKey = 'guest';
  if (authenticated) {
    if (isAdmin) {
      currentPersona = 'admin';
    } else if (role === 'curator') {
      currentPersona = 'curator';
    } else {
      currentPersona = 'reader';
    }
  }

  const switchMutation = useMutation({
    mutationFn: async (persona: PersonaKey) => {
      const res = await fetch('/api/v1/dev/quickswitch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Failed to switch persona');
      }
      return json;
    },
    onSuccess: (data) => {
      if (data.persona === 'guest') {
        queryClient.setQueriesData({ queryKey: ['auth', 'me'] }, {
          authenticated: false,
          user: null,
          role: 'none',
          isBootstrap: false,
        });
      } else {
        queryClient.setQueriesData({ queryKey: ['auth', 'me'] }, {
          authenticated: true,
          user: data.user,
          role: data.persona === 'admin' ? 'admin' : (data.persona === 'curator' ? 'curator' : 'reader'),
          isBootstrap: false,
        });
      }
      queryClient.invalidateQueries();
      router.refresh();
      toast.success(`Dev Persona switched to: ${data.persona.toUpperCase()}`);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error switching persona');
    },
  });

  return (
    <aside
      aria-label="Development Persona Switcher"
      className="fixed bottom-4 right-4 z-40 select-none animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="bg-slate-900/95 backdrop-blur-md border border-slate-800 rounded-2xl shadow-2xl p-1.5 flex flex-col gap-1.5 transition-all">
        {/* Header Pill */}
        <div className="flex items-center justify-between gap-2 px-2.5 py-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <div className="flex items-center gap-1.5">
              <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold text-slate-300 tracking-wide uppercase font-mono">
                QuickSwitch
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setIsExpanded((prev) => !prev)}
              className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title={isExpanded ? 'Collapse QuickSwitch' : 'Expand QuickSwitch'}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronUp className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>

        {/* Personas Bar */}
        {isExpanded && (
          <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800/80">
            {PERSONAS.map((p) => {
              const Icon = p.icon;
              const isCurrent = currentPersona === p.key;
              const isLoadingThis = switchMutation.isPending && switchMutation.variables === p.key;

              return (
                <button
                  key={p.key}
                  disabled={switchMutation.isPending}
                  onClick={() => switchMutation.mutate(p.key)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer disabled:opacity-50 ${
                    isCurrent
                      ? p.activeClass
                      : 'border-transparent text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                  title={`${p.label} — ${p.sublabel}`}
                >
                  {isLoadingThis ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Icon className="w-3.5 h-3.5" />
                  )}
                  <span>{p.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
