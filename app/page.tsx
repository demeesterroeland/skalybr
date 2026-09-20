'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    try {
      const lastLibrary = localStorage.getItem('skalybr-last-library');
      if (lastLibrary) {
        router.replace('/libraries/' + encodeURIComponent(lastLibrary) + '/books');
      } else {
        router.replace('/libraries');
      }
    } catch (e) {
      router.replace('/libraries');
    }
  }, [router]);

  return null;
}
