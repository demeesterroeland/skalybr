import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const PALETTES: Record<string, { start: string; end: string }> = {
  Technology: { start: '#1e3a8a', end: '#0f172a' },
  Philosophy: { start: '#4c1d95', end: '#1e1b4b' },
  'Art & Aesthetics': { start: '#831843', end: '#3b0764' },
  'Self-Improvement': { start: '#065f46', end: '#064e3b' },
  Software: { start: '#0e7490', end: '#083344' },
  History: { start: '#7c2d12', end: '#451a03' },
  'Sociocracy & Governance': { start: '#0f766e', end: '#042f2e' },
  'Indigenous Religion': { start: '#92400e', end: '#451a03' },
  'Plant Medicine': { start: '#166534', end: '#052e16' },
  Nature: { start: '#15803d', end: '#14532d' },
};

export async function generateFallbackCoverBuffer(
  title: string,
  author: string = 'Unknown',
  category: string = 'CLASSIC',
  width: number = 360,
  format: 'webp' | 'jpeg' = 'webp'
): Promise<Buffer> {
  const color = PALETTES[category] || { start: '#0f766e', end: '#042f2e' };

  const escapeXml = (str: string) =>
    str.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });

  const cleanTitle = escapeXml(title);
  const cleanAuthor = escapeXml(author);
  const cleanCategory = escapeXml(category.toUpperCase());

  const words = cleanTitle.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  for (const w of words) {
    if ((currentLine + ' ' + w).length > 18) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = w;
    } else {
      currentLine += ' ' + w;
    }
  }
  if (currentLine) lines.push(currentLine.trim());

  const titleSvgText = lines
    .slice(0, 4)
    .map(
      (l, idx) =>
        `<text x="50%" y="${180 + idx * 38}" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="700" fill="#ffffff" text-anchor="middle">${l}</text>`
    )
    .join('\n');

  const svg = `
  <svg width="400" height="600" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${color.start}" />
        <stop offset="100%" stop-color="${color.end}" />
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="15%" r="65%">
        <stop offset="0%" stop-color="#ffffff" stop-opacity="0.18" />
        <stop offset="100%" stop-color="#ffffff" stop-opacity="0" />
      </radialGradient>
    </defs>
    <rect width="400" height="600" fill="url(#bgGrad)" />
    <rect width="400" height="600" fill="url(#glow)" />
    <rect x="25" y="25" width="350" height="550" fill="none" stroke="rgba(255,255,255,0.15)" stroke-width="1.5" rx="4" />
    
    <rect x="50" y="55" width="300" height="28" rx="14" fill="rgba(255,255,255,0.1)" />
    <text x="50%" y="74" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="600" letter-spacing="2.5" fill="#e2e8f0" text-anchor="middle">${cleanCategory}</text>
    
    ${titleSvgText}
    
    <line x1="130" y1="360" x2="270" y2="360" stroke="rgba(255,255,255,0.3)" stroke-width="2" />
    
    <text x="50%" y="415" font-family="system-ui, -apple-system, sans-serif" font-size="18" font-weight="500" fill="#cbd5e1" text-anchor="middle">${cleanAuthor}</text>
    
    <text x="50%" y="535" font-family="system-ui, -apple-system, sans-serif" font-size="10" font-weight="600" letter-spacing="3" fill="rgba(255,255,255,0.4)" text-anchor="middle">SKALYBR EDITION</text>
  </svg>
  `;

  return sharp(Buffer.from(svg))
    .resize({ width, withoutEnlargement: true, fit: 'inside' })
    .toFormat(format, { quality: 85 })
    .toBuffer();
}

export async function getResizedCover(
  libraryPath: string,
  bookRelativePath: string,
  width: number = 360,
  format: 'webp' | 'jpeg' = 'webp'
): Promise<Buffer | null> {
  const coverPath = path.join(libraryPath, bookRelativePath, 'cover.jpg');

  if (!fs.existsSync(coverPath)) {
    return null;
  }

  const imageBuffer = await fs.promises.readFile(coverPath);
  return sharp(imageBuffer)
    .resize({
      width,
      withoutEnlargement: true,
      fit: 'inside',
    })
    .toFormat(format, { quality: 85 })
    .toBuffer();
}
