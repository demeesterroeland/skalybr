import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DEFAULT_CALIBRE_BASE_DIR } from '@/lib/config';

export async function POST() {
  try {
    const srcDir = path.join(process.cwd(), 'demo-library', 'demo');
    const destDir = path.join(DEFAULT_CALIBRE_BASE_DIR, 'demo');

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Copy demo library
    fs.cpSync(srcDir, destDir, { recursive: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Failed to copy demo library:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
