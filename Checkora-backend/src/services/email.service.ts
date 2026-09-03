import { Resend } from 'resend';
import { env } from '../config/env.js';
import { escapeHtml, renderEmailTemplate } from '../emails/email-template.renderer.js';
import { renderPasswordResetEmail } from '../emails/password-reset.template.js';

export class EmailConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EmailConfigurationError';
  }
}

export class EmailDeliveryError extends Error {
  constructor(message: string, readonly providerDetail?: string) {
    super(message);
    this.name = 'EmailDeliveryError';
  }
}

type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  idempotencyKey?: string;
};

function getEmailConfiguration(): { apiKey: string; from: string; replyTo?: string } {
  if (!env.RESEND_API_KEY) {
    throw new EmailConfigurationError('RESEND_API_KEY no está configurada.');
  }

  if (!env.EMAIL_FROM) {
    throw new EmailConfigurationError('EMAIL_FROM no está configurada.');
  }

  return {
    apiKey: env.RESEND_API_KEY,
    from: env.EMAIL_FROM,
    replyTo: env.EMAIL_REPLY_TO,
  };
}

function resendErrorDetail(error: unknown): string {
  if (typeof error !== 'object' || error === null) {
    return 'Resend no ha devuelto información adicional.';
  }

  const value = error as Record<string, unknown>;
  const status = typeof value.statusCode === 'number' ? `HTTP ${value.statusCode}` : undefined;
  const name = typeof value.name === 'string' ? value.name : undefined;
  const message = typeof value.message === 'string' ? value.message.trim().slice(0, 500) : undefined;

  return [status, name, message].filter((part): part is string => Boolean(part)).join(' — ')
    || 'Resend no ha devuelto información adicional.';
}

export async function sendEmail(input: SendEmailInput): Promise<string | undefined> {
  const configuration = getEmailConfiguration();
  const resend = new Resend(configuration.apiKey);
  let response: Awaited<ReturnType<typeof resend.emails.send>>;

  try {
    response = await resend.emails.send(
      {
        from: configuration.from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
        replyTo: configuration.replyTo,
      },
      input.idempotencyKey ? { headers: { 'Idempotency-Key': input.idempotencyKey } } : undefined,
    );
  } catch (error) {
    throw new EmailDeliveryError(
      'No se ha podido contactar con Resend.',
      resendErrorDetail(error),
    );
  }

  if (response.error) {
    throw new EmailDeliveryError('Resend no ha podido enviar el correo.', resendErrorDetail(response.error));
  }

  return response.data?.id;
}

/**
 * Útil si Neon Auth se conecta a una plantilla/proveedor externo de correo.
 * El flujo actual de recuperación delega el envío y su token en Neon Auth.
 */
export async function sendPasswordResetEmail(input: {
  to: string;
  name?: string;
  resetUrl: string;
  idempotencyKey?: string;
}): Promise<string | undefined> {
  const email = renderPasswordResetEmail(input);

  return sendEmail({
    to: input.to,
    subject: email.subject,
    html: email.html,
    text: email.text,
    idempotencyKey: input.idempotencyKey,
  });
}

export async function sendOwnerInvitationEmail(input: {
  to: string;
  name: string;
  forgotPasswordUrl: string;
  idempotencyKey?: string;
}): Promise<string | undefined> {
  const name = input.name.trim();
  const email = renderEmailTemplate({
    preview: 'Ya puedes activar tu acceso de propietario a Checkora.',
    title: 'Activa tu acceso a Checkora',
    contentHtml: `<p style="margin:0">Hola ${escapeHtml(name)},</p><p>Te han dado acceso a Checkora como propietario con esta dirección de correo.</p><p>Para crear tu contraseña y acceder por primera vez, pulsa el botón. Se abrirá el flujo de <strong>recordar contraseña</strong> con tu correo ya indicado. Solicita el enlace seguro y, cuando lo recibas, elige tu contraseña.</p><p>Si no esperabas esta invitación, puedes ignorar este correo.</p>`,
    contentText: `Hola ${name},

Te han dado acceso a Checkora como propietario con esta dirección de correo.

Para crear tu contraseña y acceder por primera vez, usa el botón «Crear mi contraseña». Se abrirá el flujo de recordar contraseña con tu correo ya indicado. Solicita el enlace seguro y, cuando lo recibas, elige tu contraseña.

Si no esperabas esta invitación, puedes ignorar este correo.`,
    callToAction: { label: 'Crear mi contraseña', href: input.forgotPasswordUrl },
  });

  return sendEmail({
    to: input.to,
    subject: 'Activa tu acceso a Checkora',
    html: email.html,
    text: email.text,
    idempotencyKey: input.idempotencyKey,
  });
}
