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
import { upsertLibraryRecord } from '@/lib/db/skalybr-db';

export function normalizeCloudDownloadUrl(inputUrl: string): string {
  try {
    const u = new URL(inputUrl.trim());

    // 1. Dropbox: change dl=0 to dl=1
    if (u.hostname.includes('dropbox.com')) {
      u.searchParams.set('dl', '1');
      return u.toString();
    }

    // 2. Google Drive: https://drive.google.com/file/d/<id>/view -> direct download
    if (u.hostname.includes('drive.google.com')) {
      const match = u.pathname.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        return `https://drive.google.com/uc?export=download&id=${match[1]}&confirm=t`;
      }
    }

    return inputUrl.trim();
  } catch {
    return inputUrl.trim();
  }
}

export async function downloadRemoteZip(
  urlStr: string,
  maxBytes: number
): Promise<{ buffer?: Buffer; error?: string }> {
  const normalized = normalizeCloudDownloadUrl(urlStr);
  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return { error: 'Invalid URL format.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'Only HTTP and HTTPS URLs are supported.' };
  }

  // Reject loopback / local IP addresses to protect against SSRF
  const hostname = parsed.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '169.254.169.254'
  ) {
    return { error: 'Invalid URL target.' };
  }

  const response = await fetch(normalized, {
    headers: { 'User-Agent': 'Skalybr/0.1.0 (Calibre Library Importer)' },
    redirect: 'follow',
  });

  if (!response.ok) {
    return { error: `Failed to download remote file: HTTP ${response.status} ${response.statusText}` };
  }

  const contentLength = response.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > maxBytes) {
    return { error: `Remote file size exceeds maximum limit of ${Math.round(maxBytes / 1024 / 1024)}MB.` };
  }

  if (!response.body) {
    return { error: 'Remote server returned empty body.' };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      totalBytes += value.length;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        return { error: `Download exceeded maximum file size of ${Math.round(maxBytes / 1024 / 1024)}MB.` };
      }
      chunks.push(value);
    }
  }

  return { buffer: Buffer.concat(chunks) };
}

async function extractLibraryZip(
  buffer: Buffer,
  libraryName: string,
  customDisplayName?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const zip = await JSZip.loadAsync(buffer);

  // Check if metadata.db exists inside zip
  const hasMetadataDb = Object.keys(zip.files).some((f) => f.endsWith('metadata.db'));
  if (!hasMetadataDb) {
    return {
      success: false,
      error: 'Invalid Calibre library ZIP: metadata.db not found anywhere in the archive.',
    };
  }

  // Determine top-level prefix if zipped with a root folder
  let rootPrefix = '';
  const metadataEntry = Object.keys(zip.files).find((f) => f.endsWith('metadata.db'));
  if (metadataEntry && metadataEntry.includes('/')) {
    rootPrefix = metadataEntry.substring(0, metadataEntry.lastIndexOf('metadata.db'));
  }

  if (!fs.existsSync(DEFAULT_CALIBRE_BASE_DIR)) {
    fs.mkdirSync(DEFAULT_CALIBRE_BASE_DIR, { recursive: true });
  }

  const targetDir = path.join(DEFAULT_CALIBRE_BASE_DIR, libraryName);
  if (fs.existsSync(targetDir)) {
    return {
      success: false,
      error: `Directory "${libraryName}" already exists on the server.`,
    };
  }

  fs.mkdirSync(targetDir, { recursive: true });

  for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue;

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
    return {
      success: false,
      error: 'Extraction failed: metadata.db not placed in library root.',
    };
  }

  // Register in skalybr.db and settings
  const displayName = customDisplayName || libraryName;
  upsertLibraryRecord({
    name: libraryName,
    path: targetDir,
    displayName,
  });

  const settings = getLibrarySettings();
  settings.customNames[libraryName] = displayName;
  saveLibrarySettings(settings);

  return {
    success: true,
    message: `Library "${libraryName}" imported and extracted successfully.`,
  };
}

// POST: Upload or download a zipped Calibre library from local file or remote URL
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || '';
    const MAX_UPLOAD_SIZE = process.env.MAX_UPLOAD_SIZE_MB
      ? parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) * 1024 * 1024
      : 1024 * 1024 * 1024; // Default 1GB (1024MB)

    let buffer: Buffer | null = null;
    let libraryName: string | undefined;
    let customDisplayName: string | undefined;

    if (contentType.includes('application/json')) {
      const json = await req.json();
      const { url, name, displayName } = json;

      if (!url || typeof url !== 'string' || !url.trim()) {
        return NextResponse.json({ success: false, error: 'Please provide a valid remote URL.' }, { status: 400 });
      }

      const downloadRes = await downloadRemoteZip(url.trim(), MAX_UPLOAD_SIZE);
      if (downloadRes.error || !downloadRes.buffer) {
        return NextResponse.json({ success: false, error: downloadRes.error || 'Failed to download file' }, { status: 400 });
      }

      buffer = downloadRes.buffer;
      libraryName = name?.trim();
      customDisplayName = displayName?.trim();

      if (!libraryName) {
        try {
          const pathname = new URL(url).pathname;
          const base = path.basename(pathname).replace(/\.zip$/i, '').trim();
          libraryName = base || 'cloud-library';
        } catch {
          libraryName = 'cloud-library';
        }
      }
    } else if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      const remoteUrl = (formData.get('url') as string | null)?.trim();
      libraryName = (formData.get('name') as string | null)?.trim();
      customDisplayName = (formData.get('displayName') as string | null)?.trim();

      if (file && file.size > 0) {
        if (file.size > MAX_UPLOAD_SIZE) {
          return NextResponse.json({
            success: false,
            error: `File size exceeds maximum limit of ${Math.round(MAX_UPLOAD_SIZE / (1024 * 1024))}MB.`,
          }, { status: 413 });
        }
        buffer = Buffer.from(await file.arrayBuffer());
        if (!libraryName) {
          libraryName = file.name.replace(/\.zip$/i, '').trim() || 'uploaded-library';
        }
      } else if (remoteUrl) {
        const downloadRes = await downloadRemoteZip(remoteUrl, MAX_UPLOAD_SIZE);
        if (downloadRes.error || !downloadRes.buffer) {
          return NextResponse.json({ success: false, error: downloadRes.error || 'Failed to download file' }, { status: 400 });
        }
        buffer = downloadRes.buffer;
        if (!libraryName) {
          try {
            const pathname = new URL(remoteUrl).pathname;
            const base = path.basename(pathname).replace(/\.zip$/i, '').trim();
            libraryName = base || 'cloud-library';
          } catch {
            libraryName = 'cloud-library';
          }
        }
      } else {
        return NextResponse.json(
          { success: false, error: 'Please provide either a ZIP file or a remote URL.' },
          { status: 400 }
        );
      }
    } else {
      return NextResponse.json({ success: false, error: 'Unsupported Content-Type' }, { status: 400 });
    }

    if (!buffer) {
      return NextResponse.json({ success: false, error: 'No file data received.' }, { status: 400 });
    }

    // Sanitize library folder name
    const sanitizedName = (libraryName || 'library').replace(/[^a-zA-Z0-9_\-]/g, '_');

    const extractRes = await extractLibraryZip(buffer, sanitizedName, customDisplayName);
    if (!extractRes.success) {
      return NextResponse.json({ success: false, error: extractRes.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: extractRes.message,
      library: sanitizedName,
    });
  } catch (error: any) {
    console.error('Error uploading/importing library:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

