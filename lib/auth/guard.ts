import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/server';
import { canAccessLibrary, getEffectiveRole } from '@/lib/auth/acl';
import type { AclRole, UserRecord } from '@/lib/types';

export type LibraryGuardResult =
  | {
      authorized: true;
      response?: undefined;
      user: UserRecord | null;
      role: AclRole;
    }
  | {
      authorized: false;
      response: NextResponse;
      user: UserRecord | null;
      role: AclRole;
    };

export type AdminGuardResult =
  | {
      authorized: true;
      response?: undefined;
      user: UserRecord;
    }
  | {
      authorized: false;
      response: NextResponse;
      user: UserRecord | null;
    };

export type AuthGuardResult =
  | {
      authorized: true;
      response?: undefined;
      user: UserRecord;
    }
  | {
      authorized: false;
      response: NextResponse;
      user: null;
    };

/**
 * Enforces library access permissions for API routes.
 * Resolves current user and checks whether user's cascading ACL role
 * satisfies minRole on the specified library.
 *
 * - Returns 401 if unauthenticated.
 * - Returns 403 if authenticated but insufficient role.
 */
export async function requireLibraryAccess(
  req: NextRequest,
  libraryName: string,
  minRole: AclRole = 'reader'
): Promise<LibraryGuardResult> {
  let decodedLibrary = libraryName;
  try {
    decodedLibrary = decodeURIComponent(libraryName);
  } catch {
    // Keep raw name if malformed URI sequence
  }

  const { user } = await getCurrentUser(req);
  let role = getEffectiveRole(user, 'library', decodedLibrary);
  let authorized = canAccessLibrary(user, decodedLibrary, minRole);

  if (!authorized && decodedLibrary !== libraryName) {
    const rawRole = getEffectiveRole(user, 'library', libraryName);
    const rawAuthorized = canAccessLibrary(user, libraryName, minRole);
    if (rawAuthorized) {
      role = rawRole;
      authorized = true;
    }
  }

  if (!authorized) {
    if (!user) {
      return {
        authorized: false,
        response: NextResponse.json(
          { success: false, error: 'Authentication required' },
          { status: 401 }
        ),
        user: null,
        role,
      };
    }

    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'Forbidden: Insufficient permissions for this library' },
        { status: 403 }
      ),
      user,
      role,
    };
  }

  return {
    authorized: true,
    user,
    role,
  };
}

/**
 * Enforces administrator privileges for API routes.
 *
 * - Returns 401 if unauthenticated.
 * - Returns 403 if authenticated but not an admin.
 */
export async function requireAdmin(req: NextRequest): Promise<AdminGuardResult> {
  const { user } = await getCurrentUser(req);

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
      user: null,
    };
  }

  if (!user.isAdmin) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'Administrator access required' },
        { status: 403 }
      ),
      user,
    };
  }

  return {
    authorized: true,
    user,
  };
}

/**
 * Enforces active authenticated user (non-guest).
 *
 * - Returns 401 if unauthenticated or inactive.
 */
export async function requireAuth(req: NextRequest): Promise<AuthGuardResult> {
  const { user } = await getCurrentUser(req);

  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      ),
      user: null,
    };
  }

  return {
    authorized: true,
    user,
  };
}
