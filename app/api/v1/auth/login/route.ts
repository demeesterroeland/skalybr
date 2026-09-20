import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/auth/session';
import { verifyPassword } from '@/lib/auth/password';
import { toSafeUser } from '@/lib/auth/server';
import { getUserByUsername, getUserByEmail } from '@/lib/db/skalybr-db';

export const dynamic = 'force-dynamic';

const LoginSchema = z.object({
  username: z.string().trim().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

// A dummy bcrypt hash with work factor 12 to eliminate timing side channels when user does not exist
const DUMMY_HASH = '$2a$12$e8kGBj/3jEw3Vp96/oYpQeAkeNl5d3/U/U2tS3M94g.c1cQ8jZ3lG';

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: issue?.message || 'Validation failed' }, { status: 400 });
    }

    const { username, password } = parsed.data;
    const identifier = username.trim();

    // Resolves user by username or email
    let user = getUserByUsername(identifier);
    if (!user && identifier.includes('@')) {
      user = getUserByEmail(identifier.toLowerCase()) || getUserByEmail(identifier);
    }

    const hashToVerify = user ? user.passwordHash : DUMMY_HASH;
    const isValid = await verifyPassword(password, hashToVerify);

    if (!user || !isValid) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }

    if (user.status === 'pending') {
      return NextResponse.json(
        { error: 'Your account is pending administrator approval.' },
        { status: 403 }
      );
    }

    if (user.status === 'suspended') {
      return NextResponse.json(
        { error: 'Your account has been suspended. Please contact an administrator.' },
        { status: 403 }
      );
    }

    const safeUser = toSafeUser(user);
    const res = NextResponse.json({
      success: true,
      user: safeUser,
    });

    const session = await getIronSession<SessionData>(req, res, sessionOptions);
    session.authenticated = true;
    session.userId = user.id;
    session.username = user.username;
    session.displayName = user.displayName ?? undefined;
    session.isAdmin = user.isAdmin;
    session.epoch = user.sessionEpoch;
    await session.save();

    return res;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
