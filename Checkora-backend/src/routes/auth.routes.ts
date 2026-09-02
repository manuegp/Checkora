import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
export const authRouter = Router();
authRouter.get('/me', requireAuth, (req, res) =>
  res.json({ user: (req as AuthenticatedRequest).user }),
);
