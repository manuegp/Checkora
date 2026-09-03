import { env } from '../config/env.js';
import { sql } from '../db/database.js';
import type { AuthenticatedUser } from '../types/auth.js';

type SubmissionRow = {
  id: string;
  owner_name: string | null;
  owner_email: string | null;
  email: string;
  first_name: string;
  first_surname: string;
  second_surname: string | null;
  gender: string | null;
  document_type: string | null;
  document_number: string | null;
  document_support_number: string | null;
  nationality: string | null;
  birth_date: string | null;
  mobile_phone: string | null;
  habitual_residence: string | null;
  address: string | null;
  postal_code: string | null;
  municipality: string | null;
  signature_url: string | null;
  privacy_accepted_at: string;
  submitted_at: string;
};

type OwnerDashboardRow = {
  auth_user_id: string;
  owner_name: string | null;
  owner_email: string | null;
  checkin_link_id: string | null;
  submissions: number;
};

function mapSubmission(row: SubmissionRow) {
  return {
    id: row.id,
    owner_name: row.owner_name,
    owner_email: row.owner_email,
    email: row.email,
    first_name: row.first_name,
    first_surname: row.first_surname,
    second_surname: row.second_surname,
    gender: row.gender,
    document_type: row.document_type,
    document_number: row.document_number,
    document_support_number: row.document_support_number,
    nationality: row.nationality,
    birth_date: row.birth_date,
    mobile_phone: row.mobile_phone,
    habitual_residence: row.habitual_residence,
    address: row.address,
    postal_code: row.postal_code,
    municipality: row.municipality,
    signature_url: row.signature_url,
    privacy_accepted_at: row.privacy_accepted_at,
    submitted_at: row.submitted_at,
  };
}

const submissionColumns = sql`
  s.id,
  r.owner_name,
  r.owner_email,
  s.email,
  s.first_name,
  s.first_surname,
  s.second_surname,
  s.gender,
  s.document_type,
  s.document_number,
  s.document_support_number,
  s.nationality,
  s.birth_date,
  s.mobile_phone,
  s.habitual_residence,
  s.address,
  s.postal_code,
  s.municipality,
  s.signature_url,
  s.privacy_accepted_at,
  s.submitted_at
`;

export async function getDashboard(user: AuthenticatedUser) {
  if (user.role === 'SUPERADMIN') {
    const [owners, submissions] = await Promise.all([
      sql`
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
      ` as unknown as Promise<OwnerDashboardRow[]>,
      sql`
        SELECT ${submissionColumns}
        FROM guest_submissions s
        JOIN checkin_links l ON l.id = s.checkin_link_id
        JOIN checkora_user_roles r ON r.auth_user_id = l.owner_auth_user_id
        ORDER BY s.submitted_at DESC
      ` as unknown as Promise<SubmissionRow[]>,
    ]);

    return {
      role: user.role,
      owners: owners.map((owner) => ({
        auth_user_id: owner.auth_user_id,
        name: owner.owner_name,
        email: owner.owner_email,
        submissions: owner.submissions,
        checkin_url: owner.checkin_link_id
          ? `${env.FRONTEND_ORIGIN}/checkin/${owner.checkin_link_id}`
          : null,
      })),
      submissions: submissions.map(mapSubmission),
    };
  }

  const [linkRows, submissions] = await Promise.all([
    sql`
      SELECT id AS checkin_link_id
      FROM checkin_links
      WHERE owner_auth_user_id = ${user.id}
        AND active = true
      LIMIT 1
    `,
    sql`
      SELECT ${submissionColumns}
      FROM guest_submissions s
      JOIN checkin_links l ON l.id = s.checkin_link_id
      JOIN checkora_user_roles r ON r.auth_user_id = l.owner_auth_user_id
      WHERE l.owner_auth_user_id = ${user.id}
      ORDER BY s.submitted_at DESC
    ` as unknown as SubmissionRow[],
  ]);

  const checkinLinkId = (linkRows[0] as {checkin_link_id: string} | undefined)?.checkin_link_id;

  return {
    role: user.role,
    checkin_url: checkinLinkId ? `${env.FRONTEND_ORIGIN}/checkin/${checkinLinkId}` : null,
    submissions: submissions.map(mapSubmission),
  };
}
