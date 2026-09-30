CREATE OR REPLACE FUNCTION public.store_encrypted_token(token_value text, encryption_key text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE new_id uuid;
BEGIN
  INSERT INTO public.app_secrets (secret_value)
  VALUES (extensions.pgp_sym_encrypt(token_value, encryption_key))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.decrypt_token(token_id uuid, encryption_key text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE decrypted text;
BEGIN
  SELECT extensions.pgp_sym_decrypt(secret_value::bytea, encryption_key) INTO decrypted
  FROM public.app_secrets WHERE id = token_id;
  RETURN decrypted;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.store_encrypted_token(text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_token(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.store_encrypted_token(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_token(uuid, text) TO service_role;