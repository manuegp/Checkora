import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.url(),
  NEON_AUTH_URL: z.url(),
  NEON_AUTH_JWKS_URL: z.url(),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_ORIGIN: z.url().default('http://localhost:4200'),
});

export const env = schema.parse(process.env);
