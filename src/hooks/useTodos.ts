import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Subtask {
  id: string;
  todo_id: string;
  title: string;
  order_index: number;
  created_at: string;
  module_id: string | null;
}

export interface Todo {
  id: string;
  title: string;
  description: string | null;
  type: 'course' | 'daily' | 'weekly';
  week_number: number | null;
  course_id: string | null;
  module_id: string | null;
  order_index: number;
  created_at: string;
  updated_at: string;
  subtasks?: Subtask[];
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

export function useTodosWithSubtasks() {
  return useQuery({
    queryKey: ['todos-with-subtasks'],
    queryFn: async () => {
      const { data: todos, error: todosError } = await supabase
        .from('todos')
        .select('*')
        .order('week_number', { ascending: true })
        .order('order_index', { ascending: true });

      if (todosError) throw todosError;

      const { data: subtasks, error: subtasksError } = await supabase
        .from('todo_subtasks')
        .select('*')
        .order('order_index', { ascending: true });

      if (subtasksError) throw subtasksError;

      const todosWithSubtasks = (todos as Todo[]).map(todo => ({
        ...todo,
        subtasks: (subtasks as Subtask[]).filter(s => s.todo_id === todo.id),
      }));

      return todosWithSubtasks;
    },
  });
}

export function useSubtasks(todoId: string) {
  return useQuery({
    queryKey: ['subtasks', todoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('todo_subtasks')
        .select('*')
        .eq('todo_id', todoId)
        .order('order_index', { ascending: true });

      if (error) throw error;
      return data as Subtask[];
    },
    enabled: !!todoId,
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
    mutationFn: async (todo: Omit<Todo, 'id' | 'created_at' | 'updated_at' | 'subtasks'>) => {
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
      queryClient.invalidateQueries({ queryKey: ['todos-with-subtasks'] });
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
      const { subtasks, ...todoUpdates } = updates as any;
      const { data, error } = await supabase
        .from('todos')
        .update(todoUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todos'] });
      queryClient.invalidateQueries({ queryKey: ['todos-with-subtasks'] });
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
      queryClient.invalidateQueries({ queryKey: ['todos-with-subtasks'] });
      toast({ title: 'Todo deleted successfully' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete todo', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCreateSubtask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (subtask: { todo_id: string; title: string; order_index: number; module_id?: string | null }) => {
      const { data, error } = await supabase
        .from('todo_subtasks')
        .insert(subtask)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', variables.todo_id] });
      queryClient.invalidateQueries({ queryKey: ['todos-with-subtasks'] });
      toast({ title: 'Subtask added' });
    },
    onError: (error) => {
      toast({ title: 'Failed to add subtask', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteSubtask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, todoId }: { id: string; todoId: string }) => {
      const { error } = await supabase
        .from('todo_subtasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return todoId;
    },
    onSuccess: (todoId) => {
      queryClient.invalidateQueries({ queryKey: ['subtasks', todoId] });
      queryClient.invalidateQueries({ queryKey: ['todos-with-subtasks'] });
      toast({ title: 'Subtask deleted' });
    },
    onError: (error) => {
      toast({ title: 'Failed to delete subtask', description: error.message, variant: 'destructive' });
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
