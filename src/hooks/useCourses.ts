import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Tables, TablesInsert, TablesUpdate } from '@/integrations/supabase/types';
import { toast } from 'sonner';

export type Course = Tables<'courses'>;
export type Module = Tables<'modules'>;
export type Lesson = Tables<'lessons'>;

export type CourseWithModules = Course & {
  modules: (Module & { lessons: Lesson[] })[];
};

export function useCourses() {
  return useQuery({
    queryKey: ['courses'],
    queryFn: async () => {
      const { data: courses, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .order('order_index');

      if (coursesError) throw coursesError;

      const { data: modules, error: modulesError } = await supabase
        .from('modules')
        .select('*')
        .order('order_index');

      if (modulesError) throw modulesError;

      const { data: lessons, error: lessonsError } = await supabase
        .from('lessons')
        .select('*')
        .order('order_index');

      if (lessonsError) throw lessonsError;

      // Combine data
      const coursesWithModules: CourseWithModules[] = courses.map((course) => ({
        ...course,
        modules: modules
          .filter((m) => m.course_id === course.id)
          .map((module) => ({
            ...module,
            lessons: lessons.filter((l) => l.module_id === module.id),
          })),
      }));

      return coursesWithModules;
    },
  });
}

// Course mutations
export function useCreateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (course: TablesInsert<'courses'>) => {
      const { data, error } = await supabase.from('courses').insert(course).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Course created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create course: ' + error.message);
    },
  });
}

export function useUpdateCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'courses'> & { id: string }) => {
      const { data, error } = await supabase.from('courses').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Course updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update course: ' + error.message);
    },
  });
}

export function useDeleteCourse() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('courses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Course deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete course: ' + error.message);
    },
  });
}

// Module mutations
export function useCreateModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (module: TablesInsert<'modules'>) => {
      const { data, error } = await supabase.from('modules').insert(module).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Module created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create module: ' + error.message);
    },
  });
}

export function useUpdateModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'modules'> & { id: string }) => {
      const { data, error } = await supabase.from('modules').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Module updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update module: ' + error.message);
    },
  });
}

export function useDeleteModule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('modules').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Module deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete module: ' + error.message);
    },
  });
}

// Lesson mutations
export function useCreateLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lesson: TablesInsert<'lessons'>) => {
      const { data, error } = await supabase.from('lessons').insert(lesson).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Lesson created successfully');
    },
    onError: (error) => {
      toast.error('Failed to create lesson: ' + error.message);
    },
  });
}

export function useUpdateLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: TablesUpdate<'lessons'> & { id: string }) => {
      const { data, error } = await supabase.from('lessons').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Lesson updated successfully');
    },
    onError: (error) => {
      toast.error('Failed to update lesson: ' + error.message);
    },
  });
}

export function useDeleteLesson() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('lessons').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      toast.success('Lesson deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete lesson: ' + error.message);
    },
  });
}
