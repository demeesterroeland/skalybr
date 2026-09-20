import { NextRequest, NextResponse } from 'next/server';
import { FlatBookRepository } from '@/lib/calibre/repository';
import { DEFAULT_CALIBRE_BASE_DIR, getLibraryPath } from '@/lib/config';
import { getLibrarySettings, saveLibrarySettings } from '@/lib/library-settings';
import { closeDatabaseConnection } from '@/lib/calibre/db';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';

import { getCurrentUser } from '@/lib/auth/server';
import { filterAccessibleLibraries } from '@/lib/auth/acl';
import { requireAdmin } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

// GET: list libraries (with optional ?all=true to include hidden ones for management)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const includeHidden = searchParams.get('all') === 'true';

    const { user } = await getCurrentUser(req);
    const libraries = FlatBookRepository.listAvailableLibraries(DEFAULT_CALIBRE_BASE_DIR, includeHidden);
    const accessibleLibraries = filterAccessibleLibraries(user, libraries, 'reader');

    const maxUploadSizeMb = process.env.MAX_UPLOAD_SIZE_MB
      ? parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10)
      : 1024;

    return NextResponse.json({
      success: true,
      data: accessibleLibraries,
      maxUploadSizeMb,
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

    // 3. OneDrive Live (onedrive.live.com)
    if (u.hostname.includes('onedrive.live.com')) {
      if (u.pathname.includes('/redir')) {
        u.pathname = u.pathname.replace('/redir', '/download');
      }
      u.searchParams.set('download', '1');
      return u.toString();
    }

    // 4. SharePoint / OneDrive for Business (*.sharepoint.com)
    if (u.hostname.includes('sharepoint.com')) {
      u.searchParams.set('download', '1');
      return u.toString();
    }

    return inputUrl.trim();
  } catch {
    return inputUrl.trim();
  }
}

export interface ResolvedDownload {
  url: string;
  headers?: Record<string, string>;
}

export async function resolveDirectDownloadUrl(inputUrl: string): Promise<ResolvedDownload> {
  const normalized = normalizeCloudDownloadUrl(inputUrl);
  try {
    const u = new URL(normalized);

    // 1. Google Drive confirmation form handling
    if (u.hostname.includes('drive.google.com') || u.hostname.includes('drive.usercontent.google.com')) {
      const res = await fetch(normalized, {
        headers: { 'User-Agent': 'Skalybr/0.1.0 (Calibre Library Importer)' },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });

      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const html = await res.text();
        if (html.includes('uc-warning-caption') || html.includes('download-form')) {
          const formActionMatch = html.match(/<form id="download-form" action="([^"]+)"/);
          const uuidMatch = html.match(/<input type="hidden" name="uuid" value="([^"]+)"/);
          const idMatch = normalized.match(/[?&]id=([a-zA-Z0-9_-]+)/);
          const id = idMatch ? idMatch[1] : '';
          const formAction = formActionMatch ? formActionMatch[1] : 'https://drive.usercontent.google.com/download';
          const uuid = uuidMatch ? uuidMatch[1] : '';
          if (id && uuid) {
            return { url: `${formAction}?id=${id}&export=download&confirm=t&uuid=${uuid}` };
          }
        }
      }
    }

    // 2. OneDrive links (1drv.ms or onedrive.live.com)
    if (u.hostname === '1drv.ms' || u.hostname.endsWith('.1drv.ms') || u.hostname.includes('onedrive.live.com')) {
      const cookieJar = new Map<string, string>();
      let curr = inputUrl.trim();
      let spopath: string | null = null;
      let personalRoot: string | null = null;
      let landingUrl = inputUrl.trim();

      for (let hop = 0; hop < 6; hop++) {
        const cookieHeader = Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
        const r = await fetch(curr, {
          method: 'GET',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            ...(cookieHeader ? { 'Cookie': cookieHeader } : {}),
          },
          redirect: 'manual',
          signal: AbortSignal.timeout(8000),
        });

        // Collect cookies across redirect hops
        const setCookies = (r.headers as any).getSetCookie
          ? (r.headers as any).getSetCookie()
          : [r.headers.get('set-cookie')].filter(Boolean);
        for (const sc of setCookies) {
          const match = sc.match(/^([^=]+)=([^;]+)/);
          if (match) {
            cookieJar.set(match[1].trim(), match[2].trim());
          }
        }

        const loc = r.headers.get('location');
        if (!loc) {
          landingUrl = curr;
          break;
        }

        const nextUrl = new URL(loc, curr);
        const spo = nextUrl.searchParams.get('spopath');
        if (spo && !spopath && spo.startsWith('/personal/')) {
          spopath = spo;
          const match = spopath.match(/^\/personal\/([^/]+)/);
          if (match) personalRoot = `/personal/${match[1]}`;
        }
        landingUrl = nextUrl.toString();
        curr = nextUrl.toString();
      }

      if (spopath && personalRoot) {
        const downloadUrl = `https://onedrive.live.com${personalRoot}/_layouts/15/download.aspx?SourceUrl=${encodeURIComponent(spopath)}`;
        const cookieHeader = Array.from(cookieJar.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
        return {
          url: downloadUrl,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Referer': landingUrl,
            'Cookie': cookieHeader,
          },
        };
      }
    }
  } catch {}
  return { url: normalized };
}

export async function downloadRemoteZip(
  urlStr: string,
  maxBytes: number,
  onProgress?: (loaded: number, total: number | null) => void
): Promise<{ buffer?: Buffer; error?: string }> {
  const resolved = await resolveDirectDownloadUrl(urlStr);
  const normalized = resolved.url;
  const customHeaders = resolved.headers || {};
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

  // Pre-flight check: Try a lightweight HEAD request first (skip for OneDrive which rejects HEAD with 302)
  if (!customHeaders.Cookie) {
    try {
      const headRes = await fetch(normalized, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Skalybr/0.1.0 (Calibre Library Importer)',
          ...customHeaders,
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(8000),
      });
      if (headRes.ok) {
        const cl = headRes.headers.get('content-length');
        if (cl) {
          const size = parseInt(cl, 10);
          if (!isNaN(size) && size > maxBytes) {
            const sizeMb = (size / (1024 * 1024)).toFixed(1);
            const maxMb = Math.round(maxBytes / (1024 * 1024));
            return {
              error: `Remote file size (${sizeMb} MB) exceeds maximum limit of ${maxMb} MB. Aborted before download.`,
            };
          }
        }
      }
    } catch {
      // Proceed to GET if server rejects HEAD or times out
    }
  }

  const response = await fetch(normalized, {
    headers: {
      'User-Agent': 'Skalybr/0.1.0 (Calibre Library Importer)',
      ...customHeaders,
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(180000),
  });

  if (response.url && response.url.includes('accounts.google.com')) {
    return {
      error: 'Google Drive requires sign-in. This file is private. Please set link sharing to "Anyone with the link can view".',
    };
  }

  if (!response.ok) {
    return { error: `Failed to download remote file: HTTP ${response.status} ${response.statusText}` };
  }

  // Check Content-Length on GET response before reading body stream
  const contentLength = response.headers.get('content-length');
  let expectedTotal: number | null = null;
  if (contentLength) {
    const size = parseInt(contentLength, 10);
    if (!isNaN(size)) {
      expectedTotal = size;
      if (size > maxBytes) {
        const sizeMb = (size / (1024 * 1024)).toFixed(1);
        const maxMb = Math.round(maxBytes / (1024 * 1024));
        return {
          error: `Remote file size (${sizeMb} MB) exceeds maximum limit of ${maxMb} MB. Aborted before download.`,
        };
      }
    }
  }

  if (!response.body) {
    return { error: 'Remote server returned empty body.' };
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let lastProgressReport = 0;

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
      if (onProgress) {
        const now = Date.now();
        if (now - lastProgressReport > 100) {
          lastProgressReport = now;
          onProgress(totalBytes, expectedTotal);
        }
      }
    }
  }

  if (onProgress) {
    onProgress(totalBytes, expectedTotal);
  }

  return { buffer: Buffer.concat(chunks) };
}

async function extractLibraryZip(
  buffer: Buffer,
  libraryName: string,
  customDisplayName?: string,
  onProgress?: (extracted: number, total: number) => void
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

  const fileEntries = Object.entries(zip.files).filter(([_, entry]) => !entry.dir);
  const totalFiles = fileEntries.length;
  let extractedCount = 0;
  let lastProgressReport = 0;

  for (const [relativePath, zipEntry] of fileEntries) {
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
    extractedCount++;

    if (onProgress) {
      const now = Date.now();
      if (now - lastProgressReport > 100 || extractedCount === totalFiles) {
        lastProgressReport = now;
        onProgress(extractedCount, totalFiles);
      }
    }
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
    const guard = await requireAdmin(req);
    if (!guard.authorized) {
      return guard.response!;
    }

    const isStream = req.nextUrl.searchParams.get('stream') === 'true';
    const contentType = req.headers.get('content-type') || '';
    const MAX_UPLOAD_SIZE = process.env.MAX_UPLOAD_SIZE_MB
      ? parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) * 1024 * 1024
      : 1024 * 1024 * 1024; // Default 1GB (1024MB)

    let bodyJson: any = null;
    if (contentType.includes('application/json')) {
      bodyJson = await req.json().catch(() => null);
    }

    // Streaming response mode for remote URL downloads
    if (isStream && bodyJson) {
      const { url, name, displayName } = bodyJson;

      if (!url || typeof url !== 'string' || !url.trim()) {
        return NextResponse.json({ success: false, error: 'Please provide a valid remote URL.' }, { status: 400 });
      }

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          const send = (data: any) => {
            try {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            } catch {}
          };

          try {
            send({ stage: 'connecting', percent: 3, message: 'Connecting to cloud provider...' });

            const downloadRes = await downloadRemoteZip(url.trim(), MAX_UPLOAD_SIZE, (loaded, total) => {
              const loadedMb = (loaded / (1024 * 1024)).toFixed(1);
              const totalMb = total ? `${(total / (1024 * 1024)).toFixed(1)} MB` : 'unknown';
              const percent = total ? Math.min(75, Math.round(3 + (loaded / total) * 72)) : 35;
              send({
                stage: 'downloading',
                percent,
                loaded,
                total,
                message: `Downloading from cloud: ${loadedMb} MB / ${totalMb} (${total ? Math.round((loaded / total) * 100) : '?'}%)`,
                detail: `${loadedMb} MB of ${totalMb}`,
              });
            });

            if (downloadRes.error || !downloadRes.buffer) {
              send({ stage: 'error', success: false, error: downloadRes.error || 'Failed to download file' });
              controller.close();
              return;
            }

            send({ stage: 'extracting', percent: 76, message: 'Download complete. Reading ZIP archive...' });

            let libName = name?.trim();
            if (!libName) {
              try {
                const pathname = new URL(url).pathname;
                const base = path.basename(pathname).replace(/\.zip$/i, '').trim();
                libName = base || 'cloud-library';
              } catch {
                libName = 'cloud-library';
              }
            }
            const sanitizedName = libName.replace(/[^a-zA-Z0-9_\-]/g, '_');

            const extractRes = await extractLibraryZip(
              downloadRes.buffer,
              sanitizedName,
              displayName?.trim(),
              (extracted, total) => {
                const percent = Math.min(98, 76 + Math.round((extracted / total) * 22));
                send({
                  stage: 'extracting',
                  percent,
                  extracted,
                  total,
                  message: `Extracting archive: ${extracted.toLocaleString()} / ${total.toLocaleString()} files`,
                  detail: `${Math.round((extracted / total) * 100)}% unzipped`,
                });
              }
            );

            if (!extractRes.success) {
              send({ stage: 'error', success: false, error: extractRes.error });
              controller.close();
              return;
            }

            send({
              stage: 'complete',
              percent: 100,
              success: true,
              library: sanitizedName,
              message: extractRes.message,
            });
            controller.close();
          } catch (err: any) {
            send({ stage: 'error', success: false, error: err.message || 'Import failed.' });
            controller.close();
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
          'X-Accel-Buffering': 'no',
        },
      });
    }

    let buffer: Buffer | null = null;
    let libraryName: string | undefined;
    let customDisplayName: string | undefined;

    if (bodyJson) {
      const { url, name, displayName } = bodyJson;

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

