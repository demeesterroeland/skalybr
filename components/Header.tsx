'use client';

import React, { useState } from 'react';
import LibrarySelector from './LibrarySelector';
import LibraryManagerModal from './LibraryManagerModal';
import AuthModal from './auth/AuthModal';
import AdminModal from './admin/AdminModal';
import { useAuth } from '@/lib/auth/use-auth';
import { useQuery } from '@tanstack/react-query';
import type { SafeUserRecord } from '@/lib/types';
import {
  Code2,
  FolderArchive,
  LogOut,
  Shield,
  User,
  ChevronDown,
  LogIn,
  UserPlus,
  Sparkles,
} from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import Link from 'next/link';
import { APP_VERSION } from '@/lib/constants';
import { useRouter } from 'next/navigation';

interface HeaderProps {
  currentLibrary: string;
}

export default function Header({ currentLibrary }: HeaderProps) {
  const [isManagerOpen, setIsManagerOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'signin' | 'register'>('signin');
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  const router = useRouter();
  const { user, authenticated, isAdmin, isBootstrap, role, logout } = useAuth({
    library: currentLibrary,
  });

  const { data: pendingUsers = [] } = useQuery<SafeUserRecord[]>({
    queryKey: ['admin', 'users', 'pending'],
    queryFn: async () => {
      const res = await fetch('/api/v1/admin/users?status=pending');
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!isAdmin,
    staleTime: 15 * 1000,
  });

  const handleSelectLibrary = (lib: string) => {
    try {
      localStorage.setItem('skalybr-last-library', lib);
    } catch (e) {
      // Ignore
    }
    router.push(`/libraries/${encodeURIComponent(lib)}/books`);
  };

  const getInitials = () => {
    if (!user) return '??';
    const name = user.displayName || user.username;
    return name.slice(0, 2).toUpperCase();
  };

  const openSignIn = () => {
    setAuthTab('signin');
    setIsAuthOpen(true);
  };

  const openRegister = () => {
    setAuthTab('register');
    setIsAuthOpen(true);
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Logo & Brand */}
        <div className="flex items-center gap-4 sm:gap-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-lg shadow-sky-500/20 group-hover:scale-105 transition-transform">
              <span className="text-xl">🗡️</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-lg font-bold tracking-tight text-white group-hover:text-sky-300 transition-colors">
                  Skalybr
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  v{APP_VERSION}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">Calibre E-Book Platform</p>
            </div>
          </Link>

          {/* Library Switcher */}
          <LibrarySelector
            currentLibrary={currentLibrary}
            onSelectLibrary={handleSelectLibrary}
            onOpenManager={() => setIsManagerOpen(true)}
          />
        </div>

        {/* Right Nav links & Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Manage Libraries Button (Admin only) */}
          {isAdmin && (
            <button
              onClick={() => setIsManagerOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer shadow-sm"
              title="Upload, rename, download, or manage libraries"
            >
              <FolderArchive className="w-4 h-4 text-sky-400" />
              <span className="hidden sm:inline">Manage Libraries</span>
            </button>
          )}

          <Link
            href="/api/reference"
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all"
            title="OpenAPI 3.1 Documentation via Scalar"
          >
            <Code2 className="w-4 h-4 text-sky-400" />
            <span className="hidden md:inline">API Reference</span>
          </Link>

          <a
            href="https://github.com/demeesterroeland/skalybr"
            target="_blank"
            rel="noreferrer"
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-900 border border-transparent hover:border-slate-800 transition-all"
            title="GitHub Repository"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
              />
            </svg>
          </a>

          {/* Divider */}
          <div className="h-4 w-[1px] bg-slate-800" />

          {/* Auth Controls */}
          {!authenticated ? (
            <div className="flex items-center gap-2">
              <button
                onClick={openSignIn}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5 text-sky-400" />
                <span>Sign In</span>
              </button>
              {isBootstrap ? (
                <button
                  onClick={openRegister}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-gradient-to-r from-purple-600 to-sky-600 hover:from-purple-500 hover:to-sky-500 shadow-md shadow-purple-600/20 transition-all cursor-pointer ring-1 ring-purple-400/40"
                  title="Initialize first administrator account"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-200 animate-spin" />
                  <span>Setup Admin</span>
                </button>
              ) : (
                <button
                  onClick={openRegister}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg text-white bg-sky-600 hover:bg-sky-500 shadow-md shadow-sky-600/20 transition-all cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Register</span>
                </button>
              )}
            </div>
          ) : (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex items-center gap-2 pl-2 pr-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 text-xs font-medium text-slate-200 hover:text-white transition-all cursor-pointer shadow-sm">
                  {/* Avatar Initials with pending notification dot */}
                  <div className="relative">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-600 to-indigo-600 text-white font-bold text-[11px] flex items-center justify-center shrink-0 shadow-sm">
                      {getInitials()}
                    </div>
                    {isAdmin && pendingUsers.length > 0 && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-400 rounded-full ring-2 ring-slate-900" />
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="max-w-[120px] truncate font-semibold">
                      {user?.displayName || user?.username}
                    </span>

                    {/* Role Pill */}
                    {isAdmin ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                        Admin
                      </span>
                    ) : role === 'curator' ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        Curator
                      </span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                        Reader
                      </span>
                    )}
                  </div>

                  <ChevronDown className="w-3 h-3 text-slate-500 ml-0.5" />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  className="min-w-[220px] bg-slate-900/95 backdrop-blur-md rounded-xl p-1.5 shadow-2xl border border-slate-800 text-slate-200 z-50"
                  sideOffset={6}
                  align="end"
                >
                  {/* User info header & current role */}
                  <div className="px-3 py-2 border-b border-slate-800/80 mb-1">
                    <div className="font-semibold text-xs text-white truncate">
                      {user?.displayName || user?.username}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono truncate">
                      @{user?.username}
                    </div>
                    {user?.email && (
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">
                        {user.email}
                      </div>
                    )}
                    <div className="mt-2 pt-1.5 border-t border-slate-800/60 flex items-center justify-between">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 tracking-wider">
                        Current Role
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                          isAdmin
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : role === 'curator'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-slate-800 text-slate-300 border border-slate-700'
                        }`}
                      >
                        {isAdmin ? 'Admin' : role === 'curator' ? 'Curator' : 'Reader'}
                      </span>
                    </div>
                  </div>

                  {/* Admin Panel Option */}
                  {isAdmin && (
                    <DropdownMenu.Item
                      onClick={() => setIsAdminOpen(true)}
                      className="flex items-center justify-between px-3 py-2 text-xs font-semibold text-purple-300 hover:bg-purple-500/15 rounded-lg cursor-pointer transition-colors outline-none"
                    >
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-purple-400" />
                        <span>Admin Panel</span>
                      </div>
                      {pendingUsers.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          {pendingUsers.length}
                        </span>
                      )}
                    </DropdownMenu.Item>
                  )}

                  <DropdownMenu.Item
                    onClick={() => setIsManagerOpen(true)}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800/80 rounded-lg cursor-pointer transition-colors outline-none"
                  >
                    <FolderArchive className="w-3.5 h-3.5 text-sky-400" />
                    <span>Manage Libraries</span>
                  </DropdownMenu.Item>

                  <div className="my-1 border-t border-slate-800/80" />

                  {/* Log Out */}
                  <DropdownMenu.Item
                    onClick={() => logout()}
                    className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg cursor-pointer transition-colors outline-none"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Log Out</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          )}
        </div>
      </div>

      {/* Modals */}
      <LibraryManagerModal
        isOpen={isManagerOpen}
        onClose={() => setIsManagerOpen(false)}
        currentLibrary={currentLibrary}
        onSelectLibrary={handleSelectLibrary}
      />

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        defaultTab={authTab}
      />

      {isAdmin && (
        <AdminModal
          isOpen={isAdminOpen}
          onClose={() => setIsAdminOpen(false)}
          currentUser={user}
        />
      )}
    </header>
  );
}
