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
