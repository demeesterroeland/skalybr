import { NextRequest, NextResponse } from 'next/server';
import { getLibraryPath } from '@/lib/config';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

function addDirectoryToZip(zip: JSZip, dirPath: string, rootDir: string) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relPath = path.relative(rootDir, fullPath);

    if (entry.isDirectory()) {
      addDirectoryToZip(zip, fullPath, rootDir);
    } else {
      zip.file(relPath, fs.readFileSync(fullPath));
    }
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const library = searchParams.get('library');

    if (!library) {
      return new NextResponse('Library query param is required', { status: 400 });
    }

    const libPath = getLibraryPath(library);
    const resolvedPath = path.resolve(libPath);

    if (!fs.existsSync(resolvedPath) || !fs.existsSync(path.join(resolvedPath, 'metadata.db'))) {
      return new NextResponse('Library not found on disk', { status: 404 });
    }

    const zip = new JSZip();
    addDirectoryToZip(zip, resolvedPath, resolvedPath);

    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const safeFilename = `${library.replace(/[^a-zA-Z0-9_\-]/g, '_')}-calibre-library.zip`;

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Error downloading library ZIP:', error);
    return new NextResponse(error.message, { status: 500 });
  }
}
