import type { AclRole, LibraryRecord, UserRecord } from '@/lib/types';
import {
  getAccessGrant,
  getLibraryByName,
  getShelfLibrary,
  isShelfPublic,
} from '@/lib/db/skalybr-db';

export const ROLE_WEIGHTS: Record<AclRole, number> = {
  none: 0,
  reader: 1,
  curator: 2,
  admin: 3,
};

/**
 * Compares two ACL roles based on numerical weight.
 * Returns true if the actual role meets or exceeds the required role.
 */
export function hasMinimumRole(actual: AclRole, required: AclRole): boolean {
  return (ROLE_WEIGHTS[actual] ?? 0) >= (ROLE_WEIGHTS[required] ?? 0);
}

/**
 * Resolves effective cascading ACL role for a given user and resource.
 *
 * Cascading Resolution Order:
 * 1. Super Admin: user?.isAdmin always returns 'admin'.
 * 2. Shelf Grant: if resourceType === 'shelf', check explicit grant on that shelf.
 * 3. Library Grant: check explicit grant on associated library.
 * 4. Global Grant: check explicit grant with resourceType === 'global' and resourceId === '*'.
 * 5. Public Fallback:
 *    - Shelf: check if shelf is public. If so, check if associated library is readable.
 *    - Library: check if library is marked public in database.
 *    - Otherwise: 'none'.
 */
export function getEffectiveRole(
  user: UserRecord | null,
  resourceType: 'library' | 'shelf',
  resourceId: string
): AclRole {
  // If user is suspended or pending, treat as unauthenticated guest
  const activeUser = user && user.status === 'active' ? user : null;

  // 1. Super Admin always has full power everywhere
  if (activeUser?.isAdmin) {
    return 'admin';
  }

  // 2. Exact Shelf Grant (if checking a shelf)
  if (resourceType === 'shelf' && activeUser) {
    const shelfGrant = getAccessGrant(activeUser.id, 'shelf', resourceId);
    if (shelfGrant) {
      return shelfGrant.role;
    }
  }

  // 3. Exact Library Grant
  const libraryName = resourceType === 'shelf' ? getShelfLibrary(resourceId) : resourceId;
  if (libraryName && activeUser) {
    const libGrant = getAccessGrant(activeUser.id, 'library', libraryName);
    if (libGrant) {
      return libGrant.role;
    }
  }

  // 4. Global Grant ('*')
  if (activeUser) {
    const globalGrant = getAccessGrant(activeUser.id, 'global', '*');
    if (globalGrant) {
      return globalGrant.role;
    }
  }

  // 5. Public / Guest Fallback
  if (resourceType === 'shelf') {
    if (isShelfPublic(resourceId)) {
      if (libraryName) {
        if (canAccessLibrary(activeUser, libraryName, 'reader')) {
          return 'reader';
        }
        return 'none';
      }
      return 'reader';
    }
    return 'none';
  }

  if (resourceType === 'library') {
    const lib = getLibraryByName(resourceId);
    if (lib?.isPublic) {
      return 'reader';
    }
    return 'none';
  }

  return 'none';
}

/**
 * Checks if a user has at least minRole on a specific library.
 */
export function canAccessLibrary(
  user: UserRecord | null,
  libraryName: string,
  minRole: AclRole = 'reader'
): boolean {
  const role = getEffectiveRole(user, 'library', libraryName);
  return hasMinimumRole(role, minRole);
}

/**
 * Checks if a user has at least minRole on a specific shelf.
 */
export function canAccessShelf(
  user: UserRecord | null,
  shelfUuid: string,
  minRole: AclRole = 'reader'
): boolean {
  const role = getEffectiveRole(user, 'shelf', shelfUuid);
  return hasMinimumRole(role, minRole);
}

/**
 * Filters a list of libraries (LibraryRecord or LibraryInfo) to only those
 * the user has sufficient access to.
 */
export function filterAccessibleLibraries<T extends { name: string; isPublic?: boolean }>(
  user: UserRecord | null,
  libraries: T[],
  minRole: AclRole = 'reader'
): T[] {
  const activeUser = user && user.status === 'active' ? user : null;

  if (activeUser?.isAdmin) {
    return libraries;
  }

  return libraries.filter((lib) => {
    // 1. If active user has an explicit denial ('none') on this library or globally, exclude it
    if (activeUser) {
      const explicitGrant = getAccessGrant(activeUser.id, 'library', lib.name);
      if (explicitGrant?.role === 'none') {
        return false;
      }
      const globalGrant = getAccessGrant(activeUser.id, 'global', '*');
      if (globalGrant?.role === 'none' && !explicitGrant) {
        return false;
      }
    }

    const role = getEffectiveRole(activeUser, 'library', lib.name);
    if (hasMinimumRole(role, minRole)) {
      return true;
    }

    // 2. If not satisfied via role engine, but library is marked public on the object:
    // Any user (guest or active user without explicit denial) can read a public library
    if (lib.isPublic) {
      return hasMinimumRole('reader', minRole);
    }

    return false;
  });
}
