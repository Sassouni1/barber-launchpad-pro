import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  type: 'course' | 'daily' | 'weekly';
  week_number: number | null;
  course_id: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface UserTodo {
  id: string;
  user_id: string;
  todo_id: string;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export function useTodos() {
  return useQuery({
    queryKey: ['todos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('week_number', { ascending: true })
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data as Todo[];
    },
  });
}

export function useUserTodos() {
  return useQuery({
    queryKey: ['user-todos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_todos')
        .select('*');

      if (error) throw error;
      return data as UserTodo[];
    },
  });
}

export function useCreateTodo() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (todo: Omit<Todo, 'id' | 'created_at' | 'updated_at'>) => {
      const { data, error } = await supabase
        .from('todos')
        .insert(todo)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      toast({ title: 'Todo created successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to create todo', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Todo> & { id: string }) => {
      const { data, error } = await supabase
        .from('todos')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      toast({ title: 'Todo updated successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to update todo', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('todos')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      toast({ title: 'Todo deleted successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete todo', description: error.message, variant: 'destructive' });
    },
  });
}

export function useToggleUserTodo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ todoId, completed }: { todoId: string; completed: boolean }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      if (completed) {
        const { error } = await supabase
          .from('user_todos')
          .upsert({
            user_id: user.id,
            todo_id: todoId,
            completed: true,
            completed_at: new Date().toISOString(),
          });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_todos')
          .update({ completed: false, completed_at: null })
          .eq('todo_id', todoId)
          .eq('user_id', user.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-todos'] });
    },
  });
}
