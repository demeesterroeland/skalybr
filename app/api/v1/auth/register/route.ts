import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/password';
import { toSafeUser } from '@/lib/auth/server';
import {
  getSkalybrDb,
  countUsers,
  createUser,
  getUserByUsername,
  getUserByEmail,
} from '@/lib/db/skalybr-db';

export const dynamic = 'force-dynamic';

const RegisterSchema = z.object({
  username: z.string().trim().min(3, 'Username must be at least 3 characters'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  email: z
    .preprocess(
      (v) => (typeof v === 'string' && !v.trim() ? undefined : (typeof v === 'string' ? v.trim() : v)),
      z.string().email('Invalid email address').optional().nullable()
    ),
  displayName: z
    .preprocess(
      (v) => (typeof v === 'string' && !v.trim() ? undefined : (typeof v === 'string' ? v.trim() : v)),
      z.string().optional().nullable()
    ),
});

export async function POST(req: NextRequest) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return NextResponse.json({ error: issue?.message || 'Validation failed' }, { status: 400 });
    }

    const { username, password, email, displayName } = parsed.data;
    const cleanEmail = email && email.trim() !== '' ? email.trim().toLowerCase() : null;

    if (getUserByUsername(username)) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
    }

    if (cleanEmail && getUserByEmail(cleanEmail)) {
      return NextResponse.json({ error: 'Email is already registered' }, { status: 409 });
    }

    // Hash password first so synchronous transaction execution is not interrupted
    const passwordHash = await hashPassword(password);

    // Atomic registration transaction: check and create user synchronously to prevent first-user race conditions
    const db = getSkalybrDb();
    const registerTx = db.transaction(() => {
      if (getUserByUsername(username)) {
        throw new Error('DUPLICATE_USERNAME');
      }
      if (cleanEmail && getUserByEmail(cleanEmail)) {
        throw new Error('DUPLICATE_EMAIL');
      }

      const isFirst = countUsers() === 0;
      const status = isFirst ? 'active' : 'pending';
      const isAdmin = isFirst;

      const created = createUser({
        username,
        email: cleanEmail,
        passwordHash,
        displayName: displayName && displayName.trim() !== '' ? displayName.trim() : null,
        status,
        isAdmin,
      });

      return { user: created, isFirstUser: isFirst };
    });

    const { user, isFirstUser } = registerTx();
    const safeUser = toSafeUser(user);

    if (isFirstUser) {
      const res = NextResponse.json(
        {
          success: true,
          message: 'First user registered and logged in as administrator.',
          user: safeUser,
        },
        { status: 201 }
      );

      const session = await getIronSession<SessionData>(req, res, sessionOptions);
      session.authenticated = true;
      session.userId = user.id;
      session.username = user.username;
      session.displayName = user.displayName ?? undefined;
      session.isAdmin = user.isAdmin;
      session.epoch = user.sessionEpoch;
      await session.save();

      return res;
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Registration successful. Your account is pending administrator approval.',
        user: safeUser,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error?.message === 'DUPLICATE_USERNAME' || error?.message?.includes('UNIQUE constraint failed: users.username')) {
      return NextResponse.json({ error: 'Username is already taken' }, { status: 409 });
    }
    if (error?.message === 'DUPLICATE_EMAIL' || error?.message?.includes('UNIQUE constraint failed: users.email')) {
      return NextResponse.json({ error: 'Email is already registered' }, { status: 409 });
    }
    console.error('Registration error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
