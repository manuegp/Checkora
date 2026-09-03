import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { sql } from '../db/database.js';
import { hashPublicToken } from '../lib/crypto.js';
import { sendGuestSubmissionNotificationEmail } from '../services/email.service.js';

export const checkinRouter = Router();

const requiredText = (max: number) => z.string().trim().min(1).max(max);

const body = z.object({
  email: z.email().max(320),
  firstName: requiredText(120),
  firstSurname: requiredText(120),
  secondSurname: z.string().trim().max(120),
  gender: z.enum(['female', 'male', 'other']),
  documentType: z.enum(['dni', 'nie', 'passport', 'other']),
  documentNumber: requiredText(80),
  documentSupportNumber: requiredText(80),
  nationality: requiredText(120),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mobilePhone: requiredText(40),
  habitualResidence: requiredText(160),
  address: requiredText(240),
  postalCode: requiredText(24),
  municipality: requiredText(160),
  signature: z.string().startsWith('data:image/').max(1_500_000),
  privacyAccepted: z.literal(true),
});

type ActiveLink = {
  id: string;
  owner_name: string | null;
  owner_email: string | null;
};

type CreatedSubmission = { id: string };

async function findActiveLink(reference: string): Promise<ActiveLink | null> {
  const links = await sql`
    SELECT l.id, r.owner_name, r.owner_email
    FROM checkin_links l
    JOIN checkora_user_roles r ON r.auth_user_id = l.owner_auth_user_id
    WHERE l.active = true
      AND (l.id::text = ${reference} OR l.token_hash = ${hashPublicToken(reference)})
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

  const submissions = await sql`
    INSERT INTO guest_submissions (
      checkin_link_id,
      email,
      first_name,
      first_surname,
      second_surname,
      gender,
      document_type,
      document_number,
      document_support_number,
      nationality,
      birth_date,
      mobile_phone,
      habitual_residence,
      address,
      postal_code,
      municipality,
      signature_url,
      privacy_accepted_at
    )
    VALUES (
      ${link.id},
      ${parsed.data.email},
      ${parsed.data.firstName},
      ${parsed.data.firstSurname},
      ${parsed.data.secondSurname},
      ${parsed.data.gender},
      ${parsed.data.documentType},
      ${parsed.data.documentNumber},
      ${parsed.data.documentSupportNumber},
      ${parsed.data.nationality},
      ${parsed.data.birthDate},
      ${parsed.data.mobilePhone},
      ${parsed.data.habitualResidence},
      ${parsed.data.address},
      ${parsed.data.postalCode},
      ${parsed.data.municipality},
      ${parsed.data.signature},
      now()
    )
    RETURNING id
  `;
  const submission = submissions[0] as CreatedSubmission | undefined;

  if (!submission) {
    return res.status(500).json({ error: 'No se ha podido guardar el registro.' });
  }

  let emailSent = false;
  if (link.owner_email) {
    try {
      await sendGuestSubmissionNotificationEmail({
        to: link.owner_email,
        ownerName: link.owner_name ?? 'propietario',
        guestName: `${parsed.data.firstName} ${parsed.data.firstSurname}`,
        guestEmail: parsed.data.email,
        dashboardUrl: `${env.FRONTEND_ORIGIN}/dashboard`,
        idempotencyKey: `guest-submission-${submission.id}`,
      });
      emailSent = true;
    } catch (error) {
      console.error('No se ha podido enviar el aviso de nuevo registro.', error);
    }
  }

  return res.status(201).json({
    message: emailSent
      ? 'Registro enviado y propietario notificado.'
      : 'Registro enviado. El propietario no pudo ser notificado por correo.',
    emailSent,
  });
});
