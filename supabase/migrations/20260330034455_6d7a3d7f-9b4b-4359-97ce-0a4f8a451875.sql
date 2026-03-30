
-- Enable pgcrypto if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. app_secrets table for encrypted token storage
CREATE TABLE public.app_secrets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  secret_value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;
-- No public RLS policies — only accessible via security definer functions

-- 2. ghl_oauth_tokens table
CREATE TABLE public.ghl_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id text NOT NULL UNIQUE,
  location_name text NOT NULL DEFAULT '',
  organization_id text,
  access_token_id uuid REFERENCES public.app_secrets(id) ON DELETE CASCADE NOT NULL,
  refresh_token_id uuid REFERENCES public.app_secrets(id) ON DELETE CASCADE NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ghl_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Admin-only read policy
CREATE POLICY "Admins can view ghl tokens"
  ON public.ghl_oauth_tokens FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- 3. store_encrypted_token RPC
CREATE OR REPLACE FUNCTION public.store_encrypted_token(token_value text, encryption_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  INSERT INTO public.app_secrets (secret_value)
  VALUES (pgp_sym_encrypt(token_value, encryption_key))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

-- 4. decrypt_token RPC
CREATE OR REPLACE FUNCTION public.decrypt_token(token_id uuid, encryption_key text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  decrypted text;
BEGIN
  SELECT pgp_sym_decrypt(secret_value::bytea, encryption_key)
  INTO decrypted
  FROM public.app_secrets
  WHERE id = token_id;
  RETURN decrypted;
END;
$$;
