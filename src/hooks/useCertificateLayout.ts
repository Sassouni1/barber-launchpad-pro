import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface CertificateLayout {
  id: string;
  course_id: string;
  name_x: number;
  name_y: number;
  name_max_width: number;
  name_font_size: number;
  name_min_font_size: number;
  date_x: number;
  date_y: number;
  date_font_size: number;
  name_color: string;
  date_color: string;
  template_path: string;
}

export function useCertificateLayout(courseId: string | undefined) {
  return useQuery({
    queryKey: ['certificate-layout', courseId],
    queryFn: async () => {
      if (!courseId) return null;
      
      const { data, error } = await supabase
        .from('certificate_layouts')
        .select('*')
        .eq('course_id', courseId)
        .maybeSingle();
      
      if (error) throw error;
      return data as CertificateLayout | null;
    },
    enabled: !!courseId,
  });
}

export function useUpdateCertificateLayout() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ courseId, updates }: { 
      courseId: string; 
      updates: Partial<Pick<CertificateLayout, 'name_x' | 'name_y'>> 
    }) => {
      const { data, error } = await supabase
        .from('certificate_layouts')
        .update(updates)
        .eq('course_id', courseId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['certificate-layout', variables.courseId] });
    },
  });
}
