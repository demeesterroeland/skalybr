'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Library,
  Loader2,
  Upload,
  Sparkles,
  Shield,
  Lock,
  UserPlus,
  LogIn,
  BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth/use-auth';

interface OnboardingZeroStateProps {
  onOpenAddLibrary?: () => void;
  onOpenSetupAdmin?: () => void;
  onOpenSignIn?: () => void;
}

export default function OnboardingZeroState({
  onOpenAddLibrary,
  onOpenSetupAdmin,
  onOpenSignIn,
}: OnboardingZeroStateProps) {
  const queryClient = useQueryClient();
  const { isBootstrap, isAdmin, authenticated } = useAuth();
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

  // 1. Fresh installation: 0 users exist -> Force Administrator creation first
  if (isBootstrap) {
    return (
      <div className="min-h-screen bg-[#0e0e12] flex flex-col items-center justify-center p-6 sm:p-8 selection:bg-neutral-800">
        <div className="bg-[#1c1d22] border border-purple-500/30 rounded-3xl p-8 sm:p-12 max-w-lg w-full text-center shadow-2xl shadow-purple-950/20">
          <div className="mx-auto w-16 h-16 bg-gradient-to-tr from-purple-500/20 to-sky-500/20 border border-purple-500/30 rounded-2xl flex items-center justify-center mb-5 shadow-inner">
            <Shield className="w-8 h-8 text-purple-400" />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30 mb-3">
            <Sparkles className="w-3.5 h-3.5 text-purple-400" />
            Fresh Installation
          </span>

          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
            Initialize Skalybr
          </h2>
          <p className="text-zinc-400 mb-8 leading-relaxed text-sm sm:text-base">
            To secure this server, you must establish the primary <strong className="text-purple-300">Administrator</strong> account before configuring libraries or loading demo data.
          </p>

          <div className="w-full max-w-xs mx-auto space-y-3">
            <button
              onClick={onOpenSetupAdmin}
              className="w-full bg-gradient-to-r from-purple-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 text-white font-semibold py-3.5 px-6 rounded-xl transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-purple-600/25 cursor-pointer ring-1 ring-purple-400/40 text-sm"
            >
              <UserPlus className="w-4 h-4" />
              <span>Setup Administrator</span>
            </button>
          </div>

          <div className="mt-8 pt-5 border-t border-zinc-800/80 flex items-center justify-center gap-4 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-zinc-600" />
              Library Uploads Locked
            </span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-zinc-600" />
              Demo Data Locked
            </span>
          </div>
        </div>
      </div>
    );
  }

  // 2. Non-admin visitor when 0 libraries are available
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#0e0e12] flex flex-col items-center justify-center p-6 sm:p-8 selection:bg-neutral-800">
        <div className="bg-[#1c1d22] border border-zinc-700/60 rounded-3xl p-8 sm:p-12 max-w-lg w-full text-center shadow-2xl">
          <div className="mx-auto w-16 h-16 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center mb-6 shadow-inner">
            {authenticated ? (
              <BookOpen className="w-8 h-8 text-amber-400" />
            ) : (
              <Lock className="w-8 h-8 text-amber-400" />
            )}
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 tracking-tight">
            {authenticated ? 'No Libraries Assigned' : 'Private Server'}
          </h2>
          <p className="text-zinc-400 mb-8 leading-relaxed text-sm sm:text-base">
            {authenticated
              ? 'Your account is active, but you do not currently have access to any libraries. Please contact your system administrator to assign library permissions.'
              : 'This server has no public libraries configured. Please sign in with an authorized account to access your libraries.'}
          </p>

          {!authenticated && onOpenSignIn && (
            <div className="w-full max-w-xs mx-auto">
              <button
                onClick={onOpenSignIn}
                className="w-full bg-sky-600 hover:bg-sky-500 text-white font-semibold py-3 px-6 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 cursor-pointer text-sm"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Authenticated Admin when 0 libraries exist -> Add Library or Load Demo
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
