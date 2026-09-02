import { env } from '../config/env.js';
import { sql } from '../db/database.js';
import type { AuthenticatedUser } from '../types/auth.js';

type OwnerDashboardRow = {
  auth_user_id: string;
  owner_name: string | null;
  owner_email: string | null;
  checkin_link_id: string | null;
  submissions: number;
};

export async function getDashboard(user: AuthenticatedUser) {
  if (user.role === 'SUPERADMIN') {
    const rows = (await sql`
      SELECT
        r.auth_user_id,
        r.owner_name,
        r.owner_email,
        l.id AS checkin_link_id,
        COUNT(s.id)::int AS submissions
      FROM checkora_user_roles r
      LEFT JOIN checkin_links l ON l.owner_auth_user_id = r.auth_user_id
      LEFT JOIN guest_submissions s ON s.checkin_link_id = l.id
      WHERE r.role = 'OWNER'
      GROUP BY r.auth_user_id, r.owner_name, r.owner_email, l.id
      ORDER BY r.owner_name NULLS LAST, r.owner_email NULLS LAST
    `) as OwnerDashboardRow[];

    return {
      role: user.role,
      owners: rows.map((owner) => ({
        auth_user_id: owner.auth_user_id,
        name: owner.owner_name,
        email: owner.owner_email,
        submissions: owner.submissions,
        checkin_url: owner.checkin_link_id
          ? `${env.FRONTEND_ORIGIN}/checkin/${owner.checkin_link_id}`
          : null,
      })),
    };
  }

  const submissions = await sql`
    SELECT s.id, s.email, s.first_name, s.first_surname, s.submitted_at
    FROM guest_submissions s
    JOIN checkin_links l ON l.id = s.checkin_link_id
    WHERE l.owner_auth_user_id = ${user.id}
    ORDER BY s.submitted_at DESC
  `;

  return { role: user.role, submissions };
}
