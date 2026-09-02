import { sql } from '../db/database.js';
import type { Role } from '../types/auth.js';
export async function getRole(authUserId: string): Promise<Role | null> {
  const rows = await sql`SELECT role FROM checkora_user_roles WHERE auth_user_id=${authUserId}`;
  const role = (rows[0] as { role: string } | undefined)?.role;
  return role === 'SUPERADMIN' || role === 'OWNER' ? role : null;
}
