import bcrypt from 'bcryptjs';
import { timingSafeEqual } from 'crypto';

const BCRYPT_WORK_FACTOR = 12;

/**
 * Hashes a plaintext password using bcrypt with work factor 12.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_WORK_FACTOR);
}

/**
 * Verifies a plaintext password against a stored bcrypt hash using
 * constant-time comparison to protect against timing side-channel attacks.
 */
export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!password || !passwordHash) {
    return false;
  }
  try {
    const recomputed = await bcrypt.hash(password, passwordHash);
    const maxLen = Math.max(Buffer.byteLength(recomputed), Buffer.byteLength(passwordHash));
    const a = Buffer.alloc(maxLen);
    const b = Buffer.alloc(maxLen);
    Buffer.from(recomputed).copy(a);
    Buffer.from(passwordHash).copy(b);
    const match = timingSafeEqual(a, b);
    return match && Buffer.byteLength(recomputed) === Buffer.byteLength(passwordHash);
  } catch {
    return false;
  }
}
