'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Library, Loader2, Upload, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface OnboardingZeroStateProps {
  onOpenAddLibrary?: () => void;
}

export default function OnboardingZeroState({ onOpenAddLibrary }: OnboardingZeroStateProps) {
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);

  const handleLoadDemo = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/libraries/install-demo', { method: 'POST' });
      if (res.ok) {
        toast.success('Demo library loaded successfully!');
        await queryClient.invalidateQueries({ queryKey: ['libraries'] });
      } else {
        const errorData = await res.json().catch(() => ({}));
        console.error('Failed to load demo library:', errorData);
        toast.error(errorData.error || 'Failed to load demo library');
      }
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Network error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0e12] flex flex-col items-center justify-center p-6 sm:p-8 selection:bg-neutral-800">
      <div className="bg-[#1c1d22] border border-zinc-700/60 rounded-3xl p-8 sm:p-12 max-w-lg w-full text-center shadow-2xl">
        <div className="mx-auto w-16 h-16 bg-sky-500/10 border border-sky-500/20 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
          <Library className="w-8 h-8 text-sky-400" />
        </div>

        <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
          Welcome to Skalybr
        </h2>
        <p className="text-zinc-400 mb-8 leading-relaxed text-sm sm:text-base">
          No Calibre libraries are configured yet. You can upload a library archive, mount existing libraries, or load our demo library to explore.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm mx-auto">
          {onOpenAddLibrary && (
            <button
              onClick={onOpenAddLibrary}
              className="bg-sky-500 hover:bg-sky-400 active:bg-sky-600 text-white font-semibold py-3 px-5 rounded-xl transition-all flex items-center justify-center w-full sm:w-auto flex-1 shadow-lg shadow-sky-500/20 cursor-pointer gap-2 text-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Add Library</span>
            </button>
          )}

          <button
            onClick={handleLoadDemo}
            disabled={isLoading}
            className="bg-[#2a2c33] hover:bg-[#343740] active:bg-[#25272d] text-zinc-200 border border-zinc-600/60 hover:border-zinc-500 font-semibold py-3 px-5 rounded-xl transition-all flex items-center justify-center w-full sm:w-auto flex-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer gap-2 text-sm"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-sky-400" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Load Demo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
