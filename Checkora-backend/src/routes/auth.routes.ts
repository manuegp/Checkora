import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  NeonAuthPasswordResetError,
  requestNeonPasswordReset,
  resetNeonPassword,
} from '../services/neon-auth.service.js';

const passwordResetRequestSchema = z.object({
  email: z.string().trim().email(),
});

const passwordResetSchema = z.object({
  token: z.string().trim().min(1).max(2_048),
  newPassword: z.string().min(12).max(128),
});

function resetPasswordRedirectUrl(): string {
  return new URL('/reset-password', env.FRONTEND_ORIGIN).toString();
}

export const authRouter = Router();

authRouter.get('/me', requireAuth, (req, res) =>
  res.json({ user: (req as AuthenticatedRequest).user }),
);

authRouter.post('/password/forgot', async (req, res, next) => {
  const parsed = passwordResetRequestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({ error: 'Introduce un correo electrónico válido.' });
    return;
  }

  try {
    await requestNeonPasswordReset({
      email: parsed.data.email,
      redirectTo: resetPasswordRedirectUrl(),
    });

    // Respuesta deliberadamente genérica: no revela si el email existe.
    res.status(202).json({
      message:
        'Si existe una cuenta con este correo, recibirás un enlace para restablecer la contraseña.',
    });
  } catch (error) {
    if (error instanceof NeonAuthPasswordResetError) {
      console.error('Password reset request failed', { status: error.status });
      res.status(503).json({
        error:
          'La recuperación de contraseña no está disponible temporalmente. Inténtalo más tarde.',
      });
      return;
    }

    next(error);
  }
});

authRouter.post('/password/reset', async (req, res, next) => {
  const parsed = passwordResetSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(422).json({
      error: 'La contraseña debe tener entre 12 y 128 caracteres.',
    });
    return;
  }

  try {
    await resetNeonPassword(parsed.data);
    res.status(200).json({ message: 'La contraseña se ha actualizado correctamente.' });
  } catch (error) {
    if (error instanceof NeonAuthPasswordResetError) {
      const status = error.status >= 500 ? 503 : 400;
      res.status(status).json({
        error:
          status === 400
            ? 'El enlace de recuperación no es válido o ha caducado.'
            : 'No se ha podido actualizar la contraseña. Inténtalo más tarde.',
      });
      return;
    }

    next(error);
  }
});
