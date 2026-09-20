import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, toSafeUser } from '@/lib/auth/server';
import { countUsers, getAccessGrant } from '@/lib/db/skalybr-db';
import { getEffectiveRole } from '@/lib/auth/acl';
import type { AclRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const res = NextResponse.json(null);
  const { user, session } = await getCurrentUser(req, res);

  if (!user || !session) {
    const userCount = countUsers();
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
        isBootstrap: userCount === 0,
      },
      {
        headers: res.headers,
      }
    );
  }

  const libraryParam = req.nextUrl.searchParams.get('library');
  let effectiveRole: AclRole = 'reader';
  if (user.isAdmin) {
    effectiveRole = 'admin';
  } else if (libraryParam) {
    effectiveRole = getEffectiveRole(user, 'library', libraryParam);
  } else {
    const globalGrant = getAccessGrant(user.id, 'global', '*');
    effectiveRole = globalGrant?.role || 'reader';
  }

  return NextResponse.json(
    {
      authenticated: true,
      user: toSafeUser(user),
      role: effectiveRole,
      isBootstrap: false,
    },
    {
      headers: res.headers,
    }
  );
}
