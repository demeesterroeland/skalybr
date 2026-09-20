import { describe, it, expect } from 'vitest';
import { normalizeCloudDownloadUrl, downloadRemoteZip } from '../../app/api/v1/libraries/route';

describe('Remote Library Download & Cloud URL Normalization', () => {
  it('should normalize Dropbox links from dl=0 to dl=1', () => {
    const raw = 'https://www.dropbox.com/s/xyz123/my-calibre-lib.zip?dl=0';
    const normalized = normalizeCloudDownloadUrl(raw);
    expect(normalized).toBe('https://www.dropbox.com/s/xyz123/my-calibre-lib.zip?dl=1');
  });

  it('should normalize Google Drive file share links to direct download link', () => {
    const raw = 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/view?usp=sharing';
    const normalized = normalizeCloudDownloadUrl(raw);
    expect(normalized).toContain('https://drive.google.com/uc?export=download&id=1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  });

  it('should preserve standard direct URLs unchanged', () => {
    const raw = 'https://example.com/books/calibre_library.zip';
    const normalized = normalizeCloudDownloadUrl(raw);
    expect(normalized).toBe(raw);
  });

  it('should normalize OneDrive short links (1drv.ms) using Microsoft Graph shares API', () => {
    const raw = 'https://1drv.ms/u/s!Alq0j_test123';
    const normalized = normalizeCloudDownloadUrl(raw);
    expect(normalized).toContain('https://api.onedrive.com/v1.0/shares/u!');
    expect(normalized).toContain('/root/content');
  });

  it('should normalize OneDrive live links to download=1', () => {
    const raw = 'https://onedrive.live.com/?cid=12345&id=67890';
    const normalized = normalizeCloudDownloadUrl(raw);
    expect(normalized).toContain('download=1');
  });

  it('should reject non-http/https protocols for SSRF prevention', async () => {
    const res = await downloadRemoteZip('file:///etc/passwd', 1000);
    expect(res.error).toBe('Only HTTP and HTTPS URLs are supported.');
  });

  it('should reject localhost and loopback addresses for SSRF prevention', async () => {
    const res = await downloadRemoteZip('http://127.0.0.1:8080/library.zip', 1000);
    expect(res.error).toBe('Invalid URL target.');

    const res2 = await downloadRemoteZip('http://localhost:3000/library.zip', 1000);
    expect(res2.error).toBe('Invalid URL target.');

    const res3 = await downloadRemoteZip('http://169.254.169.254/latest/meta-data/', 1000);
    expect(res3.error).toBe('Invalid URL target.');
  });
});

import { calculateDirectorySize, formatBytes } from '../../lib/calibre/repository';

describe('Library Disk Size Utilities', () => {
  it('should format bytes accurately', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024 * 14.5)).toBe('14.5 MB');
    expect(formatBytes(1024 * 1024 * 1024 * 2.3)).toBe('2.3 GB');
  });

  it('should calculate directory size correctly for demo library', () => {
    const size = calculateDirectorySize('./libraries/demo');
    expect(size).toBeGreaterThan(0);
    const formatted = formatBytes(size);
    expect(formatted).toMatch(/(MB|KB|GB)/);
  });
});

import { parseContentDisposition } from '../../app/api/v1/libraries/inspect-url/route';

describe('Content-Disposition Parsing', () => {
  it('should parse plain filename', () => {
    expect(parseContentDisposition('attachment; filename=library.zip')).toBe('library.zip');
  });

  it('should parse quoted filename with spaces', () => {
    expect(parseContentDisposition('attachment; filename="My Calibre Library.zip"')).toBe('My Calibre Library.zip');
  });

  it('should parse UTF-8 encoded filename', () => {
    expect(parseContentDisposition("attachment; filename*=UTF-8''Sci%20Fi%20Vault.zip")).toBe('Sci Fi Vault.zip');
  });

  it('should handle null/empty header gracefully', () => {
    expect(parseContentDisposition(null)).toBeNull();
    expect(parseContentDisposition('')).toBeNull();
  });
});
