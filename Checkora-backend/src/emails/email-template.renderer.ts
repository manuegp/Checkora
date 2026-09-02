export type RenderedEmail = {
  html: string;
  text: string;
};

type EmailCallToAction = {
  label: string;
  href: string;
};

type RenderEmailTemplateInput = {
  preview: string;
  title: string;
  contentHtml: string;
  contentText: string;
  callToAction?: EmailCallToAction;
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;',
    };

    return entities[character];
  });
}

/**
 * Genera un email HTML compatible con clientes de correo. El contenido HTML se
 * construye por plantillas internas; todo valor que venga de un usuario debe
 * escaparse previamente con `escapeHtml`.
 */
export function renderEmailTemplate(input: RenderEmailTemplateInput): RenderedEmail {
  const action = input.callToAction
    ? `<p style="margin:32px 0 0"><a href="${escapeHtml(input.callToAction.href)}" style="display:inline-block;background:#245cf5;border-radius:8px;color:#ffffff;font-weight:700;padding:14px 22px;text-decoration:none">${escapeHtml(input.callToAction.label)}</a></p>`
    : '';
  const actionText = input.callToAction
    ? `\n\n${input.callToAction.label}: ${input.callToAction.href}`
    : '';

  return {
    html: `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(input.title)}</title>
  </head>
  <body style="margin:0;background:#f4f7fb;color:#142033;font-family:Arial,Helvetica,sans-serif">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preview)}</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7fb;padding:32px 12px">
      <tr><td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden">
          <tr><td style="background:#142f5f;color:#ffffff;padding:24px 32px;font-size:16px;font-weight:800;letter-spacing:2px">CHECKORA</td></tr>
          <tr><td style="padding:32px">
            <h1 style="margin:0 0 18px;font-size:24px;line-height:1.3">${escapeHtml(input.title)}</h1>
            <div style="font-size:16px;line-height:1.6">${input.contentHtml}</div>
            ${action}
          </td></tr>
          <tr><td style="border-top:1px solid #e6eaf0;padding:20px 32px;color:#65748a;font-size:12px;line-height:1.5">Este correo ha sido enviado por Checkora.</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
    text: `${input.title}\n\n${input.contentText}${actionText}\n\nEste correo ha sido enviado por Checkora.`,
  };
}
