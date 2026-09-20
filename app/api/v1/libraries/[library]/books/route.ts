import { NextRequest, NextResponse } from 'next/server';
import { FlatBookRepository } from '@/lib/calibre/repository';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, { params }: { params: Promise<any> }) {
  try {
    const { library } = await params;
    const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || undefined;
    const authors = searchParams.get('authors')
      ? searchParams.get('authors')!.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const author = searchParams.get('author') || undefined;

    const tags = searchParams.get('tags')
      ? searchParams.get('tags')!.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const tag = searchParams.get('tag') || undefined;

    const seriesList = searchParams.get('seriesList')
      ? searchParams.get('seriesList')!.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const series = searchParams.get('series') || undefined;

    const collections = searchParams.get('collections')
      ? searchParams.get('collections')!.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const collection = searchParams.get('collection') || undefined;

    const publishers = searchParams.get('publishers')
      ? searchParams.get('publishers')!.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const publisher = searchParams.get('publisher') || undefined;

    const languages = searchParams.get('languages')
      ? searchParams.get('languages')!.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const language = searchParams.get('language') || undefined;

    const formats = searchParams.get('formats')
      ? searchParams.get('formats')!.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    const format = searchParams.get('format') || undefined;

    const ratings = searchParams.get('ratings')
      ? searchParams.get('ratings')!.split(',').map((s) => parseFloat(s)).filter((n) => !isNaN(n))
      : undefined;
    const rating = searchParams.get('rating') ? parseFloat(searchParams.get('rating')!) : undefined;

    const hasCoverParam = searchParams.get('hasCover');
    const hasCover =
      hasCoverParam === 'true' || hasCoverParam === '1'
        ? true
        : hasCoverParam === 'false' || hasCoverParam === '0'
        ? false
        : undefined;

    const sort = (searchParams.get('sort') as any) || 'id';
    const order = (searchParams.get('order') as any) || 'desc';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '30', 10);

    const repo = new FlatBookRepository(library);
    const result = repo.getBooks({
      search,
      author,
      authors,
      tag,
      tags,
      series,
      seriesList,
      collection,
      collections,
      publisher,
      publishers,
      language,
      languages,
      format,
      formats,
      rating,
      ratings,
      hasCover,
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
    console.error(error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
