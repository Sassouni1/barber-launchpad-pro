import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ModuleFile {
  id: string;
  module_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  order_index: number;
  created_at: string;
}

export function useModuleFiles(moduleId: string | undefined) {
  return useQuery({
    queryKey: ['module-files', moduleId],
    queryFn: async () => {
      if (!moduleId) return [];
      const { data, error } = await supabase
        .from('module_files')
        .select('*')
        .eq('module_id', moduleId)
        .order('order_index');
      if (error) throw error;
      return data as ModuleFile[];
    },
    enabled: !!moduleId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useUploadModuleFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ moduleId, file }: { moduleId: string; file: File }) => {
      const fileExt = file.name.split('.').pop();
      const filePath = `${moduleId}/${Date.now()}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from('course-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('course-files')
        .getPublicUrl(filePath);

      const { data: files } = await supabase
        .from('module_files')
        .select('order_index')
        .eq('module_id', moduleId)
        .order('order_index', { ascending: false })
        .limit(1);

      const maxOrder = files?.[0]?.order_index ?? -1;

      const { data, error } = await supabase
        .from('module_files')
        .insert({
          module_id: moduleId,
          file_name: file.name,
          file_url: publicUrl,
          file_type: fileExt || null,
          order_index: maxOrder + 1,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, { moduleId }) => {
      queryClient.invalidateQueries({ queryKey: ['module-files', moduleId] });
    },
  });
}

export function useDeleteModuleFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileId, moduleId, fileUrl }: { fileId: string; moduleId: string; fileUrl: string }) => {
      // Extract file path from URL
      const urlParts = fileUrl.split('/course-files/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('course-files').remove([filePath]);
      }

      const { error } = await supabase
        .from('module_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;
      return { moduleId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['module-files', data.moduleId] });
    },
  });
}
