import { escapeHtml, renderEmailTemplate, type RenderedEmail } from './email-template.renderer.js';

type PasswordResetEmailInput = {
  name?: string;
  resetUrl: string;
};

export type PasswordResetEmail = RenderedEmail & {
  subject: string;
};

/**
 * Plantilla reutilizable para un proveedor que entregue el token oficial de
 * Neon Auth. No debe usarse para inventar tokens propios.
 */
export function renderPasswordResetEmail(input: PasswordResetEmailInput): PasswordResetEmail {
  const safeName = input.name?.trim() ? ` ${escapeHtml(input.name.trim())}` : '';
  const contentText = `Hola${input.name?.trim() ? ` ${input.name.trim()}` : ''},

Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de Checkora. Si la solicitaste, utiliza el botón para elegir una nueva contraseña. El enlace caduca pronto. Si no la solicitaste, puedes ignorar este correo.`;
  const rendered = renderEmailTemplate({
    preview: 'Restablece la contraseña de tu cuenta de Checkora.',
    title: 'Restablece tu contraseña',
    contentHtml: `<p style="margin:0">Hola${safeName},</p><p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta de Checkora.</p><p>Si la solicitaste, utiliza el botón para elegir una nueva contraseña. El enlace caduca pronto.</p><p>Si no la solicitaste, puedes ignorar este correo.</p>`,
    contentText,
    callToAction: { label: 'Restablecer contraseña', href: input.resetUrl },
  });

  return { subject: 'Restablece tu contraseña de Checkora', ...rendered };
}
