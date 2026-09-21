import { NextRequest, NextResponse } from 'next/server';
import { importFromCalibreWeb } from '@/lib/db/calibre-web-importer';
import { getDefaultLibraryName } from '@/lib/config';
import path from 'path';
import fs from 'fs';
import { requireAdmin } from '@/lib/auth/guard';
import { countUsers } from '@/lib/db/skalybr-db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    if (countUsers() === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'System uninitialized. Please create an administrator account first.',
        },
        { status: 403 }
      );
    }

    const guard = await requireAdmin(req);
    if (!guard.authorized) {
      return guard.response!;
    }
    const body = await req.json().catch(() => ({}));
    let { appDbPath, targetLibrary } = body;

    // Default target library if unspecified
    if (!targetLibrary) {
      targetLibrary = getDefaultLibraryName();
    }

    // Default path check: if appDbPath not given, check ./data/app.db
    if (!appDbPath) {
      const defaultCandidate = path.join(process.cwd(), 'data', 'app.db');
      if (fs.existsSync(defaultCandidate)) {
        appDbPath = defaultCandidate;
      }
    }

    if (!appDbPath) {
      return NextResponse.json(
        {
          success: false,
          error: 'No appDbPath provided and ./data/app.db does not exist.',
        },
        { status: 400 }
      );
    }

    const summary = importFromCalibreWeb(appDbPath, targetLibrary);

    if (!summary.success) {
      return NextResponse.json(
        { success: false, error: summary.message },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    console.error('Error importing from Calibre-Web:', error);
    return NextResponse.json(
      { success: false, error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
