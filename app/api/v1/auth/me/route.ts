import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, toSafeUser } from '@/lib/auth/server';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const res = NextResponse.json(null);
  const { user, session } = await getCurrentUser(req, res);

  if (!user || !session) {
    return NextResponse.json(
      {
        authenticated: false,
        user: null,
      },
      {
        headers: res.headers,
      }
    );
  }

  return NextResponse.json({
    authenticated: true,
    user: toSafeUser(user),
  });
}
