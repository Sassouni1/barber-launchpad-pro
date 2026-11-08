import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { useDynamicTodos } from "@/hooks/useDynamicTodos";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, PartyPopper, CheckCircle2, Play, AlertTriangle } from "lucide-react";
import confetti from "canvas-confetti";

export const DynamicTodoList = () => {
  const {
    currentList,
    completedRegularLists,
    completedListsCount,
    totalLists,
    allListsCompleted,
    allRegularCompleted,
    isOngoingList,
    isLoading,
    toggleItem,
  } = useDynamicTodos();
  const { user } = useAuth();

  // Fetch user's profile created_at to check if behind schedule
  const { data: profile } = useQuery({
    queryKey: ['profile-created', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  // Calculate if user is behind schedule
  const isBehindSchedule = (() => {
    if (!currentList || !profile?.created_at || !currentList.due_days) return false;
    const accountCreated = new Date(profile.created_at);
    const now = new Date();
    const daysSinceCreation = Math.floor((now.getTime() - accountCreated.getTime()) / (1000 * 60 * 60 * 24));
    return daysSinceCreation > currentList.due_days;
  })();

  const [showCelebration, setShowCelebration] = useState(false);
  const [previousListId, setPreviousListId] = useState<string | null>(null);

  // Detect when list changes (completed a list)
  useEffect(() => {
    if (currentList && previousListId && currentList.id !== previousListId) {
      // A new list appeared, meaning previous was completed
      triggerCelebration();
    }
    if (currentList) {
      setPreviousListId(currentList.id);
    }
  }, [currentList?.id]);

  // Detect when all lists are completed
  useEffect(() => {
    if (allListsCompleted && totalLists > 0) {
      triggerCelebration();
    }
  }, [allListsCompleted]);

  const triggerCelebration = () => {
    setShowCelebration(true);
    
    // Fire confetti
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ["#D4AF37", "#C9A227", "#FFD700"],
    });

    setTimeout(() => setShowCelebration(false), 3000);
  };

  const handleToggle = (itemId: string, currentCompleted: boolean) => {
    toggleItem({ itemId, completed: !currentCompleted });
  };

  if (isLoading) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-full"></div>
        </div>
      </div>
    );
  }

  if (totalLists === 0 && !currentList) {
    return null;
  }

  return (
    <div className="glass-card p-6 rounded-xl relative overflow-hidden">
      {/* Celebration overlay */}
      {showCelebration && (
        <div className="absolute inset-0 bg-primary/10 flex items-center justify-center z-10 animate-fade-in">
          <div className="text-center space-y-2">
            <PartyPopper className="h-12 w-12 text-primary mx-auto animate-bounce" />
            <p className="text-lg font-bold text-primary">List Completed!</p>
            <p className="text-sm text-muted-foreground">Great job! Moving to next list...</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">
            {isOngoingList ? 'Ongoing Marketing' : 'Your To-Do Lists'}
          </h3>
          {currentList && <span className="text-xs text-primary font-medium">— Please complete these!</span>}
        </div>
        {!isOngoingList && (
          <span className="text-xs text-muted-foreground">
            {completedListsCount} / {totalLists} lists completed
          </span>
        )}
      </div>

      <div className="max-h-[min(70vh,42rem)] overflow-y-auto pr-2 space-y-6" aria-label="Current and past to-do lists">
      {isBehindSchedule && !isOngoingList && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">
            You're behind schedule on this list. Try to catch up!
          </p>
        </div>
      )}

      {currentList ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {!isOngoingList && (
              <span className="text-sm font-medium text-primary">
                List {completedListsCount + 1}:
              </span>
            )}
            <span className="text-sm font-semibold text-foreground">{currentList.title}</span>
          </div>

          <div className="space-y-2">
            {currentList.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id={item.id}
                  checked={item.completed}
                  onCheckedChange={() => handleToggle(item.id, item.completed || false)}
                  className="h-4 w-4"
                />
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <label
                    htmlFor={item.id}
                    className={`text-sm cursor-pointer ${
                      item.completed
                        ? "line-through text-muted-foreground"
                        : "text-foreground"
                    }`}
                  >
                    {item.title}
                  </label>
                  {item.module_id && (
                    <Link
                      to={`/courses/lesson/${item.module_id}`}
                      className="text-xs text-primary underline flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Click here
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Progress bar for current list */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>
                {currentList.items.filter((i) => i.completed).length} /{" "}
                {currentList.items.length}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${
                    (currentList.items.filter((i) => i.completed).length /
                      currentList.items.length) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      {completedRegularLists.length > 0 && (
        <div className="space-y-4 border-t border-border/50 pt-5">
          <h4 className="text-sm font-semibold text-muted-foreground">Past lists</h4>
          {completedRegularLists.map((list, index) => (
            <div key={list.id} className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                <span>List {completedListsCount - index}: {list.title}</span>
              </div>
              <div className="space-y-2">
                {list.items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3 text-sm text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                    <span>{item.title}</span>
                    {item.module_id && (
                      <Link to={`/courses/lesson/${item.module_id}`} className="text-xs text-primary underline shrink-0">
                        Click here
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
};
