-- CHECKORA · Esquema completo e idempotente para Neon Postgres.
--
-- Neon Auth gestiona identidad y sesiones fuera de estas tablas.
-- Ejecuta este archivo completo en Neon SQL Editor tanto en una base nueva
-- como para añadir las columnas nuevas a una base de Checkora existente.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Roles y datos de contacto que Checkora necesita mostrar al superadministrador.
CREATE TABLE IF NOT EXISTS checkora_user_roles (
  auth_user_id text PRIMARY KEY,
  role varchar(20) NOT NULL CHECK (role IN ('SUPERADMIN', 'OWNER')),
  owner_name varchar(120),
  owner_email varchar(320),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Compatible con bases creadas antes de añadir nombre y email del propietario.
ALTER TABLE checkora_user_roles
  ADD COLUMN IF NOT EXISTS owner_name varchar(120),
  ADD COLUMN IF NOT EXISTS owner_email varchar(320);

-- Cada propietario dispone de un único enlace público activo para sus huéspedes.
-- token_hash guarda SHA-256 de los enlaces heredados; los enlaces nuevos usan el UUID id.
CREATE TABLE IF NOT EXISTS checkin_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_auth_user_id text NOT NULL UNIQUE
    REFERENCES checkora_user_roles(auth_user_id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CONSTRAINT checkin_links_revocation_consistency CHECK (
    (active = true AND revoked_at IS NULL) OR
    (active = false)
  )
);

-- Datos proporcionados por un huésped desde el enlace público.
CREATE TABLE IF NOT EXISTS guest_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkin_link_id uuid NOT NULL
    REFERENCES checkin_links(id) ON DELETE RESTRICT,
  email varchar(320) NOT NULL,
  first_name varchar(120) NOT NULL,
  first_surname varchar(120) NOT NULL,
  second_surname varchar(120),
  gender varchar(30),
  document_type varchar(30),
  document_number varchar(80),
  document_support_number varchar(80),
  nationality varchar(120),
  birth_date date,
  mobile_phone varchar(40),
  habitual_residence varchar(160),
  address varchar(240),
  postal_code varchar(24),
  municipality varchar(160),
  signature_url text,
  privacy_accepted_at timestamptz NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guest_submissions_link_submitted_idx
  ON guest_submissions (checkin_link_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS guest_submissions_email_idx
  ON guest_submissions (email);

COMMIT;

-- Primer superadministrador:
-- Obtén su ID desde Neon Auth y ejecuta por separado:
-- INSERT INTO checkora_user_roles (auth_user_id, role)
-- VALUES ('TU_ID_DE_NEON_AUTH', 'SUPERADMIN');
