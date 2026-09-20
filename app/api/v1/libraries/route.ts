import { NextRequest, NextResponse } from 'next/server';
import { FlatBookRepository } from '@/lib/calibre/repository';
import { DEFAULT_CALIBRE_BASE_DIR, getLibraryPath } from '@/lib/config';
import { getLibrarySettings, saveLibrarySettings } from '@/lib/library-settings';
import { closeDatabaseConnection } from '@/lib/calibre/db';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

// GET: list libraries (with optional ?all=true to include hidden ones for management)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeHidden = searchParams.get('all') === 'true';

    const libraries = FlatBookRepository.listAvailableLibraries(DEFAULT_CALIBRE_BASE_DIR, includeHidden);
    return NextResponse.json({
      success: true,
      data: libraries,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

// POST: Upload a zipped Calibre library or create/register library
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';

    // Handle Multipart Form Upload (ZIP file)
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      let libraryName = (formData.get('name') as string | null)?.trim();

      if (!file) {
        return NextResponse.json({ success: false, error: 'No ZIP file provided' }, { status: 400 });
      }

      if (!libraryName) {
        // Derive name from filename without .zip
        libraryName = file.name.replace(/\.zip$/i, '').trim() || 'uploaded-library';
      }

      // Sanitize library folder name
      libraryName = libraryName.replace(/[^a-zA-Z0-9_\-]/g, '_');
      const targetDir = path.join(process.cwd(), libraryName);

      if (fs.existsSync(targetDir)) {
        return NextResponse.json(
          { success: false, error: `Directory "${libraryName}" already exists on the server.` },
          { status: 400 }
        );
      }

      const MAX_UPLOAD_SIZE = process.env.MAX_UPLOAD_SIZE_MB ? parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) * 1024 * 1024 : 500 * 1024 * 1024;
      if (file.size > MAX_UPLOAD_SIZE) {
        return NextResponse.json({ success: false, error: 'File size exceeds limit' }, { status: 413 });
      }
      
      const buffer = Buffer.from(await file.arrayBuffer());
      const zip = await JSZip.loadAsync(buffer);

      // Check if metadata.db exists inside zip
      const hasMetadataDb = Object.keys(zip.files).some((f) => f.endsWith('metadata.db'));
      if (!hasMetadataDb) {
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid Calibre library ZIP: metadata.db not found anywhere in the archive.',
          },
          { status: 400 }
        );
      }

      // Determine top-level prefix if zipped with a root folder
      // e.g., if files are "my-lib/metadata.db" vs "metadata.db"
      let rootPrefix = '';
      const metadataEntry = Object.keys(zip.files).find((f) => f.endsWith('metadata.db'));
      if (metadataEntry && metadataEntry.includes('/')) {
        rootPrefix = metadataEntry.substring(0, metadataEntry.lastIndexOf('metadata.db'));
      }

      // Extract files safely
      fs.mkdirSync(targetDir, { recursive: true });

      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue;

        // Strip prefix if any
        let cleanRelPath = relativePath;
        if (rootPrefix && cleanRelPath.startsWith(rootPrefix)) {
          cleanRelPath = cleanRelPath.slice(rootPrefix.length);
        }
        if (!cleanRelPath) continue;

        // Prevent path traversal
        const resolvedPath = path.resolve(targetDir, cleanRelPath);
        if (!resolvedPath.startsWith(path.resolve(targetDir) + path.sep)) {
          continue;
        }

        fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
        const content = await zipEntry.async('nodebuffer');
        fs.writeFileSync(resolvedPath, content);
      }

      // Verify metadata.db exists in extracted target
      if (!fs.existsSync(path.join(targetDir, 'metadata.db'))) {
        return NextResponse.json(
          { success: false, error: 'Extraction failed: metadata.db not placed in library root.' },
          { status: 400 }
        );
      }

      // Update library settings if display name was provided
      const customDisplayName = (formData.get('displayName') as string | null)?.trim();
      if (customDisplayName) {
        const settings = getLibrarySettings();
        settings.customNames[libraryName] = customDisplayName;
        saveLibrarySettings(settings);
      }

      return NextResponse.json({
        success: true,
        message: `Library "${libraryName}" uploaded and extracted successfully.`,
        library: libraryName,
      });
    }

    return NextResponse.json({ success: false, error: 'Unsupported Content-Type' }, { status: 400 });
  } catch (error: any) {
    console.error('Error uploading library:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

