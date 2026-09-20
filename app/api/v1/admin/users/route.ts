import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/guard';
import { listUsers } from '@/lib/db/skalybr-db';
import { toSafeUser } from '@/lib/auth/server';
import type { UserStatus } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const guard = await requireAdmin(req);
    if (!guard.authorized) {
      return guard.response!;
    }

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get('status');

    let filter: { status?: UserStatus } | undefined = undefined;
    if (statusParam) {
      if (['pending', 'active', 'suspended'].includes(statusParam)) {
        filter = { status: statusParam as UserStatus };
      } else {
        return NextResponse.json(
          { success: false, error: 'Invalid status filter. Allowed values: pending, active, suspended' },
          { status: 400 }
        );
      }
    }

    const users = listUsers(filter);
    const safeUsers = users.map((u) => toSafeUser(u));

    return NextResponse.json({
      success: true,
      data: safeUsers,
    });
  } catch (error: any) {
    console.error('Error in GET /api/v1/admin/users:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
