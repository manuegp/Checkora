import { env } from '../config/env.js';

export class NeonAuthProvisioningError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export class NeonAuthPasswordResetError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'NeonAuthPasswordResetError';
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

async function postToNeonAuth(path: string, payload: object): Promise<Response> {
  const baseUrl = `${env.NEON_AUTH_URL.replace(/\/$/, '')}/`;

  return fetch(new URL(path, baseUrl), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: env.FRONTEND_ORIGIN,
    },
    body: JSON.stringify(payload),
  });
}

export async function createNeonAuthUser(input: CreateNeonAuthUserInput): Promise<NeonAuthUser> {
  const response = await postToNeonAuth('sign-up/email', input);
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

export async function requestNeonPasswordReset(input: {
  email: string;
  redirectTo: string;
}): Promise<void> {
  const response = await postToNeonAuth('request-password-reset', input);

  if (!response.ok) {
    throw new NeonAuthPasswordResetError(
      'Neon Auth no ha podido iniciar la recuperación de contraseña.',
      response.status,
    );
  }
}

export async function resetNeonPassword(input: {
  token: string;
  newPassword: string;
}): Promise<void> {
  const response = await postToNeonAuth('reset-password', input);

  if (!response.ok) {
    throw new NeonAuthPasswordResetError(
      'El enlace de recuperación no es válido o ha caducado.',
      response.status,
    );
  }
}
