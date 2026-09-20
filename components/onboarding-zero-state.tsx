'use client';

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Library, Loader2 } from 'lucide-react';

import { toast } from 'sonner';

export default function OnboardingZeroState() {
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-10 max-w-lg text-center shadow-xl">
        <div className="mx-auto w-16 h-16 bg-sky-500/10 rounded-full flex items-center justify-center mb-6">
          <Library className="w-8 h-8 text-sky-400" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-4">Welcome to Skalybr</h2>
        <p className="text-slate-400 mb-8 leading-relaxed">
          It looks like you don't have any Calibre libraries configured yet. 
          You can mount your existing libraries, or load our demo library to see how it works.
        </p>
        
        <button
          onClick={handleLoadDemo}
          disabled={isLoading}
          className="bg-sky-500 hover:bg-sky-400 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center justify-center mx-auto w-full max-w-xs disabled:opacity-50 disabled:cursor-not-allowed gap-2"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            'Load Demo Library'
          )}
        </button>
      </div>
    </div>
  );
}
