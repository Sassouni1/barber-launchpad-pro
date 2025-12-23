-- Create module_notes table for note sections (e.g., "Key Takeaways", "Pro Tips")
CREATE TABLE public.module_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  module_id UUID NOT NULL REFERENCES public.modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create module_note_items table for individual note bullet points
CREATE TABLE public.module_note_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  note_section_id UUID NOT NULL REFERENCES public.module_notes(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  link_url TEXT,
  link_text TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.module_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.module_note_items ENABLE ROW LEVEL SECURITY;

-- Everyone can read notes (they're part of the course content)
CREATE POLICY "Anyone can view module notes" 
ON public.module_notes FOR SELECT USING (true);

CREATE POLICY "Anyone can view note items" 
ON public.module_note_items FOR SELECT USING (true);

-- Only admins can manage notes (correct arg order: user_id, role)
CREATE POLICY "Admins can insert module notes"
ON public.module_notes FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update module notes"
ON public.module_notes FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete module notes"
ON public.module_notes FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert note items"
ON public.module_note_items FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update note items"
ON public.module_note_items FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete note items"
ON public.module_note_items FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create indexes for better performance
CREATE INDEX idx_module_notes_module_id ON public.module_notes(module_id);
CREATE INDEX idx_module_note_items_section_id ON public.module_note_items(note_section_id);