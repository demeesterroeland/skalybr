'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { SafeUserRecord, AclRole } from '@/lib/types';
import { toast } from 'sonner';

interface AuthMeResponse {
  authenticated: boolean;
  user: SafeUserRecord | null;
  role?: AclRole;
  isBootstrap?: boolean;
}

interface LoginCredentials {
  username: string;
  password: string;
}

interface RegisterCredentials {
  username: string;
  password: string;
  email?: string | null;
  displayName?: string | null;
}

export function useAuth(options?: { library?: string }) {
  const queryClient = useQueryClient();
  const library = options?.library;

  const queryKey = ['auth', 'me', library || ''];

  const { data, isLoading, error, refetch } = useQuery<AuthMeResponse>({
    queryKey,
    queryFn: async () => {
      const url = library
        ? `/api/v1/auth/me?library=${encodeURIComponent(library)}`
        : '/api/v1/auth/me';
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error('Failed to check authentication status');
      }
      return res.json();
    },
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  const loginMutation = useMutation({
    mutationFn: async (creds: LoginCredentials) => {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      const body = await res.json();
      if (!res.ok) {
        const errorMsg = body?.error || 'Failed to sign in';
        const err = new Error(errorMsg);
        (err as any).status = res.status;
        throw err;
      }
      return body;
    },
    onSuccess: (result) => {
      if (result.user) {
        queryClient.setQueriesData({ queryKey: ['auth', 'me'] }, (old: any) => ({
          ...old,
          authenticated: true,
          user: result.user,
          role: result.user.isAdmin ? 'admin' : (old?.role || 'reader'),
          isBootstrap: false,
        }));
      }
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['libraries'] });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (creds: RegisterCredentials) => {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(creds),
      });
      const body = await res.json();
      if (!res.ok) {
        const errorMsg = body?.error || 'Registration failed';
        const err = new Error(errorMsg);
        (err as any).status = res.status;
        throw err;
      }
      return body;
    },
    onSuccess: (result) => {
      if (result.user && result.user.isAdmin) {
        queryClient.setQueriesData({ queryKey: ['auth', 'me'] }, {
          authenticated: true,
          user: result.user,
          role: 'admin',
          isBootstrap: false,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['libraries'] });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/auth/logout', {
        method: 'POST',
      });
      if (!res.ok) {
        throw new Error('Logout failed');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.setQueriesData({ queryKey: ['auth', 'me'] }, {
        authenticated: false,
        user: null,
        role: 'none',
        isBootstrap: false,
      });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['libraries'] });
      toast.success('Signed out successfully');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error signing out');
    },
  });

  const authenticated = !!data?.authenticated;
  const user = data?.user || null;
  const isAdmin = !!user?.isAdmin;
  const isBootstrap = !!data?.isBootstrap;
  const role: AclRole = isAdmin ? 'admin' : (data?.role || (authenticated ? 'reader' : 'none'));

  return {
    authenticated,
    user,
    isAdmin,
    isBootstrap,
    role,
    isLoading,
    error,
    login: loginMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
    refetch,
  };
}
