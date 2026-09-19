import { NextRequest, NextResponse } from 'next/server';
import { FlatBookRepository } from '@/lib/calibre/repository';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const library = searchParams.get('library') || undefined;

    const repo = new FlatBookRepository(library);
    const facets = repo.getFilterFacets();

    return NextResponse.json({
      success: true,
      data: facets,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
