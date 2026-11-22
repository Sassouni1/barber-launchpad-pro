-- Printed member QR codes must keep resolving when their destination changes.
-- Members may update their own links, but cannot delete the underlying code.
DROP POLICY IF EXISTS "Users can delete own qr_links" ON public.qr_links;
REVOKE DELETE ON public.qr_links FROM authenticated;
