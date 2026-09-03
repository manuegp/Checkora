import { Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { createNeonAuthUser, NeonAuthProvisioningError } from '../services/neon-auth.service.js';
import { createOwnerLink, OwnerProvisioningError } from '../services/owner.service.js';
import {
  EmailConfigurationError,
  EmailDeliveryError,
  sendOwnerInvitationEmail,
} from '../services/email.service.js';

export const adminRouter = Router();

const createOwnerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
});

function ownerInvitationUrl(email: string): string {
  const url = new URL('/forgot-password', env.FRONTEND_ORIGIN);
  url.searchParams.set('email', email);
  return url.toString();
}

adminRouter.post('/owners', requireAuth, requireRole('SUPERADMIN'), async (req, res, next) => {
  const parsed = createOwnerSchema.safeParse(req.body);

  if (!parsed.success) {
    const invalidFields = [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ].filter((field) => field === 'name' || field === 'email');

    return res.status(422).json({
      error: 'Indica nombre y un email válido.',
      invalidFields,
    });
  }

  try {
    // La contraseña temporal nunca se comparte: el propietario la define mediante
    // el flujo normal y seguro de recuperación de contraseña.
    const owner = await createNeonAuthUser({
      ...parsed.data,
      password: randomBytes(32).toString('base64url'),
    });
    const { checkinUrl } = await createOwnerLink(owner.id, env.FRONTEND_ORIGIN, owner);
    await sendOwnerInvitationEmail({
      to: owner.email,
      name: owner.name,
      forgotPasswordUrl: ownerInvitationUrl(owner.email),
      idempotencyKey: `owner-invitation-${owner.id}`,
    });

    return res.status(201).json({
      owner: { id: owner.id, name: owner.name, email: owner.email },
      checkinUrl,
      invitationEmailSent: true,
    });
  } catch (error) {
    if (error instanceof NeonAuthProvisioningError) {
      const status = error.status >= 500 ? 502 : 409;
      return res.status(status).json({ error: error.message });
    }

    if (error instanceof OwnerProvisioningError) {
      return res.status(409).json({ error: error.message });
    }

    if (error instanceof EmailConfigurationError || error instanceof EmailDeliveryError) {
      return res.status(502).json({
        error:
          'La cuenta se ha creado, pero no se ha podido enviar el correo de activación. Configura el correo transaccional e indica al propietario que use «¿Has olvidado tu contraseña?» con su email.',
        ownerCreated: true,
      });
    }

    return next(error);
  }
});
