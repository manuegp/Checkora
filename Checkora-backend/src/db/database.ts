import { neon } from '@neondatabase/serverless';
import { env } from '../config/env.js';

export const sql = neon(env.DATABASE_URL);

export async function isDatabaseHealthy(): Promise<boolean> {
  try {
    await sql`SELECT 1`;
    return true;
  } catch {
    return false;
  }
}
