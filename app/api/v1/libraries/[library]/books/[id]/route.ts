import { NextRequest, NextResponse } from 'next/server';
import { FlatBookRepository } from '@/lib/calibre/repository';
import { UpdateBookSchema } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ library: string, id: string }> }
) {
  try {
    const { library, id } = await params;
    const { searchParams } = new URL(req.url);
    
    const repo = new FlatBookRepository(library);
    const book = repo.getBookById(parseInt(id, 10));

    if (!book) {
      return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: book });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ library: string, id: string }> }
) {
  try {
    const { library, id } = await params;
    const { searchParams } = new URL(req.url);
        const body = await req.json();

    const parsed = UpdateBookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const repo = new FlatBookRepository(library);
    const updated = repo.updateBookMetadata(parseInt(id, 10), parsed.data);

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ library: string, id: string }> }
) {
  try {
    const { library, id } = await params;
    const { searchParams } = new URL(req.url);
    
    const repo = new FlatBookRepository(library);
    const deleted = repo.deleteBook(parseInt(id, 10));

    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Book not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Book deleted successfully' });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
