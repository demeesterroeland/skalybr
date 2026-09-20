'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import OnboardingZeroState from '@/components/onboarding-zero-state';
import { Library } from 'lucide-react';

export default function LibraryGateway() {
  const router = useRouter();
  
  const { data: libraries, isLoading } = useQuery({
    queryKey: ['libraries'],
    queryFn: async () => {
      const res = await fetch('/api/v1/libraries');
      const json = await res.json();
      return json.data || [];
    },
  });

  if (isLoading) return null;

  if (!libraries || libraries.length === 0) {
    return <OnboardingZeroState />;
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold text-white mb-10">Who's reading?</h1>
      
      <div className="flex flex-wrap gap-8 justify-center max-w-4xl">
        {libraries.map((lib: { name: string }) => (
          <div
            key={lib.name}
            className="flex flex-col items-center gap-4 cursor-pointer group"
            onClick={() => {
              try {
                localStorage.setItem('skalybr-last-library', lib.name);
              } catch (e) {
                // Ignore
              }
              router.push(`/libraries/${encodeURIComponent(lib.name)}/books`);
            }}
          >
            <div className="w-32 h-32 rounded-lg bg-slate-800 border-2 border-transparent group-hover:border-sky-500 flex items-center justify-center transition-all">
              <Library className="w-12 h-12 text-slate-400 group-hover:text-sky-500" />
            </div>
            <span className="text-slate-300 font-medium group-hover:text-white text-lg">{lib.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
