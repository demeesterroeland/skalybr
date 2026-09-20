import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import {
  getUserById,
  updateUser,
  deleteUser,
  incrementSessionEpoch,
  listAccessGrantsForUser,
  setAccessGrant,
} from '@/lib/db/skalybr-db';
import { toSafeUser } from '@/lib/auth/server';
import type { UserStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function PATCH(
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

    const existing = getUserById(userId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const { status, isAdmin, displayName, revokeSessions } = body;

    // Prevent self-lockout
    if (guard.user.id === userId) {
      if (status !== undefined && status !== 'active') {
        return NextResponse.json(
          { success: false, error: 'Cannot suspend or deactivate your own administrator account' },
          { status: 400 }
        );
      }
      if (isAdmin === false) {
        return NextResponse.json(
          { success: false, error: 'Cannot revoke your own administrator privileges' },
          { status: 400 }
        );
      }
    }

    // Support manual session revocation
    if (revokeSessions === true) {
      incrementSessionEpoch(userId);
    }

    const updates: {
      status?: UserStatus;
      isAdmin?: boolean;
      displayName?: string | null;
    } = {};

    if (status !== undefined) {
      if (!['pending', 'active', 'suspended'].includes(status)) {
        return NextResponse.json(
          { success: false, error: 'Invalid status. Allowed values: pending, active, suspended' },
          { status: 400 }
        );
      }
      updates.status = status;
      // Invalidate existing sessions if status is changed to suspended/pending
      if (status !== 'active') {
        incrementSessionEpoch(userId);
      }
    }

    if (isAdmin !== undefined) {
      if (typeof isAdmin !== 'boolean') {
        return NextResponse.json(
          { success: false, error: 'isAdmin must be a boolean' },
          { status: 400 }
        );
      }
      updates.isAdmin = isAdmin;
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

    const updated = updateUser(userId, updates);

    // On user activation from pending, automatically seed baseline global reader grant if user has none
    if (updates.status === 'active' && existing.status !== 'active') {
      const existingGrants = listAccessGrantsForUser(userId);
      if (existingGrants.length === 0) {
        setAccessGrant({
          userId,
          resourceType: 'global',
          resourceId: '*',
          role: 'reader',
          grantedBy: guard.user.id,
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: toSafeUser(updated),
    });
  } catch (error: any) {
    console.error('Error in PATCH /api/v1/admin/users/[id]:', error);
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

    if (guard.user.id === userId) {
      return NextResponse.json(
        { success: false, error: 'Cannot delete yourself' },
        { status: 400 }
      );
    }

    const existing = getUserById(userId);
    if (!existing) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const deleted = deleteUser(userId);
    if (!deleted) {
      return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    console.error('Error in DELETE /api/v1/admin/users/[id]:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
