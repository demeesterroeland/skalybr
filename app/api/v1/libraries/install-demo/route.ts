import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { DEFAULT_CALIBRE_BASE_DIR } from '@/lib/config';
import { requireAdmin } from '@/lib/auth/guard';
import { countUsers } from '@/lib/db/skalybr-db';

export async function POST(req: NextRequest) {
  try {
    if (countUsers() === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'System uninitialized. Please create an administrator account before installing the demo library.',
        },
        { status: 403 }
      );
    }

    const guard = await requireAdmin(req);
    if (!guard.authorized) {
      return guard.response!;
    }
    // Support both small (default) and large demo libraries
    const primarySrc = path.join(process.cwd(), 'demo', 'small');
    const fallbackSrc = path.join(process.cwd(), 'demo-library', 'demo');
    const srcDir = fs.existsSync(primarySrc) ? primarySrc : fallbackSrc;
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
