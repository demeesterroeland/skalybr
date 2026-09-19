'use client';

import React, { useState } from 'react';
import { BookFlattened } from '@/lib/types';
import * as Dialog from '@radix-ui/react-dialog';
import {
  X,
  Download,
  Star,
  Book,
  Calendar,
  Building2,
  Globe,
  Tag,
  Bookmark,
  Pencil,
  Trash2,
  Hash,
} from 'lucide-react';
import BookEditModal from './BookEditModal';
import { toast } from 'sonner';

interface BookDetailModalProps {
  book: BookFlattened | null;
  libraryName: string;
  isOpen: boolean;
  onClose: () => void;
  onBookUpdated: (updated: BookFlattened) => void;
  onBookDeleted: (id: number) => void;
}

export default function BookDetailModal({
  book,
  libraryName,
  isOpen,
  onClose,
  onBookUpdated,
  onBookDeleted,
}: BookDetailModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  if (!book) return null;

  const coverUrl = `/api/v1/books/${book.id}/cover?library=${encodeURIComponent(
    libraryName
  )}&width=600&format=webp`;

  const formatList = book.formats ? book.formats.split(',').filter(Boolean) : [];

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${book.title}" from ${libraryName}?`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch(
        `/api/v1/books/${book.id}?library=${encodeURIComponent(libraryName)}`,
        {
          method: 'DELETE',
        }
      );
      const json = await res.json();
      if (json.success) {
        toast.success(`"${book.title}" deleted`);
        onBookDeleted(book.id);
        onClose();
      } else {
        toast.error(json.error || 'Failed to delete book');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error deleting book');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 animate-in fade-in-0" />
          <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-3xl max-h-[90vh] overflow-y-auto bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl z-50 text-slate-100 animate-in zoom-in-95 fade-in-0">
            {/* Close Button */}
            <Dialog.Close asChild>
              <button
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white rounded-full bg-slate-800/60 hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
              {/* Left: Cover & Downloads */}
              <div className="flex flex-col items-center">
                <div className="w-full max-w-[240px] aspect-[2/3] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-xl relative">
                  {book.hasCover ? (
                    <img
                      src={coverUrl}
                      alt={book.title}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-600">
                      <Book className="w-12 h-12 mb-2" />
                      <span className="text-xs">No Cover</span>
                    </div>
                  )}
                </div>

                {/* Direct Download Buttons */}
                {formatList.length > 0 && (
                  <div className="w-full mt-4 space-y-2">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center">
                      Download Formats
                    </div>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {formatList.map((fmt) => (
                        <a
                          key={fmt}
                          href={`/api/v1/books/${book.id}/file/${fmt.toLowerCase()}?library=${encodeURIComponent(
                            libraryName
                          )}`}
                          download
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500/15 hover:bg-sky-500 text-sky-400 hover:text-white border border-sky-500/30 text-xs font-mono font-bold uppercase transition-all shadow-sm cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{fmt}</span>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions: Edit & Delete */}
                <div className="flex items-center gap-2 mt-5 pt-4 border-t border-slate-800/80 w-full justify-center">
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5 text-sky-400" />
                    <span>Edit Metadata</span>
                  </button>

                  <button
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </div>

              {/* Right: Book Details & Synopsis */}
              <div className="md:col-span-2 flex flex-col">
                {book.seriesName && (
                  <div className="text-xs font-bold text-sky-400 uppercase tracking-wide mb-1 flex items-center gap-1">
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>
                      {book.seriesName} {book.seriesIndex ? `· Book ${book.seriesIndex}` : ''}
                    </span>
                  </div>
                )}

                <Dialog.Title className="text-xl sm:text-2xl font-black text-white leading-tight">
                  {book.title}
                </Dialog.Title>

                <p className="text-sm font-semibold text-slate-300 mt-1">
                  By {book.authors || 'Unknown Author'}
                </p>

                {/* Key Metadata Chips */}
                <div className="flex flex-wrap gap-2.5 my-4 text-xs">
                  {book.rating !== null && book.rating > 0 && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20 font-semibold">
                      <Star className="w-3.5 h-3.5 fill-amber-400" />
                      <span>{book.rating.toFixed(1)} / 5</span>
                    </div>
                  )}

                  {book.pubdate && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300">
                      <Calendar className="w-3.5 h-3.5 text-slate-500" />
                      <span>{new Date(book.pubdate).getFullYear()}</span>
                    </div>
                  )}

                  {book.publisher && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>{book.publisher}</span>
                    </div>
                  )}

                  {book.language && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 uppercase font-mono">
                      <Globe className="w-3.5 h-3.5 text-slate-500" />
                      <span>{book.language}</span>
                    </div>
                  )}

                  {book.isbn && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-800 text-slate-300 font-mono">
                      <Hash className="w-3.5 h-3.5 text-slate-500" />
                      <span>ISBN: {book.isbn}</span>
                    </div>
                  )}

                  {book.collection && (
                    <div className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500/15 text-sky-300 border border-sky-500/30 font-semibold">
                      <Bookmark className="w-3.5 h-3.5 text-sky-400" />
                      <span>{book.collection}</span>
                    </div>
                  )}
                </div>

                {/* Description / Blurb */}
                <div className="mt-2 flex-1">
                  <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                    Synopsis
                  </h4>
                  {book.description ? (
                    <div
                      className="text-sm text-slate-300 leading-relaxed max-h-[220px] overflow-y-auto pr-2 prose prose-invert prose-sm"
                      dangerouslySetInnerHTML={{ __html: book.description }}
                    />
                  ) : (
                    <p className="text-sm text-slate-500 italic">No description available.</p>
                  )}
                </div>

                {/* Tags list */}
                {book.tags && (
                  <div className="mt-6 pt-4 border-t border-slate-800">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Tag className="w-3 h-3 text-sky-400" /> Tags
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {book.tags.split(',').map((tag) => (
                        <span
                          key={tag.trim()}
                          className="px-2.5 py-1 rounded-lg text-xs bg-slate-800/80 text-slate-300 border border-slate-700/50"
                        >
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Edit Modal */}
      {isEditing && (
        <BookEditModal
          book={book}
          libraryName={libraryName}
          isOpen={isEditing}
          onClose={() => setIsEditing(false)}
          onSaved={(updated) => {
            onBookUpdated(updated);
            setIsEditing(false);
          }}
        />
      )}
    </>
  );
}
