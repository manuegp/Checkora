import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

function getRequiredUrl(variableName) {
  const value = process.env[variableName]?.trim();

  if (!value) {
    throw new Error(`${variableName} es obligatoria para compilar la aplicación de producción.`);
  }

  try {
    const url = new URL(value);

    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('protocol');
    }

    return value.replace(/\/$/, '');
  } catch {
    throw new Error(`${variableName} debe ser una URL HTTP(S) válida.`);
  }
}

const apiUrl = getRequiredUrl('API_URL');
const neonAuthUrl = getRequiredUrl('NEON_AUTH_URL');

if (!new URL(apiUrl).pathname.endsWith('/api')) {
  throw new Error('API_URL debe terminar en /api.');
}

const target = resolve('src/environments/environment.production.ts');
const content = `export const environment = {\n  neonAuthUrl: ${JSON.stringify(neonAuthUrl)},\n  apiUrl: ${JSON.stringify(apiUrl)},\n};\n`;

mkdirSync(dirname(target), { recursive: true });
writeFileSync(target, content, 'utf8');