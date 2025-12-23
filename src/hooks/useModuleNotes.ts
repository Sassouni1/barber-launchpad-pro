import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface NoteItem {
  id: string;
  note_section_id: string;
  content: string;
  link_url: string | null;
  link_text: string | null;
  order_index: number;
  created_at: string;
}

export interface NoteSection {
  id: string;
  module_id: string;
  title: string;
  order_index: number;
  created_at: string;
  items: NoteItem[];
}

export function useModuleNotes(moduleId: string | undefined) {
  return useQuery({
    queryKey: ['module-notes', moduleId],
    queryFn: async () => {
      if (!moduleId) return [];
      
      // Fetch sections
      const { data: sections, error: sectionsError } = await supabase
        .from('module_notes')
        .select('*')
        .eq('module_id', moduleId)
        .order('order_index');

      if (sectionsError) throw sectionsError;
      if (!sections || sections.length === 0) return [];

      // Fetch items for all sections
      const sectionIds = sections.map(s => s.id);
      const { data: items, error: itemsError } = await supabase
        .from('module_note_items')
        .select('*')
        .in('note_section_id', sectionIds)
        .order('order_index');

      if (itemsError) throw itemsError;

      // Combine sections with their items
      return sections.map(section => ({
        ...section,
        items: (items || []).filter(item => item.note_section_id === section.id)
      })) as NoteSection[];
    },
    enabled: !!moduleId,
  });
}

export function useCreateNoteSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ moduleId, title, orderIndex }: { moduleId: string; title: string; orderIndex: number }) => {
      const { data, error } = await supabase
        .from('module_notes')
        .insert({ module_id: moduleId, title, order_index: orderIndex })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['module-notes', variables.moduleId] });
    },
  });
}

export function useUpdateNoteSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, title, moduleId }: { id: string; title: string; moduleId: string }) => {
      const { error } = await supabase
        .from('module_notes')
        .update({ title })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['module-notes', variables.moduleId] });
    },
  });
}

export function useDeleteNoteSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, moduleId }: { id: string; moduleId: string }) => {
      const { error } = await supabase
        .from('module_notes')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['module-notes', variables.moduleId] });
    },
  });
}

export function useCreateNoteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      sectionId, 
      content, 
      linkUrl, 
      linkText, 
      orderIndex,
      moduleId 
    }: { 
      sectionId: string; 
      content: string; 
      linkUrl?: string; 
      linkText?: string; 
      orderIndex: number;
      moduleId: string;
    }) => {
      const { data, error } = await supabase
        .from('module_note_items')
        .insert({ 
          note_section_id: sectionId, 
          content, 
          link_url: linkUrl || null, 
          link_text: linkText || null,
          order_index: orderIndex 
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['module-notes', variables.moduleId] });
    },
  });
}

export function useUpdateNoteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      id, 
      content, 
      linkUrl, 
      linkText,
      moduleId 
    }: { 
      id: string; 
      content: string; 
      linkUrl?: string; 
      linkText?: string;
      moduleId: string;
    }) => {
      const { error } = await supabase
        .from('module_note_items')
        .update({ 
          content, 
          link_url: linkUrl || null, 
          link_text: linkText || null 
        })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['module-notes', variables.moduleId] });
    },
  });
}

export function useDeleteNoteItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, moduleId }: { id: string; moduleId: string }) => {
      const { error } = await supabase
        .from('module_note_items')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['module-notes', variables.moduleId] });
    },
  });
}
