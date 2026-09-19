import { NextRequest, NextResponse } from 'next/server';
import { getDatabaseConnection } from '@/lib/calibre/db';
import { getLibraryPath } from '@/lib/config';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; format: string }> }
) {
  try {
    const { id, format } = await params;
    const { searchParams } = new URL(req.url);
    const library = searchParams.get('library') || undefined;

    const libPath = getLibraryPath(library);
    const db = getDatabaseConnection(libPath);

    const row = db
      .prepare(`
        SELECT b.path, d.name, d.format
        FROM data d
        JOIN books b ON b.id = d.book
        WHERE d.book = ? AND LOWER(d.format) = LOWER(?)
      `)
      .get(parseInt(id, 10), format) as any;

    if (!row) {
      return new NextResponse('Format file not found', { status: 404 });
    }

    const filePath = path.join(libPath, row.path, `${row.name}.${row.format.toLowerCase()}`);

    if (!fs.existsSync(filePath)) {
      return new NextResponse('File missing on disk', { status: 404 });
    }

    const fileBuffer = await fs.promises.readFile(filePath);
    const ext = row.format.toLowerCase();

    const contentTypeMap: Record<string, string> = {
      epub: 'application/epub+zip',
      mobi: 'application/x-mobipocket-ebook',
      azw3: 'application/vnd.amazon.ebook',
      pdf: 'application/pdf',
      cbz: 'application/vnd.comicbook+zip',
      cbr: 'application/vnd.comicbook-rar',
      txt: 'text/plain',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    const fileName = `${row.name}.${ext}`;

    return new NextResponse(new Uint8Array(fileBuffer), {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (error: any) {
    return new NextResponse(error.message, { status: 500 });
  }
}
