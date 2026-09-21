'use client';

import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import {
  X,
  User,
  Lock,
  Mail,
  UserCheck,
  Shield,
  Clock,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '@/lib/auth/use-auth';
import { toast } from 'sonner';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'signin' | 'register';
}

export default function AuthModal({
  isOpen,
  onClose,
  defaultTab = 'signin',
}: AuthModalProps) {
  const { login, register, isBootstrap, refetch } = useAuth();

  const [activeTab, setActiveTab] = useState<'signin' | 'register'>(defaultTab);

  // Sign In Form State
  const [signInIdentifier, setSignInIdentifier] = useState('');
  const [signInPassword, setSignInPassword] = useState('');
  const [signInPendingNotice, setSignInPendingNotice] = useState<string | null>(null);
  const [signInSuspendedNotice, setSignInSuspendedNotice] = useState<string | null>(null);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  // Register Form State
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPendingSuccess, setRegPendingSuccess] = useState<string | null>(null);
  const [regError, setRegError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (isBootstrap) {
        setActiveTab('register');
      } else {
        setActiveTab(defaultTab);
      }
      setSignInError(null);
      setSignInPendingNotice(null);
      setSignInSuspendedNotice(null);
      setRegError(null);
      setRegPendingSuccess(null);
      setSignInPassword('');
      setRegPassword('');
    } else {
      setSignInPassword('');
      setRegPassword('');
    }
  }, [isOpen, defaultTab, isBootstrap]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignInError(null);
    setSignInPendingNotice(null);
    setSignInSuspendedNotice(null);
    setIsSigningIn(true);

    try {
      const res = await login({
        username: signInIdentifier.trim(),
        password: signInPassword,
      });

      toast.success(`Welcome back, ${res.user?.displayName || res.user?.username || 'User'}!`);
      setSignInPassword('');
      onClose();
    } catch (err: any) {
      const errMsg = err.message || 'Failed to sign in';
      if (errMsg.toLowerCase().includes('pending administrator approval')) {
        setSignInPendingNotice(errMsg);
      } else if (errMsg.toLowerCase().includes('suspended')) {
        setSignInSuspendedNotice(errMsg);
      } else {
        setSignInError(errMsg);
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError(null);
    setRegPendingSuccess(null);
    setIsRegistering(true);

    try {
      const res = await register({
        username: regUsername.trim(),
        password: regPassword,
        email: regEmail.trim() || undefined,
        displayName: regDisplayName.trim() || undefined,
      });

      setRegPassword('');

      if (res.user?.isAdmin) {
        toast.success('Admin account established! Welcome to Skalybr.');
        await refetch();
        onClose();
      } else {
        setRegPendingSuccess(
          res.message || 'Registration successful! Your account is pending administrator approval.'
        );
        toast.info('Account registered! Pending admin approval.');
      }
    } catch (err: any) {
      setRegError(err.message || 'Failed to register account');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl outline-none text-slate-100">
          
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-sky-600 to-cyan-400 flex items-center justify-center shadow-md shadow-sky-500/20">
                <span className="text-base">🗡️</span>
              </div>
              <div>
                <Dialog.Title className="text-base font-semibold text-white tracking-tight">
                  {isBootstrap ? 'Initialize Skalybr' : 'Welcome to Skalybr'}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-400">
                  {isBootstrap
                    ? 'Setup your initial administrator account'
                    : 'Sign in to access your libraries and shelves'}
                </Dialog.Description>
              </div>
            </div>
            <Dialog.Close asChild>
              <button
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </Dialog.Close>
          </div>

          {/* First User Bootstrap Notice */}
          {isBootstrap && (
            <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-r from-purple-950/50 to-sky-950/50 border border-purple-500/30 flex items-start gap-3">
              <Sparkles className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-semibold text-purple-200">First-Time System Initialization</p>
                <p className="text-purple-300/90 mt-0.5">
                  No accounts exist yet. The first user created will automatically become the system{' '}
                  <strong className="text-white">Administrator</strong> with unrestricted access.
                </p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <Tabs.Root
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as 'signin' | 'register')}
            className="mt-4"
          >
            <Tabs.List className="grid grid-cols-2 p-1 rounded-xl bg-slate-950 border border-slate-800/80 mb-5">
              <Tabs.Trigger
                value="signin"
                className="py-1.5 text-xs font-semibold rounded-lg text-slate-400 transition-all data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm cursor-pointer"
              >
                Sign In
              </Tabs.Trigger>
              <Tabs.Trigger
                value="register"
                className="py-1.5 text-xs font-semibold rounded-lg text-slate-400 transition-all data-[state=active]:bg-slate-800 data-[state=active]:text-white data-[state=active]:shadow-sm cursor-pointer"
              >
                Register
              </Tabs.Trigger>
            </Tabs.List>

            {/* TAB: SIGN IN */}
            <Tabs.Content value="signin" className="outline-none space-y-4">
              {/* Notice states */}
              {signInPendingNotice && (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 flex items-start gap-2.5 text-xs">
                  <Clock className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <span className="font-semibold block">Account Pending Approval</span>
                    <span className="text-amber-300/90">{signInPendingNotice}</span>
                  </div>
                </div>
              )}

              {signInSuspendedNotice && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-start gap-2.5 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />
                  <div>
                    <span className="font-semibold block">Account Suspended</span>
                    <span className="text-red-300/90">{signInSuspendedNotice}</span>
                  </div>
                </div>
              )}

              {signInError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-2 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  <span>{signInError}</span>
                </div>
              )}

              <form onSubmit={handleSignIn} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="signin-identifier"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Username or Email
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      id="signin-identifier"
                      type="text"
                      required
                      value={signInIdentifier}
                      onChange={(e) => setSignInIdentifier(e.target.value)}
                      placeholder="Username or email"
                      className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="signin-password"
                    className="block text-xs font-medium text-slate-300 mb-1.5"
                  >
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                    <input
                      id="signin-password"
                      type="password"
                      required
                      value={signInPassword}
                      onChange={(e) => setSignInPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSigningIn}
                  className="w-full mt-2 py-2 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
                >
                  {isSigningIn ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <span>Sign In</span>
                  )}
                </button>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className="text-xs text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
                >
                  Don&apos;t have an account? <span className="text-sky-400 font-medium">Create one</span>
                </button>
              </div>
            </Tabs.Content>

            {/* TAB: REGISTER */}
            <Tabs.Content value="register" className="outline-none space-y-4">
              {regPendingSuccess ? (
                <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 space-y-2 text-xs">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-semibold text-sm text-emerald-200">
                      Registration Successful
                    </span>
                  </div>
                  <p className="text-emerald-300/90 leading-relaxed">{regPendingSuccess}</p>
                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-1.5 text-xs font-semibold rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 border border-emerald-500/30 transition-colors cursor-pointer"
                    >
                      Got it
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {regError && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 flex items-center gap-2 text-xs">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>{regError}</span>
                    </div>
                  )}

                  <form onSubmit={handleRegister} className="space-y-3">
                    <div>
                      <label
                        htmlFor="reg-username"
                        className="block text-xs font-medium text-slate-300 mb-1"
                      >
                        Username <span className="text-sky-400">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input
                          id="reg-username"
                          type="text"
                          required
                          minLength={3}
                          value={regUsername}
                          onChange={(e) => setRegUsername(e.target.value)}
                          placeholder="e.g. alice"
                          className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="reg-password"
                        className="block text-xs font-medium text-slate-300 mb-1"
                      >
                        Password <span className="text-sky-400">*</span>{' '}
                        <span className="text-[11px] text-slate-500">(min 6 chars)</span>
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                        <input
                          id="reg-password"
                          type="password"
                          required
                          minLength={6}
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          placeholder="••••••••"
                          className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label
                          htmlFor="reg-display-name"
                          className="block text-xs font-medium text-slate-300 mb-1"
                        >
                          Display Name
                        </label>
                        <div className="relative">
                          <UserCheck className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                          <input
                            id="reg-display-name"
                            type="text"
                            value={regDisplayName}
                            onChange={(e) => setRegDisplayName(e.target.value)}
                            placeholder="Alice M."
                            className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                          />
                        </div>
                      </div>

                      <div>
                        <label
                          htmlFor="reg-email"
                          className="block text-xs font-medium text-slate-300 mb-1"
                        >
                          Email
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                          <input
                            id="reg-email"
                            type="email"
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            placeholder="alice@example.com"
                            className="w-full pl-10 pr-3.5 py-2 text-sm bg-slate-950 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-colors"
                          />
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isRegistering}
                      className="w-full mt-2 py-2 px-4 rounded-xl bg-gradient-to-r from-sky-600 to-cyan-500 hover:from-sky-500 hover:to-cyan-400 disabled:opacity-50 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 transition-all cursor-pointer"
                    >
                      {isRegistering ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Creating account...</span>
                        </>
                      ) : isBootstrap ? (
                        <>
                          <Shield className="w-4 h-4" />
                          <span>Initialize Administrator</span>
                        </>
                      ) : (
                        <span>Create Account</span>
                      )}
                    </button>
                  </form>

                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setActiveTab('signin')}
                      className="text-xs text-slate-400 hover:text-sky-300 transition-colors cursor-pointer"
                    >
                      Already have an account?{' '}
                      <span className="text-sky-400 font-medium">Sign in</span>
                    </button>
                  </div>
                </>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
