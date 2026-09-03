# Despliegue de Checkora en Vercel

Checkora se despliega como dos proyectos de Vercel independientes dentro del mismo repositorio:

| Proyecto | Directorio raíz | Responsabilidad |
| --- | --- | --- |
| `checkora-api` | `Checkora-backend` | API Express, autenticación, Neon y CORS |
| `checkora-web` | `Checkora-frontend` | Aplicación Angular y formulario público |

No subas archivos `.env` al repositorio. Los valores se configuran desde **Settings → Environment Variables** de cada proyecto.

## 1. Sube el repositorio a GitHub

Desde `C:\dev\Checkora`, crea o usa un repositorio privado de GitHub y publica los dos directorios. Vercel importará el mismo repositorio dos veces, indicando un directorio raíz diferente en cada proyecto.

## 2. Crea y despliega primero la API

En Vercel, pulsa **Add New → Project**, importa el repositorio y configura:

- Nombre sugerido: `checkora-api`.
- Root Directory: `Checkora-backend`.
- Framework Preset: deja la detección automática de Express.
- No definas `Output Directory` ni un comando de build personalizado.

Añade estas variables para **Production** (y, si vas a usar vistas previas, también para Preview):

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | URL agrupada/pooled de tu proyecto Neon |
| `NEON_AUTH_URL` | URL base de Neon Auth que ya usas localmente |
| `NEON_AUTH_JWKS_URL` | URL JWKS de Neon Auth |
| `FRONTEND_ORIGIN` | Se actualiza en el paso 4 con la URL final del frontend |
| `RESEND_API_KEY` | API key de Resend con permiso de envío |
| `EMAIL_FROM` | Remitente verificado, por ejemplo `Checkora <noreply@tu-dominio.es>` |
| `PORT` | No hace falta añadirla en Vercel |

Despliega. Comprueba que `https://<tu-api>.vercel.app/api/health` devuelve `status: "ok"`.

## 3. Crea el proyecto del frontend

Vuelve a **Add New → Project**, importa el mismo repositorio y configura:

- Nombre sugerido: `checkora-web`.
- Root Directory: `Checkora-frontend`.
- Framework Preset: Angular u **Other** si Vercel no lo selecciona automáticamente.

El archivo `vercel.json` ya fija el comando, la carpeta generada por Angular y el fallback para las rutas del router.

Añade estas variables en **Production**:

| Variable | Valor |
| --- | --- |
| `API_URL` | `https://<tu-api>.vercel.app/api` |
| `NEON_AUTH_URL` | La misma URL pública de Neon Auth usada en local |

`API_URL` y `NEON_AUTH_URL` se incorporan al bundle de Angular durante la compilación. No contienen secretos. No añadas aquí `DATABASE_URL`, claves privadas ni secretos de Resend.

Despliega el frontend y copia su dominio de producción, por ejemplo `https://checkora-web.vercel.app`.

## 4. Cierra la configuración de seguridad

En el proyecto **checkora-api**, cambia `FRONTEND_ORIGIN` por el dominio exacto del frontend, sin barra final, y redepliega la API. Este valor se usa tanto para CORS como para generar las URL públicas de los formularios de propietarios.

En Neon Auth, añade el mismo dominio como **Trusted Origin / Allowed Origin**. Conserva también `http://localhost:4200` para desarrollo local.

Después verifica:

1. Inicio de sesión de superadmin y propietario.
2. Alta de un propietario, recepción de su correo de activación y creación de su contraseña desde «recordar contraseña».
3. Apertura del enlace público en una ventana privada y envío del formulario.
4. Dashboard y `GET /api/health`.

## 5. Dominio propio y correo

Cuando tengas dominio propio, configura el dominio del frontend en Vercel y sustituye `FRONTEND_ORIGIN` por ese dominio. Añádelo también como Trusted Origin en Neon Auth. Para enviar correos, conecta Resend al proyecto de la API, verifica el dominio y guarda `RESEND_API_KEY` y `EMAIL_FROM` únicamente en la API. Sin estas variables no se podrá completar el alta de un propietario con correo de activación.

## Desarrollo local

No cambia tu flujo actual:

- Frontend: `npm run start` dentro de `Checkora-frontend`.
- Backend: `npm run dev` dentro de `Checkora-backend`.

Para simular la compilación de producción del frontend sin Vercel, define temporalmente `API_URL` y `NEON_AUTH_URL` en la terminal y ejecuta `npm run build:production`. El archivo de entorno que se genera está ignorado por Git.
