import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import { env } from './config/env.js';
import { isDatabaseHealthy } from './db/database.js';
import { adminRouter } from './routes/admin.routes.js';
import { authRouter } from './routes/auth.routes.js';
import { checkinRouter } from './routes/checkin.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';

export const app = express();
app.disable('x-powered-by');
app.use(cors({ origin: env.FRONTEND_ORIGIN }));
app.use(express.json({ limit: '2mb' }));
app.get('/api/health', async (_req, res) => {
  const database = await isDatabaseHealthy();
  res
    .status(database ? 200 : 503)
    .json({ status: database ? 'ok' : 'degraded', database, timestamp: new Date().toISOString() });
});
app.use('/api/auth', authRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/admin', adminRouter);
app.use('/api/checkin', checkinRouter);
app.use((_req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }));
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

export default app;
