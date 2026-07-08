
CREATE POLICY "Admins can view all aion conversations"
ON public.aion_conversations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view all aion messages"
ON public.aion_messages FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
