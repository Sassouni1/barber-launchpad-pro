
CREATE TABLE public.group_calls (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  day_of_week text NOT NULL,
  time_label text NOT NULL,
  zoom_link text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.group_calls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view group calls" ON public.group_calls FOR SELECT TO public USING (true);
CREATE POLICY "Admins can insert group calls" ON public.group_calls FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update group calls" ON public.group_calls FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete group calls" ON public.group_calls FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
