'use client';

import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LibraryInfo } from '@/lib/types';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Upload,
  Download,
  Trash2,
  Edit2,
  Eye,
  EyeOff,
  FolderArchive,
  BookOpen,
  Check,
  AlertTriangle,
  Loader2,
  Plus,
  Globe,
} from 'lucide-react';
import { toast } from 'sonner';

interface LibraryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLibrary: string;
  onSelectLibrary: (lib: string) => void;
}

export default function LibraryManagerModal({
  isOpen,
  onClose,
  currentLibrary,
  onSelectLibrary,
}: LibraryManagerModalProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadMode, setUploadMode] = useState<'file' | 'url'>('file');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [remoteUrl, setRemoteUrl] = useState('');
  const [customLibName, setCustomLibName] = useState('');
  const [customDisplayName, setCustomDisplayName] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  // Rename editing state
  const [editingLib, setEditingLib] = useState<string | null>(null);
  const [editNameValue, setEditNameValue] = useState('');

  // Delete confirmation state
  const [deletingLib, setDeletingLib] = useState<LibraryInfo | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch all libraries (including hidden)
  const { data: libraries = [], isLoading, refetch } = useQuery<LibraryInfo[]>({
    queryKey: ['libraries', 'all'],
    queryFn: async () => {
      const res = await fetch('/api/v1/libraries?all=true');
      const json = await res.json();
      return json.data || [];
    },
    enabled: isOpen,
  });

  // Handle Upload or Remote URL Import
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (uploadMode === 'file' && !uploadFile) {
      toast.error('Please select a ZIP file');
      return;
    }
    if (uploadMode === 'url' && !remoteUrl.trim()) {
      toast.error('Please enter a remote download URL');
      return;
    }

    setIsUploading(true);

    try {
      let res: Response;
      if (uploadMode === 'file' && uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        if (customLibName.trim()) formData.append('name', customLibName.trim());
        if (customDisplayName.trim()) formData.append('displayName', customDisplayName.trim());

        res = await fetch('/api/v1/libraries', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await fetch('/api/v1/libraries', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: remoteUrl.trim(),
            name: customLibName.trim() || undefined,
            displayName: customDisplayName.trim() || undefined,
          }),
        });
      }

      const json = await res.json();

      if (json.success) {
        toast.success(json.message || 'Library imported successfully');
        setUploadFile(null);
        setRemoteUrl('');
        setCustomLibName('');
        setCustomDisplayName('');
        if (fileInputRef.current) fileInputRef.current.value = '';
        queryClient.invalidateQueries({ queryKey: ['libraries'] });
        refetch();
        if (json.library) {
          onSelectLibrary(json.library);
        }
      } else {
        toast.error(json.error || 'Failed to import library');
      }
    } catch (e: any) {
      toast.error(e.message || 'Import error');
    } finally {
      setIsUploading(false);
    }
  };

  // Toggle Hide / Show in Dropdown
  const handleToggleHide = async (lib: LibraryInfo) => {
    try {
      const res = await fetch('/api/v1/libraries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          library: lib.name,
          isHidden: !lib.isHidden,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(lib.isHidden ? `"${lib.displayName || lib.name}" is now shown in dropdown` : `"${lib.displayName || lib.name}" hidden from dropdown`);
        queryClient.invalidateQueries({ queryKey: ['libraries'] });
        refetch();
      } else {
        toast.error(json.error || 'Failed to update visibility');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error updating visibility');
    }
  };

  // Save Renamed Display Name
  const handleSaveRename = async (libName: string) => {
    try {
      const res = await fetch('/api/v1/libraries', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          library: libName,
          displayName: editNameValue.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('Library renamed');
        setEditingLib(null);
        queryClient.invalidateQueries({ queryKey: ['libraries'] });
        refetch();
      } else {
        toast.error(json.error || 'Failed to rename library');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error renaming library');
    }
  };

  // Delete Library
  const handleDeleteLibrary = async () => {
    if (!deletingLib) return;
    if (deleteConfirmText !== deletingLib.name) {
      toast.error(`Please type "${deletingLib.name}" to confirm deletion`);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/v1/libraries/${encodeURIComponent(deletingLib.name)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'Library deleted');
        setDeletingLib(null);
        setDeleteConfirmText('');
        queryClient.invalidateQueries({ queryKey: ['libraries'] });
        refetch();

        // If deleted current active library, redirect safely to /libraries
        if (currentLibrary === deletingLib.name) {
          try {
            localStorage.removeItem('skalybr-last-library');
          } catch (e) {}
          window.location.href = '/libraries';
        }
      } else {
        toast.error(json.error || 'Failed to delete library');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error deleting library');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl z-50 text-slate-100 animate-in zoom-in-95 fade-in-0">
            {/* Close Button */}
            <Dialog.Close asChild>
              <button
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>

            <div className="space-y-6">
              <div>
                <Dialog.Title className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
                  <FolderArchive className="w-6 h-6 text-sky-400" />
                  <span>Manage Calibre Libraries</span>
                </Dialog.Title>
                <Dialog.Description className="text-xs sm:text-sm text-slate-400 mt-1">
                  Upload ZIP archives of Calibre libraries, download backups, rename, or toggle dropdown visibility.
                </Dialog.Description>
              </div>

              {/* Upload / Import Section */}
              <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-4 sm:p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                    <Plus className="w-4 h-4 text-sky-400" />
                    <span>Add New Library</span>
                  </h3>
                  {/* Mode Switcher */}
                  <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs self-start sm:self-auto">
                    <button
                      type="button"
                      onClick={() => setUploadMode('file')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                        uploadMode === 'file'
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <FolderArchive className="w-3.5 h-3.5" />
                      <span>Upload ZIP</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setUploadMode('url')}
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-md font-medium transition-colors ${
                        uploadMode === 'url'
                          ? 'bg-sky-600 text-white shadow-sm'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>Remote URL</span>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleUploadSubmit} className="space-y-4">
                  {uploadMode === 'file' ? (
                    <div className="border-2 border-dashed border-slate-800 hover:border-sky-500/50 rounded-xl p-4 text-center cursor-pointer transition-colors bg-slate-900/30">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".zip"
                        onChange={(e) => {
                          const file = e.target.files?.[0] || null;
                          setUploadFile(file);
                          if (file) {
                            const base = file.name.replace(/\.zip$/i, '');
                            const sanitizedFolder = base.replace(/[^a-zA-Z0-9_\-]/g, '_');
                            setCustomLibName(sanitizedFolder);
                            setCustomDisplayName(base);
                          }
                        }}
                        className="hidden"
                        id="library-zip-input"
                      />
                      <label htmlFor="library-zip-input" className="cursor-pointer block">
                        <FolderArchive className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                        {uploadFile ? (
                          <p className="text-sm font-medium text-sky-300 truncate max-w-xs mx-auto">
                            Selected: {uploadFile.name} ({(uploadFile.size / (1024 * 1024)).toFixed(1)} MB)
                          </p>
                        ) : (
                          <div>
                            <p className="text-xs font-semibold text-slate-300">Click to select a Calibre library ZIP file</p>
                            <p className="text-[11px] text-slate-500 mt-0.5">ZIP archive must contain metadata.db</p>
                          </div>
                        )}
                      </label>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-slate-400 block">
                        Remote ZIP URL (Cloud or Web)
                      </label>
                      <div className="relative">
                        <Globe className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                        <input
                          type="url"
                          placeholder="https://example.com/library.zip or Dropbox / Google Drive link"
                          value={remoteUrl}
                          onChange={(e) => {
                            const val = e.target.value;
                            setRemoteUrl(val);
                            if (val && !customDisplayName) {
                              try {
                                const parsed = new URL(val);
                                const lastSeg = parsed.pathname.split('/').filter(Boolean).pop();
                                if (lastSeg && lastSeg.endsWith('.zip')) {
                                  const name = decodeURIComponent(lastSeg.replace(/\.zip$/i, ''));
                                  setCustomDisplayName(name);
                                  setCustomLibName(name.replace(/[^a-zA-Z0-9_\-]/g, '_'));
                                }
                              } catch (_) {}
                            }
                          }}
                          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-sky-500"
                        />
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Supports direct download URLs, Dropbox links (<code className="text-sky-400">?dl=0/1</code>), and Google Drive share links.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-1">
                        Folder Name (Optional ID)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. sci-fi-vault"
                        value={customLibName}
                        onChange={(e) => setCustomLibName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500 font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-slate-400 block mb-1">
                        Display Title (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Sci-Fi & Fantasy Vault"
                        value={customDisplayName}
                        onChange={(e) => setCustomDisplayName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isUploading || (uploadMode === 'file' ? !uploadFile : !remoteUrl.trim())}
                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2 bg-sky-500 hover:bg-sky-400 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm shadow-sky-500/20"
                  >
                    {isUploading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{uploadMode === 'file' ? 'Extracting & Validating Library...' : 'Downloading & Extracting Library...'}</span>
                      </>
                    ) : (
                      <>
                        {uploadMode === 'file' ? <Upload className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                        <span>{uploadMode === 'file' ? 'Upload & Import Library' : 'Download & Import Library'}</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Libraries List & Management Table */}
              <div>
                <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center justify-between">
                  <span>Available Libraries ({libraries.length})</span>
                </h3>

                <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-900/90 text-slate-400 uppercase text-[10px] font-semibold border-b border-slate-800">
                        <tr>
                          <th className="py-2.5 px-3.5">Library</th>
                          <th className="py-2.5 px-3 w-24 text-center">Books</th>
                          <th className="py-2.5 px-3 w-24 text-center">Status</th>
                          <th className="py-2.5 px-3.5 text-right w-44">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {libraries.map((lib) => {
                          const isCurrent = lib.name === currentLibrary;
                          const isEditingThis = editingLib === lib.name;

                          return (
                            <tr
                              key={lib.name}
                              className={`hover:bg-slate-900/60 transition-colors ${
                                isCurrent ? 'bg-sky-500/5' : ''
                              }`}
                            >
                              {/* Library Name / Rename Form */}
                              <td className="py-3 px-3.5">
                                {isEditingThis ? (
                                  <div className="flex items-center gap-1.5 max-w-xs">
                                    <input
                                      type="text"
                                      value={editNameValue}
                                      onChange={(e) => setEditNameValue(e.target.value)}
                                      className="px-2 py-1 bg-slate-900 border border-sky-500 rounded text-xs text-white focus:outline-none w-full"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleSaveRename(lib.name)}
                                      className="p-1 bg-sky-500 text-white rounded hover:bg-sky-400"
                                      title="Save"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditingLib(null)}
                                      className="p-1 bg-slate-800 text-slate-400 rounded hover:text-white"
                                      title="Cancel"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div>
                                    <div className="flex items-center gap-2">
                                      <BookOpen
                                        className={`w-4 h-4 ${
                                          isCurrent ? 'text-sky-400' : 'text-slate-500'
                                        }`}
                                      />
                                      <span className="font-bold text-slate-100">
                                        {lib.displayName || lib.name}
                                      </span>
                                      {isCurrent && (
                                        <span className="px-1.5 py-0.2 text-[9px] font-bold bg-sky-500/20 text-sky-400 border border-sky-500/30 rounded">
                                          Active
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                                      Path: {lib.name}
                                    </p>
                                  </div>
                                )}
                              </td>

                              {/* Book Count */}
                              <td className="py-3 px-3 text-center font-mono">
                                <span className="bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-[11px]">
                                  {lib.bookCount}
                                </span>
                              </td>

                              {/* Visibility Badge */}
                              <td className="py-3 px-3 text-center">
                                {lib.isHidden ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-900 px-2 py-0.5 rounded-full border border-slate-800">
                                    <EyeOff className="w-3 h-3" />
                                    <span>Hidden</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                                    <Eye className="w-3 h-3" />
                                    <span>Visible</span>
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-3.5 text-right">
                                <div className="flex items-center justify-end gap-1">
                                  {/* Select Library */}
                                  {!isCurrent && !lib.isHidden && (
                                    <button
                                      onClick={() => {
                                        onSelectLibrary(lib.name);
                                        onClose();
                                      }}
                                      className="px-2 py-1 text-[11px] font-medium rounded bg-slate-800 hover:bg-sky-500 hover:text-white text-slate-300 transition-colors"
                                    >
                                      Switch
                                    </button>
                                  )}

                                  {/* Edit Display Name */}
                                  <button
                                    onClick={() => {
                                      setEditingLib(lib.name);
                                      setEditNameValue(lib.displayName || lib.name);
                                    }}
                                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-400 transition-colors"
                                    title="Rename library title"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  {/* Toggle Hide/Show */}
                                  <button
                                    onClick={() => handleToggleHide(lib)}
                                    className={`p-1.5 rounded hover:bg-slate-800 transition-colors ${
                                      lib.isHidden
                                        ? 'text-slate-500 hover:text-emerald-400'
                                        : 'text-slate-400 hover:text-amber-400'
                                    }`}
                                    title={lib.isHidden ? 'Show in dropdown' : 'Remove from dropdown'}
                                  >
                                    {lib.isHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                                  </button>

                                  {/* Download ZIP */}
                                  <a
                                    href={`/api/v1/libraries/${encodeURIComponent(lib.name)}/download`}
                                    download
                                    className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-sky-400 transition-colors inline-block"
                                    title="Download library ZIP"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                  </a>

                                  {/* Delete Library */}
                                  <button
                                    onClick={() => {
                                      setDeletingLib(lib);
                                      setDeleteConfirmText('');
                                    }}
                                    className="p-1.5 rounded hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
                                    title="Delete library permanently"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Delete Confirmation Warning Modal */}
      {deletingLib && (
        <Dialog.Root open={Boolean(deletingLib)} onOpenChange={(open) => !open && setDeletingLib(null)}>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 animate-in fade-in-0" />
            <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-md bg-slate-900 border border-rose-500/30 rounded-2xl p-6 shadow-2xl z-50 text-slate-100 animate-in zoom-in-95">
              <div className="flex items-center gap-3 text-rose-400 mb-4">
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div>
                  <Dialog.Title className="text-lg font-bold text-white">Delete Library Permanently</Dialog.Title>
                  <p className="text-xs text-rose-400">Warning: This action cannot be undone!</p>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                This will permanently delete the library directory <span className="font-mono text-sky-300 font-bold bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800">{deletingLib.name}</span>, all its <span className="font-bold text-white">{deletingLib.bookCount} books</span>, metadata, and book files from disk.
              </p>

              <div className="space-y-2 mb-5">
                <label className="text-[11px] text-slate-400 font-medium block">
                  To confirm, type <span className="font-mono font-bold text-white select-all">{deletingLib.name}</span> below:
                </label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={deletingLib.name}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 focus:border-rose-500 rounded-xl text-xs text-white font-mono"
                  autoFocus
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDeletingLib(null)}
                  className="px-4 py-2 text-xs font-medium rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteLibrary}
                  disabled={deleteConfirmText !== deletingLib.name || isDeleting}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-500 text-white disabled:opacity-40 transition-all cursor-pointer shadow-lg shadow-rose-600/20"
                >
                  {isDeleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  <span>Permanently Delete</span>
                </button>
              </div>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}
