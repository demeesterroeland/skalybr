import { NextRequest, NextResponse } from 'next/server';
import { getReadingProgress, updateReadingProgress } from '@/lib/db/skalybr-db';
import { ReadingStatus } from '@/lib/types';
import { requireAuth, requireLibraryAccess } from '@/lib/auth/guard';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ library: string; id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authorized) {
      return auth.response!;
    }

    const { library, id } = await params;
    const libGuard = await requireLibraryAccess(req, library, 'reader');
    if (!libGuard.authorized) {
      return libGuard.response!;
    }

    const bookId = parseInt(id, 10);
    if (isNaN(bookId)) {
      return NextResponse.json({ success: false, error: 'Invalid book ID' }, { status: 400 });
    }

    const userId = auth.user!.id;
    const progress = getReadingProgress(library, bookId, userId);

    return NextResponse.json({
      success: true,
      data: progress || {
        library,
        bookId,
        userId,
        status: 'unread',
        progressPercent: 0,
        currentPage: null,
        totalPages: null,
        format: null,
        locator: null,
        timeSpentSeconds: 0,
        startedAt: null,
        finishedAt: null,
        lastReadAt: null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching reading progress:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ library: string; id: string }> }
) {
  try {
    const auth = await requireAuth(req);
    if (!auth.authorized) {
      return auth.response!;
    }

    const { library, id } = await params;
    const libGuard = await requireLibraryAccess(req, library, 'reader');
    if (!libGuard.authorized) {
      return libGuard.response!;
    }

    const bookId = parseInt(id, 10);
    if (isNaN(bookId)) {
      return NextResponse.json({ success: false, error: 'Invalid book ID' }, { status: 400 });
    }

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid JSON request body' }, { status: 400 });
    }
    const {
      status,
      progressPercent,
      currentPage,
      totalPages,
      format,
      locator,
      timeSpentSeconds,
    } = body;

    const userId = auth.user!.id;

    const updated = updateReadingProgress({
      library,
      bookId,
      userId,
      status: status as ReadingStatus | undefined,
      progressPercent: typeof progressPercent === 'number' ? progressPercent : undefined,
      currentPage: typeof currentPage === 'number' ? currentPage : undefined,
      totalPages: typeof totalPages === 'number' ? totalPages : undefined,
      format: typeof format === 'string' ? format : undefined,
      locator: typeof locator === 'string' ? locator : undefined,
      timeSpentSeconds: typeof timeSpentSeconds === 'number' ? timeSpentSeconds : undefined,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error updating reading progress:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export const POST = PATCH;

