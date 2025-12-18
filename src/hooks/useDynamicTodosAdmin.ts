import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface DynamicTodoItem {
  id: string;
  list_id: string;
  title: string;
  order_index: number;
  module_id: string | null;
}

export interface DynamicTodoList {
  id: string;
  title: string;
  order_index: number;
  due_days: number | null;
  items: DynamicTodoItem[];
}

export const useDynamicTodoLists = () => {
  return useQuery({
    queryKey: ["admin-dynamic-todos"],
    queryFn: async () => {
      const { data: lists, error: listsError } = await supabase
        .from("dynamic_todo_lists")
        .select("*")
        .order("order_index");

      if (listsError) throw listsError;

      const { data: items, error: itemsError } = await supabase
        .from("dynamic_todo_items")
        .select("*")
        .order("order_index");

      if (itemsError) throw itemsError;

      const listsWithItems: DynamicTodoList[] = lists.map((list) => ({
        ...list,
        due_days: (list as any).due_days ?? null,
        items: items.filter((item) => item.list_id === list.id),
      }));

      return listsWithItems;
    },
  });
};

export const useCreateDynamicList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; order_index: number; due_days?: number | null }) => {
      const { data: result, error } = await supabase
        .from("dynamic_todo_lists")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dynamic-todos"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-todos"] });
    },
  });
};

export const useUpdateDynamicList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title: string; due_days?: number | null }) => {
      const { error } = await supabase
        .from("dynamic_todo_lists")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dynamic-todos"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-todos"] });
    },
  });
};

export const useDeleteDynamicList = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dynamic_todo_lists")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dynamic-todos"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-todos"] });
    },
  });
};

export const useCreateDynamicItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      list_id: string;
      title: string;
      order_index: number;
      module_id?: string | null;
    }) => {
      const { data: result, error } = await supabase
        .from("dynamic_todo_items")
        .insert(data)
        .select()
        .single();

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dynamic-todos"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-todos"] });
    },
  });
};

export const useUpdateDynamicItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; title: string; module_id?: string | null }) => {
      const { error } = await supabase
        .from("dynamic_todo_items")
        .update(data)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dynamic-todos"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-todos"] });
    },
  });
};

export const useDeleteDynamicItem = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("dynamic_todo_items")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dynamic-todos"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-todos"] });
    },
  });
};

export const useReorderDynamicLists = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (lists: { id: string; order_index: number }[]) => {
      const updates = lists.map(({ id, order_index }) =>
        supabase
          .from("dynamic_todo_lists")
          .update({ order_index })
          .eq("id", id)
      );

      const results = await Promise.all(updates);
      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dynamic-todos"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-todos"] });
    },
  });
};

export const useReorderDynamicItems = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (items: { id: string; order_index: number }[]) => {
      const updates = items.map(({ id, order_index }) =>
        supabase
          .from("dynamic_todo_items")
          .update({ order_index })
          .eq("id", id)
      );

      const results = await Promise.all(updates);
      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-dynamic-todos"] });
      queryClient.invalidateQueries({ queryKey: ["dynamic-todos"] });
    },
  });
};
