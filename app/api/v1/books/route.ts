import { NextRequest, NextResponse } from 'next/server';
import { FlatBookRepository } from '@/lib/calibre/repository';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const library = searchParams.get('library') || undefined;
    const search = searchParams.get('search') || undefined;
    const author = searchParams.get('author') || undefined;
    const tag = searchParams.get('tag') || undefined;
    const series = searchParams.get('series') || undefined;
    const collection = searchParams.get('collection') || undefined;
    const format = searchParams.get('format') || undefined;
    const sort = (searchParams.get('sort') as any) || 'id';
    const order = (searchParams.get('order') as any) || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '30', 10);

    const repo = new FlatBookRepository(library);
    const result = repo.getBooks({
      search,
      author,
      tag,
      series,
      collection,
      format,
      sort,
      order,
      page,
      pageSize,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
