import { NextRequest, NextResponse } from 'next/server';
import { FlatBookRepository } from '@/lib/calibre/repository';
import { getResizedCover } from '@/lib/calibre/cover';
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

    if (!book || !book.hasCover) {
      return new NextResponse('Cover not found', { status: 404 });
    }

    const libPath = getLibraryPath(library);
    const buffer = await getResizedCover(libPath, book.path, width, format);

    if (!buffer) {
      return new NextResponse('Cover image missing on disk', { status: 404 });
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
