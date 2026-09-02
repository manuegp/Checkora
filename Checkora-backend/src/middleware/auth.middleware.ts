import type { NextFunction, Request, Response } from 'express';
import { verifyNeonAccessToken } from '../lib/neon-token.js';
import { getRole } from '../services/identity.service.js';
import type { AuthenticatedUser, Role } from '../types/auth.js';
export type AuthenticatedRequest = Request & { user: AuthenticatedUser };
export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = req.header('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const identity = await verifyNeonAccessToken(token);
  if (!identity) {
    res.status(401).json({ error: 'Sesión de Neon Auth no válida o caducada.' });
    return;
  }
  const role = await getRole(identity.id);
  if (!role) {
    res.status(403).json({ error: 'Tu cuenta aún no tiene un rol asignado en Checkora.' });
    return;
  }
  (req as AuthenticatedRequest).user = { ...identity, role };
  next();
}
export function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if ((req as AuthenticatedRequest).user.role !== role) {
      res.status(403).json({ error: 'No tienes permiso para realizar esta acción.' });
      return;
    }
    next();
  };
}
