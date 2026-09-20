import { NextRequest, NextResponse } from 'next/server';
import { normalizeCloudDownloadUrl, resolveDirectDownloadUrl } from '../route';
import { formatBytes } from '@/lib/calibre/repository';
import path from 'path';

export const dynamic = 'force-dynamic';

export function parseContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const matchUtf8 = header.match(/filename\*=(?:UTF-8''|utf-8'')([^;\n]+)/i);
  if (matchUtf8) {
    try {
      return decodeURIComponent(matchUtf8[1].trim());
    } catch {}
  }
  const matchQuoted = header.match(/filename="([^"]+)"/i);
  if (matchQuoted) return matchQuoted[1].trim();
  const matchPlain = header.match(/filename=([^;\n\s]+)/i);
  if (matchPlain) return matchPlain[1].trim();
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const json = await req.json().catch(() => null);
    const rawUrl = json?.url?.trim();

    if (!rawUrl || typeof rawUrl !== 'string') {
      return NextResponse.json(
        { success: false, reachable: false, error: 'Please enter a valid URL.' },
        { status: 400 }
      );
    }

    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return NextResponse.json(
        { success: false, reachable: false, error: 'Invalid URL format.' },
        { status: 400 }
      );
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return NextResponse.json(
        { success: false, reachable: false, error: 'Only HTTP and HTTPS URLs are supported.' },
        { status: 400 }
      );
    }

    // SSRF Check
    const hostname = parsed.hostname.toLowerCase();
    if (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '169.254.169.254'
    ) {
      return NextResponse.json(
        { success: false, reachable: false, error: 'Invalid URL target.' },
        { status: 400 }
      );
    }

    const MAX_UPLOAD_SIZE = process.env.MAX_UPLOAD_SIZE_MB
      ? parseInt(process.env.MAX_UPLOAD_SIZE_MB, 10) * 1024 * 1024
      : 1024 * 1024 * 1024;

    const resolved = await resolveDirectDownloadUrl(rawUrl);
    const normalized = resolved.url;
    const customHeaders = resolved.headers || {};

    let statusCode = 200;
    let filename: string | null = null;
    let contentLength: number | null = null;
    let contentType: string | null = null;

    // 1. Try a lightweight HEAD request first (timeout 6s) - skip for OneDrive session links which reject HEAD with 302
    let headSucceeded = false;
    if (!customHeaders.Cookie) {
      try {
        const headRes = await fetch(normalized, {
          method: 'HEAD',
          headers: {
            'User-Agent': 'Skalybr/0.1.0 (Calibre Library Inspector)',
            ...customHeaders,
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(6000),
        });

        statusCode = headRes.status;

        // Check if redirected to Google sign-in (private file)
        if (headRes.url && headRes.url.includes('accounts.google.com')) {
          return NextResponse.json({
            success: false,
            reachable: false,
            statusCode: 401,
            error: 'Google Drive requires sign-in. This file is private. Please set link sharing to "Anyone with the link can view".',
          });
        }

        if (headRes.status === 401 || headRes.status === 403) {
          return NextResponse.json({
            success: false,
            reachable: false,
            statusCode: headRes.status,
            error: `Access denied (HTTP ${headRes.status}). If using Google Drive, OneDrive, or Dropbox, ensure file sharing is set to "Anyone with the link".`,
          });
        }

        if (headRes.status === 404) {
          return NextResponse.json({
            success: false,
            reachable: false,
            statusCode: 404,
            error: 'File not found (HTTP 404). Please verify the link.',
          });
        }

        if (headRes.ok) {
          headSucceeded = true;
          filename = parseContentDisposition(headRes.headers.get('content-disposition'));
          contentType = headRes.headers.get('content-type');
          const cl = headRes.headers.get('content-length');
          if (cl) {
            const parsedCl = parseInt(cl, 10);
            if (!isNaN(parsedCl) && parsedCl > 0) {
              contentLength = parsedCl;
            }
          }

          // Try extracting filename from final URL pathname if not in headers
          if (!filename && headRes.url) {
            try {
              const finalPath = new URL(headRes.url).pathname;
              const base = path.basename(finalPath);
              if (base && base.endsWith('.zip')) {
                filename = decodeURIComponent(base);
              }
            } catch {}
          }
        }
      } catch {
        // HEAD failed or timed out; will fallback to GET probe
      }
    }

    // 2. If HEAD did not succeed or didn't find filename/size, probe with a minimal GET (Range: bytes=0-1024)
    if (!headSucceeded || !filename || !contentLength) {
      try {
        const getRes = await fetch(normalized, {
          method: 'GET',
          headers: {
            'User-Agent': 'Skalybr/0.1.0 (Calibre Library Inspector)',
            'Range': 'bytes=0-1024',
            ...customHeaders,
          },
          redirect: 'follow',
          signal: AbortSignal.timeout(8000),
        });

        statusCode = getRes.status;

        // Check if redirected to Google or Microsoft sign-in (private file)
        if (getRes.url && (getRes.url.includes('accounts.google.com') || getRes.url.includes('login.live.com') || getRes.url.includes('Authenticate.aspx'))) {
          if (getRes.body) await getRes.body.cancel();
          return NextResponse.json({
            success: false,
            reachable: false,
            statusCode: 401,
            error: 'Access denied: Sign-in required. This file is private. Please set link sharing to "Anyone with the link".',
          });
        }

        if (getRes.status === 401 || getRes.status === 403) {
          if (getRes.body) await getRes.body.cancel();
          return NextResponse.json({
            success: false,
            reachable: false,
            statusCode: getRes.status,
            error: `Access denied (HTTP ${getRes.status}). If using Google Drive, OneDrive, or Dropbox, ensure file sharing is set to "Anyone with the link".`,
          });
        }

        if (getRes.status === 404) {
          if (getRes.body) await getRes.body.cancel();
          return NextResponse.json({
            success: false,
            reachable: false,
            statusCode: 404,
            error: 'File not found (HTTP 404). Please verify the link.',
          });
        }

        if (getRes.ok) {
          if (!filename) {
            filename = parseContentDisposition(getRes.headers.get('content-disposition'));
          }
          if (!contentType) {
            contentType = getRes.headers.get('content-type');
          }

          // Check Content-Range (e.g. "bytes 0-1024/4567890")
          const cr = getRes.headers.get('content-range');
          if (cr) {
            const matchTotal = cr.match(/\/(\d+)$/);
            if (matchTotal && matchTotal[1]) {
              contentLength = parseInt(matchTotal[1], 10);
            }
          } else if (!contentLength) {
            const cl = getRes.headers.get('content-length');
            if (cl) {
              const parsedCl = parseInt(cl, 10);
              // Only use content-length if it's not a 206 partial response (which would be 1025)
              if (!isNaN(parsedCl) && getRes.status !== 206) {
                contentLength = parsedCl;
              }
            }
          }

          // Filename from final URL
          if (!filename && getRes.url) {
            try {
              const finalPath = new URL(getRes.url).pathname;
              const base = path.basename(finalPath);
              if (base && base.endsWith('.zip')) {
                filename = decodeURIComponent(base);
              }
            } catch {}
          }
        }

        // Cancel body stream immediately so no data is transferred
        if (getRes.body) {
          await getRes.body.cancel();
        }
      } catch (getErr: any) {
        if (!headSucceeded) {
          return NextResponse.json({
            success: false,
            reachable: false,
            error: `Failed to reach server: ${getErr.message || 'Connection timeout'}`,
          });
        }
      }
    }

    // 3. Special handling for Google Drive view URLs if filename is still unknown
    if (!filename && rawUrl.includes('drive.google.com')) {
      const match = rawUrl.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        try {
          const viewUrl = `https://drive.google.com/file/d/${match[1]}/view`;
          const viewRes = await fetch(viewUrl, {
            headers: { 'User-Agent': 'Skalybr/0.1.0' },
            redirect: 'follow',
            signal: AbortSignal.timeout(5000),
          });
          if (viewRes.ok) {
            const html = await viewRes.text();
            const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/);
            if (ogTitle && ogTitle[1] && ogTitle[1] !== 'Google Drive') {
              filename = ogTitle[1];
            } else {
              const titleMatch = html.match(/<title>([^<]+) - Google Drive<\/title>/);
              if (titleMatch && titleMatch[1]) {
                filename = titleMatch[1];
              }
            }
          }
        } catch {}
      }
    }

    // Fallback filename from rawUrl
    if (!filename) {
      try {
        const lastSeg = parsed.pathname.split('/').filter(Boolean).pop();
        if (lastSeg && lastSeg.endsWith('.zip')) {
          filename = decodeURIComponent(lastSeg);
        }
      } catch {}
    }

    // Generate suggested folder name and display title
    let suggestedName: string | null = null;
    let suggestedDisplayName: string | null = null;

    if (filename) {
      const baseName = filename.replace(/\.zip$/i, '').trim();
      if (baseName) {
        suggestedName = baseName.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase();
        // Capitalize words for display title
        suggestedDisplayName = baseName
          .replace(/[_-]+/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase())
          .trim();
      }
    }

    const isOverLimit = contentLength ? contentLength > MAX_UPLOAD_SIZE : false;
    const sizeFormatted = contentLength ? formatBytes(contentLength) : null;

    return NextResponse.json({
      success: true,
      reachable: true,
      statusCode,
      filename,
      contentLength,
      sizeFormatted,
      suggestedName,
      suggestedDisplayName,
      isOverLimit,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, reachable: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
