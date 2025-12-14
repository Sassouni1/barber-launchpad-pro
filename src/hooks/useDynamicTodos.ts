import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface DynamicTodoItem {
  id: string;
  list_id: string;
  title: string;
  order_index: number;
  completed?: boolean;
}

interface DynamicTodoList {
  id: string;
  title: string;
  order_index: number;
  items: DynamicTodoItem[];
}

export const useDynamicTodos = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["dynamic-todos", user?.id],
    queryFn: async () => {
      // Fetch all lists with their items
      const { data: listsData, error: listsError } = await supabase
        .from("dynamic_todo_lists")
        .select("*")
        .order("order_index");

      if (listsError) throw listsError;

      const { data: itemsData, error: itemsError } = await supabase
        .from("dynamic_todo_items")
        .select("*")
        .order("order_index");

      if (itemsError) throw itemsError;

      // Fetch user's progress
      let progressData: { item_id: string; completed: boolean }[] = [];
      if (user) {
        const { data, error: progressError } = await supabase
          .from("user_dynamic_todo_progress")
          .select("item_id, completed")
          .eq("user_id", user.id);

        if (!progressError && data) {
          progressData = data;
        }
      }

      const progressMap = new Map(
        progressData.map((p) => [p.item_id, p.completed])
      );

      // Combine data
      const listsWithItems: DynamicTodoList[] = listsData.map((list) => ({
        ...list,
        items: itemsData
          .filter((item) => item.list_id === list.id)
          .map((item) => ({
            ...item,
            completed: progressMap.get(item.id) || false,
          })),
      }));

      return listsWithItems;
    },
    enabled: true,
  });

  const toggleItemMutation = useMutation({
    mutationFn: async ({
      itemId,
      completed,
    }: {
      itemId: string;
      completed: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data: existing } = await supabase
        .from("user_dynamic_todo_progress")
        .select("id")
        .eq("user_id", user.id)
        .eq("item_id", itemId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("user_dynamic_todo_progress")
          .update({
            completed,
            completed_at: completed ? new Date().toISOString() : null,
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("user_dynamic_todo_progress")
          .insert({
            user_id: user.id,
            item_id: itemId,
            completed,
            completed_at: completed ? new Date().toISOString() : null,
          });

        if (error) throw error;
      }
    },
    onMutate: async ({ itemId, completed }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["dynamic-todos", user?.id] });

      // Snapshot previous value
      const previousLists = queryClient.getQueryData<DynamicTodoList[]>(["dynamic-todos", user?.id]);

      // Optimistically update the cache
      queryClient.setQueryData<DynamicTodoList[]>(["dynamic-todos", user?.id], (old) => {
        if (!old) return old;
        return old.map((list) => ({
          ...list,
          items: list.items.map((item) =>
            item.id === itemId ? { ...item, completed } : item
          ),
        }));
      });

      return { previousLists };
    },
    onError: (_err, _variables, context) => {
      // Rollback on error
      if (context?.previousLists) {
        queryClient.setQueryData(["dynamic-todos", user?.id], context.previousLists);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["dynamic-todos"] });
    },
  });

  // Find the current active list (first incomplete list)
  const currentListIndex = lists.findIndex(
    (list) => !list.items.every((item) => item.completed)
  );

  const currentList = currentListIndex >= 0 ? lists[currentListIndex] : null;
  const completedListsCount = currentListIndex >= 0 ? currentListIndex : lists.length;
  const totalLists = lists.length;
  const allListsCompleted = lists.length > 0 && lists.every(
    (list) => list.items.every((item) => item.completed)
  );

  return {
    lists,
    currentList,
    completedListsCount,
    totalLists,
    allListsCompleted,
    isLoading,
    toggleItem: toggleItemMutation.mutate,
    isToggling: toggleItemMutation.isPending,
  };
};
