export type Role = 'SUPERADMIN' | 'OWNER';
export type AuthenticatedUser = { id: string; email: string; name: string; role: Role };
