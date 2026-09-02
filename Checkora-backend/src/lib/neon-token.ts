import { createRemoteJWKSet, jwtVerify } from 'jose';
import { env } from '../config/env.js';
import type { AuthenticatedUser } from '../types/auth.js';
const jwks = createRemoteJWKSet(new URL(env.NEON_AUTH_JWKS_URL));
export async function verifyNeonAccessToken(
  token: string,
): Promise<Omit<AuthenticatedUser, 'role'> | null> {
  try {
    const { payload } = await jwtVerify(token, jwks);
    if (!payload.sub) return null;
    return {
      id: payload.sub,
      email: typeof payload.email === 'string' ? payload.email : '',
      name: typeof payload.name === 'string' ? payload.name : '',
    };
  } catch {
    return null;
  }
}
