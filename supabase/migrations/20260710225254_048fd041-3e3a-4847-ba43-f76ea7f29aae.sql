CREATE OR REPLACE FUNCTION public.complete_current_user_password_reset()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed boolean := false;
BEGIN
  UPDATE public.password_reset_requirements
  SET required = false,
      completed_at = now(),
      updated_at = now()
  WHERE user_id = auth.uid()
    AND required = true
    AND completed_at IS NULL;

  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_current_user_password_reset() TO authenticated;