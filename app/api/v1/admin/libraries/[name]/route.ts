import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import { getLibraryByName, upsertLibraryRecord, getAllLibraries } from '@/lib/db/skalybr-db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.authorized) {
      return guard.response;
    }

    const libraries = getAllLibraries(true);
    return NextResponse.json({
      success: true,
      data: libraries,
    });
  } catch (error: any) {
    console.error('Error in GET /api/v1/admin/libraries:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.authorized) {
      return guard.response;
    }

    const { name } = await params;
    
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Library name is required' }, { status: 400 });
    }

    const libraryName = name.trim();
    const existing = getLibraryByName(libraryName);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Library not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { isPublic, displayName, isHidden } = body;

    const updates: {
      displayName?: string | null;
      isHidden?: boolean;
      isPublic?: boolean;
    } = {};

    if (isPublic !== undefined) {
      if (typeof isPublic !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'isPublic must be a boolean' },
          { status: 400 }
        );
      }
      updates.isPublic = isPublic;
    }

    if (displayName !== undefined) {
      if (displayName !== null && typeof displayName !== 'string') {
        return NextResponse.json(
          { success: false, error: 'displayName must be a string or null' },
          { status: 400 }
        );
      }
      updates.displayName = displayName ? displayName.trim() : null;
    }

    if (isHidden !== undefined) {
      if (typeof isHidden !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'isHidden must be a boolean' },
          { status: 400 }
        );
      }
      updates.isHidden = isHidden;
    }

    const updated = upsertLibraryRecord({
      name: libraryName,
      ...updates,
    });

    return NextResponse.json({
      success: true,
      data: updated,
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/v1/admin/libraries/[name]:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
