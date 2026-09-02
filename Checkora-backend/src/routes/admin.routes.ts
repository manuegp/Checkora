import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth, requireRole } from '../middleware/auth.middleware.js';
import { createNeonAuthUser, NeonAuthProvisioningError } from '../services/neon-auth.service.js';
import { createOwnerLink, OwnerProvisioningError } from '../services/owner.service.js';

export const adminRouter = Router();

const createOwnerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(320),
  password: z.string().min(12).max(128),
});

adminRouter.post('/owners', requireAuth, requireRole('SUPERADMIN'), async (req, res, next) => {
  const parsed = createOwnerSchema.safeParse(req.body);

  if (!parsed.success) {
    const invalidFields = [
      ...new Set(parsed.error.issues.map((issue) => String(issue.path[0]))),
    ].filter((field) => field === 'name' || field === 'email' || field === 'password');

    return res.status(422).json({
      error: 'Indica nombre, email válido y una contraseña de entre 12 y 128 caracteres.',
      invalidFields,
    });
  }

  try {
    const owner = await createNeonAuthUser(parsed.data);
    const { checkinUrl } = await createOwnerLink(owner.id, env.FRONTEND_ORIGIN, owner);

    return res.status(201).json({
      owner: { id: owner.id, name: owner.name, email: owner.email },
      checkinUrl,
    });
  } catch (error) {
    if (error instanceof NeonAuthProvisioningError) {
      const status = error.status >= 500 ? 502 : 409;
      return res.status(status).json({ error: error.message });
    }

    if (error instanceof OwnerProvisioningError) {
      return res.status(409).json({ error: error.message });
    }

    return next(error);
  }
});
