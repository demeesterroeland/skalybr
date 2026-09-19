import { NextResponse } from 'next/server';
import { FlatBookRepository } from '@/lib/calibre/repository';
import { DEFAULT_CALIBRE_BASE_DIR } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const libraries = FlatBookRepository.listAvailableLibraries(DEFAULT_CALIBRE_BASE_DIR);
    return NextResponse.json({
      success: true,
      data: libraries,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
