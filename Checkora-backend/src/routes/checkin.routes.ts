import { Router } from 'express';
import { env } from '../config/env.js';
import { sql } from '../db/database.js';
import {
  draftBirthDate,
  draftBody,
  draftColumnValue,
  draftTokenSchema,
  hasDraftContent,
  submissionBody,
  type CheckinDraft,
} from '../lib/checkin-validation.js';
import { hashPublicToken } from '../lib/crypto.js';
import { sendGuestSubmissionNotificationEmail } from '../services/email.service.js';

export const checkinRouter = Router();

type ActiveLink = {
  id: string;
  owner_name: string | null;
  owner_email: string | null;
};

type SavedSubmission = { id: string; is_valid: boolean };

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

async function saveSubmission(
  linkId: string,
  draft: CheckinDraft,
  draftToken: string | undefined,
  finalize: boolean,
): Promise<SavedSubmission | undefined> {
  const submissions = await sql`
    INSERT INTO guest_submissions (
      checkin_link_id, draft_token_hash, draft_data, is_valid,
      email, first_name, first_surname, second_surname, gender, document_type,
      document_number, document_support_number, nationality, birth_date,
      mobile_phone, habitual_residence, address, postal_code, municipality,
      signature_url, privacy_accepted_at, submitted_at, updated_at
    )
    VALUES (
      ${linkId},
      ${draftToken ? hashPublicToken(draftToken) : null},
      ${JSON.stringify(draft)}::jsonb,
      ${submissionBody.safeParse(draft).success},
      ${draftColumnValue(draft.email, 320)},
      ${draftColumnValue(draft.firstName, 120)},
      ${draftColumnValue(draft.firstSurname, 120)},
      ${draftColumnValue(draft.secondSurname, 120)},
      ${draftColumnValue(draft.gender, 30)},
      ${draftColumnValue(draft.documentType, 30)},
      ${draftColumnValue(draft.documentNumber, 80)},
      ${draftColumnValue(draft.documentSupportNumber, 80)},
      ${draftColumnValue(draft.nationality, 120)},
      ${draftBirthDate(draft.birthDate)},
      ${draftColumnValue(draft.mobilePhone, 40)},
      ${draftColumnValue(draft.habitualResidence, 160)},
      ${draftColumnValue(draft.address, 240)},
      ${draftColumnValue(draft.postalCode, 24)},
      ${draftColumnValue(draft.municipality, 160)},
      ${draft.signature.startsWith('data:image/') ? draft.signature : null},
      CASE WHEN ${draft.privacyAccepted} THEN now() ELSE NULL END,
      CASE WHEN ${finalize} THEN now() ELSE NULL END,
      now()
    )
    ON CONFLICT (draft_token_hash) DO UPDATE SET
      draft_data = EXCLUDED.draft_data,
      is_valid = EXCLUDED.is_valid,
      email = EXCLUDED.email,
      first_name = EXCLUDED.first_name,
      first_surname = EXCLUDED.first_surname,
      second_surname = EXCLUDED.second_surname,
      gender = EXCLUDED.gender,
      document_type = EXCLUDED.document_type,
      document_number = EXCLUDED.document_number,
      document_support_number = EXCLUDED.document_support_number,
      nationality = EXCLUDED.nationality,
      birth_date = EXCLUDED.birth_date,
      mobile_phone = EXCLUDED.mobile_phone,
      habitual_residence = EXCLUDED.habitual_residence,
      address = EXCLUDED.address,
      postal_code = EXCLUDED.postal_code,
      municipality = EXCLUDED.municipality,
      signature_url = EXCLUDED.signature_url,
      privacy_accepted_at = CASE
        WHEN EXCLUDED.privacy_accepted_at IS NOT NULL
          THEN COALESCE(guest_submissions.privacy_accepted_at, EXCLUDED.privacy_accepted_at)
        ELSE NULL
      END,
      submitted_at = EXCLUDED.submitted_at,
      updated_at = now()
    WHERE guest_submissions.checkin_link_id = EXCLUDED.checkin_link_id
      AND guest_submissions.submitted_at IS NULL
    RETURNING id, is_valid
  `;

  return submissions[0] as SavedSubmission | undefined;
}

checkinRouter.get('/:reference', async (req, res) => {
  const link = await findActiveLink(req.params.reference);

  return link ? res.json({ active: true }) : res.status(404).json({ error: 'Enlace no válido.' });
});

checkinRouter.put('/:reference/drafts/:draftToken', async (req, res) => {
  const token = draftTokenSchema.safeParse(req.params.draftToken);
  const parsed = draftBody.safeParse(req.body);
  if (!token.success || !parsed.success) {
    return res.status(422).json({ error: 'Datos del borrador inválidos.' });
  }

  const link = await findActiveLink(req.params.reference);
  if (!link) return res.status(404).json({ error: 'Enlace no válido.' });

  // A visit without filling anything must not create an empty guest record.
  if (!hasDraftContent(parsed.data)) {
    const existing = await sql`
      SELECT id FROM guest_submissions
      WHERE checkin_link_id = ${link.id}
        AND draft_token_hash = ${hashPublicToken(token.data)}
      LIMIT 1
    `;
    if (existing.length === 0) return res.status(204).end();
  }

  const submission = await saveSubmission(link.id, parsed.data, token.data, false);
  if (!submission) {
    return res
      .status(409)
      .json({ error: 'El registro ya se ha enviado o el borrador no es válido.' });
  }

  return res.json({ id: submission.id, isValid: submission.is_valid });
});

checkinRouter.post('/:reference/submissions', async (req, res) => {
  const parsed = submissionBody
    .extend({ draftToken: draftTokenSchema.optional() })
    .safeParse(req.body);

  if (!parsed.success) {
    return res.status(422).json({ error: 'Datos del huésped inválidos.' });
  }

  const link = await findActiveLink(req.params.reference);
  if (!link) return res.status(404).json({ error: 'Enlace no válido.' });

  const { draftToken, ...data } = parsed.data;
  const submission = await saveSubmission(link.id, data, draftToken, true);
  if (!submission) {
    if (draftToken) {
      const completed = await sql`
        SELECT id, is_valid FROM guest_submissions
        WHERE checkin_link_id = ${link.id}
          AND draft_token_hash = ${hashPublicToken(draftToken)}
          AND submitted_at IS NOT NULL
        LIMIT 1
      `;
      const existing = completed[0] as SavedSubmission | undefined;
      if (existing) {
        return res.json({
          id: existing.id,
          isValid: existing.is_valid,
          emailSent: null,
          message: 'Registro ya enviado.',
        });
      }
    }
    return res
      .status(409)
      .json({ error: 'El registro ya se ha enviado o el borrador no es válido.' });
  }

  let emailSent = false;
  if (link.owner_email) {
    try {
      await sendGuestSubmissionNotificationEmail({
        to: link.owner_email,
        ownerName: link.owner_name ?? 'propietario',
        guestName: `${data.firstName} ${data.firstSurname}`,
        guestEmail: data.email,
        dashboardUrl: `${env.FRONTEND_ORIGIN}/dashboard`,
        idempotencyKey: `guest-submission-${submission.id}`,
      });
      emailSent = true;
    } catch (error) {
      console.error('No se ha podido enviar el aviso de nuevo registro.', error);
    }
  }

  return res.status(201).json({
    id: submission.id,
    isValid: submission.is_valid,
    message: emailSent
      ? 'Registro enviado y propietario notificado.'
      : 'Registro enviado. El propietario no pudo ser notificado por correo.',
    emailSent,
  });
});
