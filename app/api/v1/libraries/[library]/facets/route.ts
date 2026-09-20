import { NextRequest, NextResponse } from 'next/server';
import { FlatBookRepository } from '@/lib/calibre/repository';
import { requireLibraryAccess } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<any> }) {
  try {
    const { library } = await params;
    const guard = await requireLibraryAccess(req, library, 'reader');
    if (!guard.authorized) {
      return guard.response!;
    }

    const { searchParams } = new URL(req.url);
    
    const repo = new FlatBookRepository(library);
    const facets = repo.getFilterFacets();

    return NextResponse.json({
      success: true,
      data: facets,
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
