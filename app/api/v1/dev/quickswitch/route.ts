import { NextRequest, NextResponse } from 'next/server';
import { getIronSession } from 'iron-session';
import { sessionOptions, type SessionData } from '@/lib/auth/session';
import { toSafeUser } from '@/lib/auth/server';
import {
  getUserByUsername,
  createUser,
  updateUser,
  setAccessGrant,
} from '@/lib/db/skalybr-db';
import { hashPassword } from '@/lib/auth/password';
import type { AclRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface PersonaConfig {
  username: string;
  email: string;
  displayName: string;
  isAdmin: boolean;
  globalRole?: AclRole;
}

const PERSONAS: Record<'admin' | 'curator' | 'reader', PersonaConfig> = {
  admin: {
    username: 'dev_admin',
    email: 'admin@skalybr.dev',
    displayName: 'Admin (Root)',
    isAdmin: true,
  },
  curator: {
    username: 'dev_curator',
    email: 'curator@skalybr.dev',
    displayName: 'Curator (Editor)',
    isAdmin: false,
    globalRole: 'curator',
  },
  reader: {
    username: 'dev_reader',
    email: 'reader@skalybr.dev',
    displayName: 'Reader (Consumer)',
    isAdmin: false,
    globalRole: 'reader',
  },
};

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'QuickSwitch is only available in development mode' },
      { status: 403 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const persona = body.persona;

    if (!persona || !['guest', 'admin', 'curator', 'reader'].includes(persona)) {
      return NextResponse.json(
        { error: 'Invalid persona. Allowed: guest, admin, curator, reader' },
        { status: 400 }
      );
    }

    if (persona === 'guest') {
      const res = NextResponse.json({
        success: true,
        persona: 'guest',
        user: null,
      });
      const session = await getIronSession<SessionData>(req, res, sessionOptions);
      session.destroy();
      return res;
    }

    const config = PERSONAS[persona as 'admin' | 'curator' | 'reader'];
    let user = getUserByUsername(config.username);

    if (!user) {
      const passwordHash = await hashPassword('DevPassword123!');
      user = createUser({
        username: config.username,
        email: config.email,
        passwordHash,
        displayName: config.displayName,
        status: 'active',
        isAdmin: config.isAdmin,
      });
    } else {
      if (user.status !== 'active' || user.isAdmin !== config.isAdmin) {
        user = updateUser(user.id, {
          status: 'active',
          isAdmin: config.isAdmin,
        });
      }
    }

    // Ensure global grant if curator or reader
    if (config.globalRole) {
      setAccessGrant({
        userId: user.id,
        resourceType: 'global',
        resourceId: '*',
        role: config.globalRole,
        grantedBy: null,
      });
    }

    const safeUser = toSafeUser(user);
    const res = NextResponse.json({
      success: true,
      persona,
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
    console.error('QuickSwitch error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to switch persona' },
      { status: 500 }
    );
  }
}
