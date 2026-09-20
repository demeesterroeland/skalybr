import type { SessionOptions } from 'iron-session';
import crypto from 'crypto';
import { getAppSetting, setAppSetting } from '@/lib/db/skalybr-db';

export interface SessionData {
  authenticated: boolean;
  userId: number;
  username: string;
  displayName?: string;
  isAdmin: boolean;
  epoch: number;
}

const SETTING_KEY_SESSION_SECRET = 'session_secret';

let cachedSecret: string | null = null;

export function getSessionSecret(): string {
  const envSecret = process.env.SESSION_SECRET;
  if (envSecret && envSecret.length >= 32) {
    return envSecret;
  }

  if (cachedSecret && cachedSecret.length >= 32) {
    return cachedSecret;
  }

  try {
    const dbSecret = getAppSetting(SETTING_KEY_SESSION_SECRET);
    if (dbSecret && dbSecret.length >= 32) {
      cachedSecret = dbSecret;
      return dbSecret;
    }

    const generated = crypto.randomBytes(32).toString('hex');
    setAppSetting(SETTING_KEY_SESSION_SECRET, generated);
    cachedSecret = generated;
    return generated;
  } catch {
    return 'skalybr_local_development_secret_must_be_at_least_32_characters_long!';
  }
}

export function clearCachedSessionSecret(): void {
  cachedSecret = null;
}

export function getSessionOptions(): SessionOptions {
  return {
    cookieName: 'skalybr_session',
    password: getSessionSecret(),
    ttl: 7 * 24 * 60 * 60,
    cookieOptions: {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
      secure: process.env.NODE_ENV === 'production',
    },
  };
}

export const sessionOptions: SessionOptions = {
  cookieName: 'skalybr_session',
  get password() {
    return getSessionSecret();
  },
  ttl: 7 * 24 * 60 * 60,
  cookieOptions: {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60,
    secure: process.env.NODE_ENV === 'production',
  },
};
