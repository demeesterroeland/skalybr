import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

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
