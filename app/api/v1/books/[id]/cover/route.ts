import { NextRequest, NextResponse } from 'next/server';
import { FlatBookRepository } from '@/lib/calibre/repository';
import { getResizedCover, generateFallbackCoverBuffer } from '@/lib/calibre/cover';
import { getLibraryPath } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const library = searchParams.get('library') || undefined;
    const width = parseInt(searchParams.get('width') || '360', 10);
    const format = (searchParams.get('format') as 'webp' | 'jpeg') || 'webp';

    const repo = new FlatBookRepository(library);
    const book = repo.getBookById(parseInt(id, 10));

    if (!book) {
      return new NextResponse('Book not found', { status: 404 });
    }

    const libPath = getLibraryPath(library);
    let buffer: Buffer | null = null;

    if (book.hasCover) {
      buffer = await getResizedCover(libPath, book.path, width, format);
    }

    // If book has no cover on disk or hasCover=0, generate on-the-fly typographic SVG cover
    if (!buffer) {
      const category = book.collection || (book.tags ? book.tags.split(',')[0]?.trim() : 'CLASSIC') || 'CLASSIC';
      buffer = await generateFallbackCoverBuffer(
        book.title,
        book.authors || 'Unknown Author',
        category,
        width,
        format
      );
    }

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': format === 'webp' ? 'image/webp' : 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
      },
    });
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}
