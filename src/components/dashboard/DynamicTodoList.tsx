import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { useDynamicTodos } from "@/hooks/useDynamicTodos";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sparkles, PartyPopper, CheckCircle2, Play, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [pastOffset, setPastOffset] = useState(0);

  useEffect(() => {
    setPastOffset(0);
  }, [currentList?.id]);

  const availableLists = currentList ? [currentList, ...completedRegularLists] : completedRegularLists;
  const visibleOffset = Math.min(pastOffset, Math.max(0, availableLists.length - 1));
  const visibleList = availableLists[visibleOffset];
  const viewingPast = !currentList || visibleOffset > 0;
  const visibleListNumber = viewingPast
    ? completedListsCount - visibleOffset + (currentList ? 1 : 0)
    : completedListsCount + 1;

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

  if (availableLists.length === 0) {
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

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">
            {isOngoingList && !viewingPast ? 'Ongoing Marketing' : 'Your To-Do List'}
          </h3>
          {!viewingPast && <span className="text-xs text-primary font-medium ml-1">— Please complete these!</span>}
        </div>
      </div>

      {isBehindSchedule && !isOngoingList && !viewingPast && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-xs text-destructive">
            You're behind schedule on this list. Try to catch up!
          </p>
        </div>
      )}

      {visibleList ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            {(!isOngoingList || viewingPast) && (
              <span className="text-sm font-medium text-primary">
                List {visibleListNumber}:
              </span>
            )}
            <span className="text-sm font-semibold text-foreground">{visibleList.title}</span>
          </div>

          <div className="space-y-2">
            {visibleList.items.map((item) => (
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
                {visibleList.items.filter((i) => i.completed).length} /{" "}
                {visibleList.items.length}
              </span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{
                  width: `${
                    (visibleList.items.filter((i) => i.completed).length /
                      visibleList.items.length) *
                    100
                  }%`,
                }}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 flex items-center justify-center gap-4 text-muted-foreground">
        <button
          type="button"
          aria-label="Previous list"
          onClick={() => setPastOffset((offset) => Math.min(offset + 1, availableLists.length - 1))}
          disabled={visibleOffset >= availableLists.length - 1}
          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-sm">{completedListsCount}/{totalLists}</span>
        <button
          type="button"
          aria-label="Next list"
          onClick={() => setPastOffset((offset) => Math.max(0, offset - 1))}
          disabled={visibleOffset === 0}
          className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
};
