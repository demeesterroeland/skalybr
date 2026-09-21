'use client';

import React, { useState, useMemo } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tabs from '@radix-ui/react-tabs';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  X,
  Shield,
  Clock,
  Users,
  CheckCircle2,
  XCircle,
  MoreVertical,
  Search,
  BookOpen,
  ArrowRight,
  Loader2,
  Trash2,
  UserCheck,
  UserX,
  ShieldAlert,
  ShieldCheck,
  CornerDownRight,
  RotateCcw,
  Eye,
  EyeOff,
  Settings,
} from 'lucide-react';
import type { SafeUserRecord, AccessGrantRecord, LibraryInfo, AclRole, UserStatus } from '@/lib/types';
import { toast } from 'sonner';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: SafeUserRecord | null;
}

export default function AdminModal({ isOpen, onClose, currentUser }: AdminModalProps) {
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'pending' | 'users' | 'libraries'>('pending');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Fetch pending users
  const { data: pendingUsers = [], isLoading: isPendingLoading } = useQuery<SafeUserRecord[]>({
    queryKey: ['admin', 'users', 'pending'],
    queryFn: async () => {
      const res = await fetch('/api/v1/admin/users?status=pending');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch pending users');
      return json.data || [];
    },
    enabled: isOpen && !!currentUser?.isAdmin,
  });

  // 2. Fetch all users
  const { data: allUsers = [], isLoading: isAllUsersLoading } = useQuery<SafeUserRecord[]>({
    queryKey: ['admin', 'users', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/v1/admin/users');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch users');
      return json.data || [];
    },
    enabled: isOpen && !!currentUser?.isAdmin,
  });

  // 3. Fetch libraries (for ACL panel)
  const { data: libraries = [] } = useQuery<LibraryInfo[]>({
    queryKey: ['libraries'],
    queryFn: async () => {
      const res = await fetch('/api/v1/libraries');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch libraries');
      return json.data || [];
    },
    enabled: isOpen && !!currentUser?.isAdmin,
  });

  // 3b. Fetch all libraries for admin panel (including hidden)
  const { data: allLibraries = [], isLoading: isLibrariesLoading } = useQuery<LibraryInfo[]>({
    queryKey: ['admin', 'libraries', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/v1/admin/libraries');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch libraries');
      return json.data || [];
    },
    enabled: isOpen && !!currentUser?.isAdmin,
  });

  // Selected user
  const selectedUser = useMemo(() => {
    if (!selectedUserId) {
      if (allUsers.length > 0) return allUsers[0];
      return null;
    }
    return allUsers.find((u) => u.id === selectedUserId) || null;
  }, [selectedUserId, allUsers]);

  const activeSelectedUserId = selectedUser?.id || null;

  // 4. Fetch grants for selected user
  const { data: userGrants = [], isLoading: isGrantsLoading } = useQuery<AccessGrantRecord[]>({
    queryKey: ['admin', 'users', activeSelectedUserId, 'grants'],
    queryFn: async () => {
      if (!activeSelectedUserId) return [];
      const res = await fetch(`/api/v1/admin/users/${activeSelectedUserId}/grants`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to fetch user grants');
      return json.data || [];
    },
    enabled: isOpen && !!activeSelectedUserId,
  });

  // Mutations
  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      updates,
    }: {
      userId: number;
      updates: {
        status?: UserStatus;
        isAdmin?: boolean;
        displayName?: string | null;
        revokeSessions?: boolean;
      };
    }) => {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update user');
      return { data: json.data, updates };
    },
    onSuccess: ({ updates }) => {
      if (updates.revokeSessions) {
        toast.success('All user sessions revoked successfully');
      } else {
        toast.success('User updated successfully');
      }
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['libraries'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error updating user');
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId, isRejection }: { userId: number; isRejection?: boolean }) => {
      const res = await fetch(`/api/v1/admin/users/${userId}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete user');
      return { json, userId, isRejection };
    },
    onSuccess: ({ userId, isRejection }) => {
      if (isRejection) {
        toast.success('Registration rejected');
      } else {
        toast.success('User deleted');
      }
      if (selectedUserId === userId) setSelectedUserId(null);
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['libraries'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error deleting user');
    },
  });

  const setGrantMutation = useMutation({
    mutationFn: async ({
      userId,
      resourceType,
      resourceId,
      role,
    }: {
      userId: number;
      resourceType: 'global' | 'library' | 'shelf';
      resourceId: string;
      role: AclRole;
    }) => {
      const res = await fetch(`/api/v1/admin/users/${userId}/grants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resourceType, resourceId, role }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update grant');
      return json.data;
    },
    onSuccess: () => {
      toast.success('Permission updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', activeSelectedUserId, 'grants'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['libraries'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error updating grant');
    },
  });

  const deleteGrantMutation = useMutation({
    mutationFn: async ({
      userId,
      resourceType,
      resourceId,
    }: {
      userId: number;
      resourceType: 'global' | 'library' | 'shelf';
      resourceId: string;
    }) => {
      const res = await fetch(
        `/api/v1/admin/users/${userId}/grants?resourceType=${resourceType}&resourceId=${encodeURIComponent(
          resourceId
        )}`,
        { method: 'DELETE' }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to remove grant');
      return json;
    },
    onSuccess: () => {
      toast.success('Override removed (inherited from global)');
      queryClient.invalidateQueries({ queryKey: ['admin', 'users', activeSelectedUserId, 'grants'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
      queryClient.invalidateQueries({ queryKey: ['libraries'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error removing grant');
    },
  });

  const updateLibraryMutation = useMutation({
    mutationFn: async ({
      name,
      isPublic,
      displayName,
      isHidden,
    }: {
      name: string;
      isPublic?: boolean;
      displayName?: string | null;
      isHidden?: boolean;
    }) => {
      const res = await fetch(`/api/v1/admin/libraries/${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPublic, displayName, isHidden }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to update library');
      return json.data;
    },
    onSuccess: () => {
      toast.success('Library settings updated');
      queryClient.invalidateQueries({ queryKey: ['admin', 'libraries', 'all'] });
      queryClient.invalidateQueries({ queryKey: ['libraries'] });
      queryClient.invalidateQueries({ queryKey: ['auth'] });
    },
    onError: (err: any) => {
      toast.error(err.message || 'Error updating library');
    },
  });

  // Filtered users for master list
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return allUsers;
    const q = searchQuery.toLowerCase();
    return allUsers.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.displayName && u.displayName.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q))
    );
  }, [allUsers, searchQuery]);

  // Grants map for selected user
  const globalGrant = useMemo(() => {
    return userGrants.find((g) => g.resourceType === 'global') || null;
  }, [userGrants]);

  const libraryGrantsMap = useMemo(() => {
    const map = new Map<string, AclRole>();
    for (const g of userGrants) {
      if (g.resourceType === 'library') {
        map.set(g.resourceId, g.role);
      }
    }
    return map;
  }, [userGrants]);

  const handleApprove = (id: number) => {
    updateUserMutation.mutate({ userId: id, updates: { status: 'active' } });
  };

  const handleReject = (id: number) => {
    deleteUserMutation.mutate({ userId: id, isRejection: true });
  };

  const getInitials = (user: SafeUserRecord) => {
    const name = user.displayName || user.username;
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[95vw] max-w-5xl h-[85vh] max-h-[820px] rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl flex flex-col outline-none text-slate-100 overflow-hidden">
          
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <Dialog.Title className="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  Admin Panel
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    Security &amp; ACL
                  </span>
                </Dialog.Title>
                <Dialog.Description className="text-xs text-slate-400">
                  Manage users, library visibility, and cascading access permissions
                </Dialog.Description>
              </div>
            </div>

            <Dialog.Close asChild>
              <button
                className="rounded-lg p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          {/* Main Tabs Container */}
          <Tabs.Root
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'pending' | 'users' | 'libraries')}
            className="flex-1 flex flex-col min-h-0"
          >
            {/* Tab Header Bar */}
            <div className="px-6 pt-3 pb-2 border-b border-slate-800/80 bg-slate-950/40 shrink-0">
              <Tabs.List className="inline-flex p-1 rounded-xl bg-slate-950 border border-slate-800">
                <Tabs.Trigger
                  value="pending"
                  className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-white transition-all cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Pending Approvals</span>
                  {pendingUsers.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                      {pendingUsers.length}
                    </span>
                  )}
                </Tabs.Trigger>

                <Tabs.Trigger
                  value="users"
                  className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-white transition-all cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Users &amp; Permissions</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    {allUsers.length}
                  </span>
                </Tabs.Trigger>

                <Tabs.Trigger
                  value="libraries"
                  className="flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg text-slate-400 data-[state=active]:bg-slate-800 data-[state=active]:text-white transition-all cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Libraries</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                    {allLibraries.length}
                  </span>
                </Tabs.Trigger>
              </Tabs.List>
            </div>

            {/* TAB 1: PENDING APPROVALS */}
            <Tabs.Content
              value="pending"
              className="flex-1 p-6 overflow-y-auto outline-none min-h-0"
            >
              {isPendingLoading ? (
                <div className="h-48 flex items-center justify-center gap-2 text-slate-500 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                  <span>Loading pending accounts...</span>
                </div>
              ) : pendingUsers.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">All Caught Up!</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    There are currently no new account registrations waiting for administrator approval.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-slate-400">
                      Found <strong className="text-white">{pendingUsers.length}</strong> user
                      registration{pendingUsers.length === 1 ? '' : 's'} awaiting activation.
                    </p>
                  </div>

                  {pendingUsers.map((user) => (
                    <div
                      key={user.id}
                      className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-600 to-yellow-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-md">
                          {getInitials(user)}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-white truncate">
                              {user.displayName || user.username}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              @{user.username}
                            </span>
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              Pending
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                            {user.email && <span>{user.email}</span>}
                            <span>•</span>
                            <span>
                              Registered{' '}
                              {new Date(user.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric',
                              })}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                        <button
                          onClick={() => handleApprove(user.id)}
                          disabled={updateUserMutation.isPending}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20 transition-all cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve</span>
                        </button>
                        <button
                          onClick={() => handleReject(user.id)}
                          disabled={deleteUserMutation.isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 text-slate-300 border border-slate-700 transition-all cursor-pointer"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Tabs.Content>

            {/* TAB 2: USERS & PERMISSIONS (GOOGLE DRIVE-STYLE ACL) */}
            <Tabs.Content
              value="users"
              className="flex-1 flex flex-col md:flex-row min-h-0 outline-none overflow-hidden"
            >
              {/* Left Column: User Directory */}
              <div className="w-full md:w-80 lg:w-96 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col min-h-0 shrink-0">
                {/* Search */}
                <div className="p-3.5 border-b border-slate-800">
                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search users by name, @username..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* User List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 p-2 space-y-1">
                  {isAllUsersLoading ? (
                    <div className="p-6 text-center text-xs text-slate-500">Loading users...</div>
                  ) : filteredUsers.length === 0 ? (
                    <div className="p-6 text-center text-xs text-slate-500">No users found</div>
                  ) : (
                    filteredUsers.map((user) => {
                      const isSelected = selectedUserId === user.id;
                      const isSelf = currentUser?.id === user.id;

                      return (
                        <div
                          key={user.id}
                          onClick={() => setSelectedUserId(user.id)}
                          className={`p-2.5 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-2.5 ${
                            isSelected
                              ? 'bg-sky-500/10 border border-sky-500/30 text-white'
                              : 'hover:bg-slate-800/60 border border-transparent text-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-8 h-8 rounded-full bg-slate-800 text-sky-400 font-bold text-xs flex items-center justify-center shrink-0 border border-slate-700">
                              {getInitials(user)}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs text-white truncate">
                                  {user.displayName || user.username}
                                </span>
                                {isSelf && (
                                  <span className="text-[9px] font-semibold px-1 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                    You
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 font-mono truncate block">
                                @{user.username}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {user.isAdmin && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/30">
                                Admin
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${
                                user.status === 'active'
                                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                  : user.status === 'pending'
                                  ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                                  : 'bg-red-500/10 text-red-400 border border-red-500/20'
                              }`}
                            >
                              {user.status}
                            </span>

                            {/* Options dropdown */}
                            <DropdownMenu.Root>
                              <DropdownMenu.Trigger asChild>
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1 rounded hover:bg-slate-700/60 text-slate-400 hover:text-white transition-colors"
                                >
                                  <MoreVertical className="w-3.5 h-3.5" />
                                </button>
                              </DropdownMenu.Trigger>
                              <DropdownMenu.Portal>
                                <DropdownMenu.Content
                                  className="min-w-[170px] bg-slate-900 border border-slate-800 rounded-xl p-1 shadow-2xl z-50 text-xs text-slate-200"
                                  align="end"
                                >
                                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase">
                                    Account Status
                                  </div>
                                  <DropdownMenu.Item
                                    disabled={user.status === 'active' || isSelf}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateUserMutation.mutate({
                                        userId: user.id,
                                        updates: { status: 'active' },
                                      });
                                    }}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer disabled:opacity-40"
                                  >
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>Set Active</span>
                                  </DropdownMenu.Item>
                                  <DropdownMenu.Item
                                    disabled={user.status === 'suspended' || isSelf}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateUserMutation.mutate({
                                        userId: user.id,
                                        updates: { status: 'suspended' },
                                      });
                                    }}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer text-amber-400 disabled:opacity-40"
                                  >
                                    <UserX className="w-3.5 h-3.5" />
                                    <span>Suspend Account</span>
                                  </DropdownMenu.Item>

                                  <div className="my-1 border-t border-slate-800" />
                                  <div className="px-2 py-1 text-[10px] font-semibold text-slate-500 uppercase">
                                    Role Privileges
                                  </div>
                                  <DropdownMenu.Item
                                    disabled={isSelf}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      updateUserMutation.mutate({
                                        userId: user.id,
                                        updates: { isAdmin: !user.isAdmin },
                                      });
                                    }}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-slate-800 cursor-pointer text-purple-300 disabled:opacity-40"
                                  >
                                    {user.isAdmin ? (
                                      <>
                                        <ShieldAlert className="w-3.5 h-3.5 text-purple-400" />
                                        <span>Revoke Admin</span>
                                      </>
                                    ) : (
                                      <>
                                        <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                                        <span>Promote to Admin</span>
                                      </>
                                    )}
                                  </DropdownMenu.Item>

                                  <div className="my-1 border-t border-slate-800" />
                                  <DropdownMenu.Item
                                    disabled={isSelf}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (
                                        confirm(
                                          `Are you sure you want to permanently delete user @${user.username}?`
                                        )
                                      ) {
                                        deleteUserMutation.mutate({ userId: user.id });
                                      }
                                    }}
                                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-red-500/20 text-red-400 cursor-pointer disabled:opacity-40"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete User</span>
                                  </DropdownMenu.Item>
                                </DropdownMenu.Content>
                              </DropdownMenu.Portal>
                            </DropdownMenu.Root>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Right Column: Cascading ACL Inspector */}
              <div className="flex-1 flex flex-col min-h-0 overflow-y-auto p-6">
                {!selectedUser ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-500">
                    <Shield className="w-12 h-12 text-slate-700 mb-3 stroke-[1.5]" />
                    <h4 className="text-sm font-semibold text-slate-300">No User Selected</h4>
                    <p className="text-xs max-w-sm text-slate-500 mt-1">
                      Choose a user from the directory to inspect and customize their cascading access control
                      grants.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Selected User Header Card */}
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-sky-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shrink-0 shadow-md">
                          {getInitials(selectedUser)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-base font-bold text-white">
                              {selectedUser.displayName || selectedUser.username}
                            </span>
                            <span className="text-xs text-slate-400 font-mono">
                              @{selectedUser.username}
                            </span>
                            {selectedUser.id === currentUser?.id && (
                              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                You
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                            {selectedUser.email && <span>{selectedUser.email}</span>}
                            {selectedUser.email && <span>•</span>}
                            <span className="capitalize">{selectedUser.status} account</span>
                          </div>
                        </div>
                      </div>

                      {/* Header Card Actions */}
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        {/* Status selector */}
                        <select
                          value={selectedUser.status}
                          disabled={selectedUser.id === currentUser?.id || updateUserMutation.isPending}
                          onChange={(e) =>
                            updateUserMutation.mutate({
                              userId: selectedUser.id,
                              updates: { status: e.target.value as UserStatus },
                            })
                          }
                          className="text-xs bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer disabled:opacity-50"
                          title="Change user account status"
                        >
                          <option value="active">Active</option>
                          <option value="pending">Pending</option>
                          <option value="suspended">Suspended</option>
                        </select>

                        {/* Admin Privilege Toggle */}
                        <button
                          type="button"
                          disabled={selectedUser.id === currentUser?.id || updateUserMutation.isPending}
                          onClick={() =>
                            updateUserMutation.mutate({
                              userId: selectedUser.id,
                              updates: { isAdmin: !selectedUser.isAdmin },
                            })
                          }
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all cursor-pointer disabled:opacity-50 ${
                            selectedUser.isAdmin
                              ? 'bg-purple-500/20 text-purple-300 border-purple-500/40 hover:bg-purple-500/30'
                              : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                          }`}
                          title={selectedUser.isAdmin ? 'Revoke admin authority' : 'Promote to super admin'}
                        >
                          <Shield className="w-3.5 h-3.5 text-purple-400" />
                          <span>{selectedUser.isAdmin ? 'Admin' : 'Make Admin'}</span>
                        </button>

                        {/* Revoke All Sessions */}
                        <button
                          type="button"
                          disabled={updateUserMutation.isPending}
                          onClick={() =>
                            updateUserMutation.mutate({
                              userId: selectedUser.id,
                              updates: { revokeSessions: true },
                            })
                          }
                          className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
                          title="Revoke all active sessions for this user"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>

                        {/* Delete User */}
                        {selectedUser.id !== currentUser?.id && (
                          <button
                            type="button"
                            disabled={deleteUserMutation.isPending}
                            onClick={() => {
                              if (confirm(`Permanently delete user @${selectedUser.username}?`)) {
                                deleteUserMutation.mutate({ userId: selectedUser.id });
                              }
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg border border-slate-800 transition-colors"
                            title="Delete this user"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Admin notice */}
                    {selectedUser.isAdmin ? (
                      <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-500/30 text-xs space-y-1">
                        <div className="flex items-center gap-2 font-semibold text-purple-200">
                          <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
                          <span>Super Administrator Access</span>
                        </div>
                        <p className="text-purple-300/80 leading-relaxed pl-6">
                          This user is configured with instance-wide super administrator authority. They have
                          unrestricted administrative access (`admin`) to all libraries, shelves, and system
                          configurations. Specific granular overrides do not constrain administrators.
                        </p>
                      </div>
                    ) : (
                      <>
                        {/* Section 1: Global Grant Level 1 */}
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                                <span>Level 1: Instance Global Role</span>
                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-sky-400 border border-slate-700">
                                  Scope: *
                                </span>
                              </h4>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Baseline permission inherited by all libraries unless specifically overridden below.
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                            {[
                              {
                                id: 'reader' as AclRole,
                                title: 'Reader (Default)',
                                desc: 'Browse, search, read books & download files',
                              },
                              {
                                id: 'curator' as AclRole,
                                title: 'Curator (Editor)',
                                desc: 'Upload books, edit metadata & manage shelves',
                              },
                              {
                                id: 'none' as AclRole,
                                title: 'None (Deny All)',
                                desc: 'Explicitly denied access across all libraries',
                              },
                            ].map((option) => {
                              const currentGlobalRole = globalGrant?.role || 'reader';
                              const isCurrent = currentGlobalRole === option.id;

                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() =>
                                    setGrantMutation.mutate({
                                      userId: selectedUser.id,
                                      resourceType: 'global',
                                      resourceId: '*',
                                      role: option.id,
                                    })
                                  }
                                  className={`p-3 rounded-xl text-left border transition-all cursor-pointer ${
                                    isCurrent
                                      ? 'bg-sky-500/15 border-sky-500/50 text-white shadow-sm'
                                      : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-semibold text-white">
                                      {option.title}
                                    </span>
                                    {isCurrent && (
                                      <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 leading-tight">
                                    {option.desc}
                                  </p>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Section 2: Library Overrides Level 2 */}
                        <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 space-y-3">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                              <span>Level 2: Library-Specific Overrides</span>
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                Cascading ACL
                              </span>
                            </h4>
                            <p className="text-xs text-slate-400 mt-0.5">
                              Custom access levels for individual libraries. Overrides take precedence over the global baseline.
                            </p>
                          </div>

                          <div className="divide-y divide-slate-800/60 rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
                            {libraries.length === 0 ? (
                              <div className="p-4 text-center text-xs text-slate-500">
                                No libraries configured on this instance.
                              </div>
                            ) : (
                              libraries.map((lib) => {
                                const overrideRole = libraryGrantsMap.get(lib.name);
                                const hasOverride = overrideRole !== undefined;
                                const effectiveRole =
                                  overrideRole ?? (globalGrant?.role || (lib.isPublic ? 'reader' : 'none'));

                                return (
                                  <div
                                    key={lib.name}
                                    className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                                  >
                                    <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-lg bg-slate-800 text-sky-400 flex items-center justify-center shrink-0 border border-slate-700">
                                        <BookOpen className="w-4 h-4" />
                                      </div>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-semibold text-white">
                                            {lib.displayName || lib.name}
                                          </span>
                                          {lib.isPublic && (
                                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-300 border border-sky-500/20">
                                              Public
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5">
                                          {hasOverride ? (
                                            <span className="text-amber-400 font-medium flex items-center gap-1">
                                              <CornerDownRight className="w-3 h-3" />
                                              Overridden: {overrideRole}
                                            </span>
                                          ) : (
                                            <span className="text-slate-500 flex items-center gap-1">
                                              <span>Inherited ({effectiveRole})</span>
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Override Selector */}
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={hasOverride ? overrideRole : 'inherit'}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          if (val === 'inherit') {
                                            if (hasOverride) {
                                              deleteGrantMutation.mutate({
                                                userId: selectedUser.id,
                                                resourceType: 'library',
                                                resourceId: lib.name,
                                              });
                                            }
                                          } else {
                                            setGrantMutation.mutate({
                                              userId: selectedUser.id,
                                              resourceType: 'library',
                                              resourceId: lib.name,
                                              role: val as AclRole,
                                            });
                                          }
                                        }}
                                        className="text-xs bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-sky-500 cursor-pointer"
                                      >
                                        <option value="inherit">Inherit Global Role</option>
                                        <option value="reader">Override: Reader</option>
                                        <option value="curator">Override: Curator</option>
                                        <option value="none">Override: Deny (None)</option>
                                      </select>

                                      {hasOverride && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            deleteGrantMutation.mutate({
                                              userId: selectedUser.id,
                                              resourceType: 'library',
                                              resourceId: lib.name,
                                            })
                                          }
                                          className="text-[11px] text-slate-400 hover:text-red-400 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
                                          title="Remove override and inherit global role"
                                        >
                                          Reset
                                        </button>
                                      )}
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </Tabs.Content>

            {/* TAB 3: LIBRARIES */}
            <Tabs.Content
              value="libraries"
              className="flex-1 p-6 overflow-y-auto outline-none min-h-0"
            >
              {isLibrariesLoading ? (
                <div className="h-48 flex items-center justify-center gap-2 text-slate-500 text-sm">
                  <Loader2 className="w-5 h-5 animate-spin text-sky-400" />
                  <span>Loading libraries...</span>
                </div>
              ) : allLibraries.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-center p-6 rounded-2xl border border-dashed border-slate-800 bg-slate-950/40">
                  <div className="w-12 h-12 rounded-full bg-slate-800 text-slate-400 flex items-center justify-center mb-3">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-semibold text-white">No Libraries</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    No libraries have been added to this instance yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="mb-2">
                    <p className="text-xs text-slate-400">
                      Manage library visibility and public access settings. Public libraries are accessible to unauthenticated guests.
                    </p>
                  </div>

                  {allLibraries.map((lib) => {
                    const isPublic = lib.isPublic ?? false;
                    const isHidden = lib.isHidden ?? false;

                    return (
                      <div
                        key={lib.name}
                        className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 hover:border-slate-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-slate-800 text-sky-400 flex items-center justify-center shrink-0 border border-slate-700">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-sm text-white truncate">
                                {lib.displayName || lib.name}
                              </span>
                              <span className="text-xs text-slate-400 font-mono">
                                {lib.name}
                              </span>
                              {isPublic && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                                  Public
                                </span>
                              )}
                              {isHidden && (
                                <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                                  Hidden
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                              <span>Path: {lib.path}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() =>
                              updateLibraryMutation.mutate({
                                name: lib.name,
                                isPublic: !isPublic,
                              })
                            }
                            disabled={updateLibraryMutation.isPending}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer disabled:opacity-50 ${
                              isPublic
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40 hover:bg-sky-500/30'
                                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                            }`}
                            title={isPublic ? 'Library is public (guests can access)' : 'Library is private (requires authentication)'}
                          >
                            {isPublic ? (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Public</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Private</span>
                              </>
                            )}
                          </button>

                          <button
                            onClick={() =>
                              updateLibraryMutation.mutate({
                                name: lib.name,
                                isHidden: !isHidden,
                              })
                            }
                            disabled={updateLibraryMutation.isPending}
                            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all cursor-pointer disabled:opacity-50 ${
                              isHidden
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                                : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                            }`}
                            title={isHidden ? 'Library is hidden (not shown in switcher)' : 'Library is visible in switcher'}
                          >
                            {isHidden ? (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span>Hidden</span>
                              </>
                            ) : (
                              <>
                                <Eye className="w-3.5 h-3.5" />
                                <span>Visible</span>
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Tabs.Content>
          </Tabs.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
