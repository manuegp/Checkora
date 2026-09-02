import { Router } from 'express';
import { z } from 'zod';
import { sql } from '../db/database.js';
import { hashPublicToken } from '../lib/crypto.js';

export const checkinRouter = Router();

const body = z.object({
  email: z.email(),
  firstName: z.string().trim().min(1),
  firstSurname: z.string().trim().min(1),
});

type ActiveLink = { id: string };

async function findActiveLink(reference: string): Promise<ActiveLink | null> {
  const links = await sql`
    SELECT id
    FROM checkin_links
    WHERE active = true
      AND (id::text = ${reference} OR token_hash = ${hashPublicToken(reference)})
    LIMIT 1
  `;

  return (links[0] as ActiveLink | undefined) ?? null;
}

checkinRouter.get('/:reference', async (req, res) => {
  const link = await findActiveLink(req.params.reference);

  return link ? res.json({ active: true }) : res.status(404).json({ error: 'Enlace no válido.' });
});

checkinRouter.post('/:reference/submissions', async (req, res) => {
  const parsed = body.safeParse(req.body);

  if (!parsed.success) {
    return res.status(422).json({ error: 'Datos del huésped inválidos.' });
  }

  const link = await findActiveLink(req.params.reference);

  if (!link) {
    return res.status(404).json({ error: 'Enlace no válido.' });
  }

  await sql`
    INSERT INTO guest_submissions (checkin_link_id, email, first_name, first_surname)
    VALUES (${link.id}, ${parsed.data.email}, ${parsed.data.firstName}, ${parsed.data.firstSurname})
  `;

  return res.status(201).json({ message: 'Registro enviado.' });
});
