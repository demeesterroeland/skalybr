'use client';

import React, { useState } from 'react';
import { BookFlattened, UpdateBookInput } from '@/lib/types';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Save, Star } from 'lucide-react';
import { toast } from 'sonner';

interface BookEditModalProps {
  book: BookFlattened;
  libraryName: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updated: BookFlattened) => void;
}

export default function BookEditModal({
  book,
  libraryName,
  isOpen,
  onClose,
  onSaved,
}: BookEditModalProps) {
  const [title, setTitle] = useState(book.title);
  const [description, setDescription] = useState(book.description || '');
  const [rating, setRating] = useState<number>(book.rating || 0);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const payload: UpdateBookInput = {
      title,
      description,
      rating,
    };

    try {
      const res = await fetch(
        `/api/v1/books/${book.id}?library=${encodeURIComponent(libraryName)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      const json = await res.json();
      if (json.success) {
        toast.success('Book metadata updated successfully');
        onSaved(json.data);
      } else {
        toast.error(json.error || 'Failed to update book');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating book');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] animate-in fade-in-0" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-xl bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl z-[60] text-slate-100 animate-in zoom-in-95 fade-in-0">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <Dialog.Title className="text-lg font-bold text-white flex items-center gap-2">
              <span>Edit Book Metadata</span>
            </Dialog.Title>
            <Dialog.Close asChild>
              <button className="text-slate-400 hover:text-white p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </div>

            {/* Rating (0-5 stars) */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Rating ({rating.toFixed(1)} / 5)
              </label>
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRating(star === rating ? 0 : star)}
                    className="p-1 hover:scale-110 transition-transform cursor-pointer"
                  >
                    <Star
                      className={`w-6 h-6 ${
                        star <= rating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-slate-600 hover:text-slate-400'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Synopsis / Description */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Synopsis / Description (HTML or Text)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={6}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-sky-500 font-sans transition-colors resize-y"
              />
            </div>

            {/* Submit buttons */}
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-white font-semibold text-sm transition-all shadow-lg shadow-sky-500/20 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
