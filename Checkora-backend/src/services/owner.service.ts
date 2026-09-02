import { sql } from '../db/database.js';
import { createPublicToken, hashPublicToken } from '../lib/crypto.js';

export class OwnerProvisioningError extends Error {}

type ExistingRole = { role: 'SUPERADMIN' | 'OWNER' };
type ExistingLink = { id: string };
type CreatedLink = { id: string };
type OwnerProfile = { name: string; email: string };

export async function createOwnerLink(
  authUserId: string,
  frontendOrigin: string,
  owner: OwnerProfile,
) {
  const roles = await sql`
    SELECT role
    FROM checkora_user_roles
    WHERE auth_user_id = ${authUserId}
  `;
  const existingRole = (roles[0] as ExistingRole | undefined)?.role;

  if (existingRole === 'SUPERADMIN') {
    throw new OwnerProvisioningError('No puedes convertir un superadministrador en propietario.');
  }

  if (!existingRole) {
    await sql`
      INSERT INTO checkora_user_roles (auth_user_id, role, owner_name, owner_email)
      VALUES (${authUserId}, 'OWNER', ${owner.name}, ${owner.email})
    `;
  } else {
    await sql`
      UPDATE checkora_user_roles
      SET owner_name = ${owner.name}, owner_email = ${owner.email}
      WHERE auth_user_id = ${authUserId}
    `;
  }

  const existingLinks = await sql`
    SELECT id
    FROM checkin_links
    WHERE owner_auth_user_id = ${authUserId}
  `;

  if (existingLinks[0] as ExistingLink | undefined) {
    throw new OwnerProvisioningError('Este propietario ya tiene un enlace de registro.');
  }

  const token = createPublicToken();
  const createdLinks = await sql`
    INSERT INTO checkin_links (owner_auth_user_id, token_hash)
    VALUES (${authUserId}, ${hashPublicToken(token)})
    RETURNING id
  `;
  const link = createdLinks[0] as CreatedLink | undefined;

  if (!link) {
    throw new OwnerProvisioningError('No se ha podido crear el enlace del propietario.');
  }

  return { checkinUrl: `${frontendOrigin}/checkin/${link.id}` };
}
