CREATE POLICY "Users can delete own homework files"
ON public.homework_files FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM homework_submissions hs
    WHERE hs.id = homework_files.submission_id
    AND hs.user_id = auth.uid()
  )
);