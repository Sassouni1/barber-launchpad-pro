import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface HomeworkFile {
  id: string;
  submission_id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
}

export interface HomeworkSubmission {
  id: string;
  user_id: string;
  module_id: string;
  text_response: string | null;
  checklist_completed: boolean;
  submitted_at: string;
  files?: HomeworkFile[];
}

export function useHomeworkSubmission(moduleId: string | undefined) {
  return useQuery({
    queryKey: ['homework-submission', moduleId],
    queryFn: async () => {
      if (!moduleId) return null;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data: submission, error } = await supabase
        .from('homework_submissions')
        .select('*')
        .eq('module_id', moduleId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;
      if (!submission) return null;

      // Fetch files for this submission
      const { data: files, error: filesError } = await supabase
        .from('homework_files')
        .select('*')
        .eq('submission_id', submission.id);

      if (filesError) throw filesError;

      return { ...submission, files: files || [] } as HomeworkSubmission;
    },
    enabled: !!moduleId,
  });
}

export function useSubmitHomework() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      moduleId: string;
      textResponse?: string;
      checklistCompleted: boolean;
      files?: File[];
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check for existing submission
      const { data: existing } = await supabase
        .from('homework_submissions')
        .select('id')
        .eq('module_id', data.moduleId)
        .eq('user_id', user.id)
        .maybeSingle();

      let submissionId: string;

      if (existing) {
        // Update existing submission
        const { data: updated, error } = await supabase
          .from('homework_submissions')
          .update({
            text_response: data.textResponse || null,
            checklist_completed: data.checklistCompleted,
            submitted_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        submissionId = updated.id;
      } else {
        // Create new submission
        const { data: created, error } = await supabase
          .from('homework_submissions')
          .insert({
            user_id: user.id,
            module_id: data.moduleId,
            text_response: data.textResponse || null,
            checklist_completed: data.checklistCompleted,
          })
          .select()
          .single();

        if (error) throw error;
        submissionId = created.id;
      }

      // Upload files if provided
      if (data.files && data.files.length > 0) {
        for (const file of data.files) {
          const filePath = `${user.id}/${data.moduleId}/${Date.now()}-${file.name}`;

          const { error: uploadError } = await supabase.storage
            .from('homework-submissions')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('homework-submissions')
            .getPublicUrl(filePath);

          const fileExt = file.name.split('.').pop();
          await supabase.from('homework_files').insert({
            submission_id: submissionId,
            file_name: file.name,
            file_url: publicUrl,
            file_type: fileExt || null,
          });
        }
      }

      return { moduleId: data.moduleId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['homework-submission', data.moduleId] });
    },
  });
}

export function useDeleteHomeworkFile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ fileId, moduleId, fileUrl }: { fileId: string; moduleId: string; fileUrl: string }) => {
      // Extract file path from URL
      const urlParts = fileUrl.split('/homework-submissions/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('homework-submissions').remove([filePath]);
      }

      const { error } = await supabase
        .from('homework_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;
      return { moduleId };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['homework-submission', data.moduleId] });
    },
  });
}
