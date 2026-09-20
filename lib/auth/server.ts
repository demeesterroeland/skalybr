import { getIronSession, webCookies, type CookieJar, type IronSession } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionOptions, type SessionData } from './session';
import { getUserById } from '@/lib/db/skalybr-db';
import type { UserRecord, SafeUserRecord } from '@/lib/types';

export function toSafeUser(user: UserRecord): SafeUserRecord;
export function toSafeUser(user: null | undefined): null;
export function toSafeUser(user: UserRecord | null | undefined): SafeUserRecord | null;
export function toSafeUser(user: UserRecord | null | undefined): SafeUserRecord | null {
  if (!user) return null;
  const { passwordHash: _removed, ...safe } = user;
  return safe;
}

/**
 * Retrieves the iron-session instance from the given request, cookie jar, headers,
 * or the active Next.js request context (via cookies()).
 */
export async function getSession(
  req?: Request | Headers | any,
  res?: Response | Headers | any
): Promise<IronSession<SessionData>> {
  if (!req) {
    try {
      const cookieStore = await cookies();
      if (typeof (cookieStore as any)?.set === 'function') {
        return await getIronSession<SessionData>(cookieStore, sessionOptions);
      } else {
        const jar: CookieJar = {
          read: (name: string) => cookieStore.get(name)?.value,
          names: () => (typeof (cookieStore as any)?.getAll === 'function' ? (cookieStore as any).getAll().map((c: any) => c.name) : []),
          write: () => {},
        };
        return await getIronSession<SessionData>(jar, sessionOptions);
      }
    } catch {
      // In non-request context (e.g. tests or build time), fallback to empty session
      const emptyJar: CookieJar = {
        read: () => undefined,
        write: () => {},
      };
      return await getIronSession<SessionData>(emptyJar, sessionOptions);
    }
  }

  // 1. Headers object (must be checked before CookieStore because Headers has .get)
  if (req instanceof Headers || (typeof req === 'object' && typeof req.get === 'function' && typeof req.append === 'function')) {
    const dummyReq = new Request('http://localhost', { headers: req });
    const outHeaders = res instanceof Headers ? res : (res?.headers instanceof Headers ? res.headers : new Headers());
    return await getIronSession<SessionData>(webCookies(dummyReq, outHeaders), sessionOptions);
  }

  // 2. Web Request or NextRequest
  if (req instanceof Request || ('headers' in req && typeof req.headers?.get === 'function')) {
    const out = res || new Headers();
    return await getIronSession<SessionData>(req, out, sessionOptions);
  }

  // 3. Next.js cookies() or ReadonlyRequestCookies object
  if (typeof req === 'object' && typeof req.get === 'function') {
    if (typeof req.set === 'function') {
      return await getIronSession<SessionData>(req, sessionOptions);
    } else {
      const jar: CookieJar = {
        read: (name: string) => req.get(name)?.value,
        names: () => (typeof req.getAll === 'function' ? req.getAll().map((c: any) => c.name) : []),
        write: () => {},
      };
      return await getIronSession<SessionData>(jar, sessionOptions);
    }
  }

  return await getIronSession<SessionData>(req, res || new Headers(), sessionOptions);
}

/**
 * Returns the currently authenticated UserRecord and SessionData.
 * Validates that user exists in skalybr.db, user.status === 'active',
 * and session.epoch === user.sessionEpoch.
 * If epoch is mismatched or user is suspended/pending, the session is destroyed
 * and treated as unauthenticated ({ user: null, session: null }).
 */
export async function getCurrentUser(
  req?: Request | Headers | any,
  res?: Response | Headers | any
): Promise<{ user: UserRecord | null; session: SessionData | null }> {
  const session = await getSession(req, res);

  if (!session || !session.authenticated || !session.userId) {
    return { user: null, session: null };
  }

  const user = getUserById(session.userId);
  if (!user || user.status !== 'active' || user.sessionEpoch !== session.epoch) {
    try {
      session.destroy();
    } catch {
      // Ignore write errors in read-only cookie contexts
    }
    return { user: null, session: null };
  }

  return {
    user,
    session: session as SessionData,
  };
}
