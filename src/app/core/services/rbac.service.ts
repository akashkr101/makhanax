export type UserRole = 'ADMIN' | 'CUSTOMER';

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

export function normalizeUserRole(role: string | null | undefined): UserRole {
  return role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER';
}

export function isAdminEmail(email: string | null | undefined, adminEmails: Array<string | null | undefined> = []): boolean {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  return adminEmails.some((entry) => normalizeEmail(entry) === normalizedEmail);
}

export function canAccessAdminRoute(role: UserRole | null | undefined): boolean {
  return role === 'ADMIN';
}

export function isAdminUser(
  role: UserRole | null | undefined,
  email: string | null | undefined,
  adminEmails: Array<string | null | undefined> = []
): boolean {
  return canAccessAdminRoute(role) || isAdminEmail(email, adminEmails);
}
