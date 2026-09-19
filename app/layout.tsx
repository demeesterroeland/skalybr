import type { Metadata } from 'next';
import './globals.css';
import Providers from '@/components/Providers';

export const metadata: Metadata = {
  title: 'Skalybr — Self-Hosted E-Book Library',
  description: 'The modern, ultra-fast self-hosted e-book server and reader for Calibre libraries.',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-sky-500/30 selection:text-sky-300">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
