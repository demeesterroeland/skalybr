import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import {
  getUserById,
  listAccessGrantsForUser,
  setAccessGrant,
  deleteAccessGrant,
} from '@/lib/db/skalybr-db';
import type { AclRole, ResourceType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_RESOURCE_TYPES: ResourceType[] = ['global', 'library', 'shelf'];
const VALID_ROLES: AclRole[] = ['admin', 'curator', 'reader', 'none'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.authorized) {
      return guard.response!;
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const targetUser = getUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const grants = listAccessGrantsForUser(userId);

    return NextResponse.json({
      success: true,
      data: grants,
    });
  } catch (error: any) {
    console.error('Error in GET /api/v1/admin/users/[id]/grants:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.authorized) {
      return guard.response!;
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const targetUser = getUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { resourceType, resourceId, role } = body;

    if (!resourceType || !VALID_RESOURCE_TYPES.includes(resourceType)) {
      return NextResponse.json(
        { success: false, error: `Invalid resourceType. Allowed values: ${VALID_RESOURCE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    if (!role || !VALID_ROLES.includes(role)) {
      return NextResponse.json(
        { success: false, error: `Invalid role. Allowed values: ${VALID_ROLES.join(', ')}` },
        { status: 400 }
      );
    }

    let targetResourceId = typeof resourceId === 'string' ? resourceId.trim() : '';
    if (resourceType === 'global') {
      targetResourceId = '*';
    } else if (!targetResourceId) {
      return NextResponse.json(
        { success: false, error: 'resourceId is required and cannot be empty for library and shelf grants' },
        { status: 400 }
      );
    }

    const grant = setAccessGrant({
      userId,
      resourceType,
      resourceId: targetResourceId,
      role,
      grantedBy: guard.user.id,
    });

    return NextResponse.json({
      success: true,
      data: grant,
    });
  } catch (error: any) {
    console.error('Error in POST /api/v1/admin/users/[id]/grants:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.authorized) {
      return guard.response!;
    }

    const { id } = await params;
    const userId = parseInt(id, 10);
    if (isNaN(userId) || userId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }

    const targetUser = getUserById(userId);
    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    let resourceType = searchParams.get('resourceType') as ResourceType | null;
    let resourceId = searchParams.get('resourceId');

    if (!resourceType || !resourceId) {
      const body = await req.json().catch(() => ({}));
      resourceType = resourceType || body.resourceType;
      resourceId = resourceId || body.resourceId;
    }

    if (!resourceType || !VALID_RESOURCE_TYPES.includes(resourceType)) {
      return NextResponse.json(
        { success: false, error: `Invalid or missing resourceType. Allowed values: ${VALID_RESOURCE_TYPES.join(', ')}` },
        { status: 400 }
      );
    }

    let targetResourceId = typeof resourceId === 'string' ? resourceId.trim() : '';
    if (resourceType === 'global') {
      targetResourceId = '*';
    } else if (!targetResourceId) {
      return NextResponse.json(
        { success: false, error: 'resourceId is required and cannot be empty for library and shelf grants' },
        { status: 400 }
      );
    }

    const deleted = deleteAccessGrant(userId, resourceType, targetResourceId);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Access grant not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Access grant deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/v1/admin/users/[id]/grants:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
