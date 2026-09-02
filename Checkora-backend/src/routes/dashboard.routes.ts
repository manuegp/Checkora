import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { getDashboard } from '../services/dashboard.service.js';
export const dashboardRouter = Router();
dashboardRouter.get('/', requireAuth, async (req, res) =>
  res.json(await getDashboard((req as AuthenticatedRequest).user)),
);
