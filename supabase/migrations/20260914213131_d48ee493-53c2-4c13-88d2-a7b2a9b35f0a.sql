CREATE POLICY "Members upload own content reward files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'content-rewards' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Members read own content reward files"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'content-rewards' AND ((storage.foldername(name))[1] = auth.uid()::text OR public.has_role(auth.uid(),'admin')));

CREATE POLICY "Members update own content reward files"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'content-rewards' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'content-rewards' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Members delete own content reward files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'content-rewards' AND (storage.foldername(name))[1] = auth.uid()::text);