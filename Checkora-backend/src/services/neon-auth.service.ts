import { env } from '../config/env.js';

export class NeonAuthProvisioningError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

type CreateNeonAuthUserInput = {
  name: string;
  email: string;
  password: string;
};

type NeonAuthUser = { id: string; email: string; name: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function messageFromResponse(body: unknown): string | null {
  if (isRecord(body) && typeof body.message === 'string') {
    return body.message;
  }

  return null;
}

export async function createNeonAuthUser(input: CreateNeonAuthUserInput): Promise<NeonAuthUser> {
  const baseUrl = `${env.NEON_AUTH_URL.replace(/\/$/, '')}/`;
  const response = await fetch(new URL('sign-up/email', baseUrl), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: env.FRONTEND_ORIGIN,
    },
    body: JSON.stringify(input),
  });
  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const detail = messageFromResponse(body);
    const message =
      response.status === 409 || detail?.toLowerCase().includes('already exists')
        ? 'Ya existe una cuenta de Neon Auth con este correo electrónico.'
        : 'Neon Auth no ha podido crear la cuenta del propietario.';

    throw new NeonAuthProvisioningError(message, response.status);
  }

  if (!isRecord(body) || !isRecord(body.user) || typeof body.user.id !== 'string') {
    throw new NeonAuthProvisioningError(
      'Neon Auth devolvió una respuesta no válida al crear el propietario.',
      502,
    );
  }

  return {
    id: body.user.id,
    email: typeof body.user.email === 'string' ? body.user.email : input.email,
    name: typeof body.user.name === 'string' ? body.user.name : input.name,
  };
}
