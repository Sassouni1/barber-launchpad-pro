import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { useDynamicTodos } from "@/hooks/useDynamicTodos";
import { Sparkles, PartyPopper, CheckCircle2, Play } from "lucide-react";
import confetti from "canvas-confetti";

export const DynamicTodoList = () => {
  const {
    currentList,
    completedListsCount,
    totalLists,
    allListsCompleted,
    isLoading,
    toggleItem,
  } = useDynamicTodos();

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

  if (totalLists === 0) {
    return null; // Don't render if no dynamic lists exist
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
          <h3 className="font-semibold text-foreground">Dynamic To-Do List</h3>
        </div>
        <span className="text-xs text-muted-foreground">
          {completedListsCount} / {totalLists} lists completed
        </span>
      </div>

      {allListsCompleted ? (
        <div className="text-center py-6 space-y-2">
          <CheckCircle2 className="h-10 w-10 text-primary mx-auto" />
          <p className="font-medium text-foreground">All Lists Completed!</p>
          <p className="text-sm text-muted-foreground">You've completed all dynamic to-do lists.</p>
        </div>
      ) : currentList ? (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary">
              List {completedListsCount + 1}:
            </span>
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
                      to={`/lesson/${item.module_id}`}
                      className="text-xs text-primary underline flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Play className="w-3 h-3" />
                      Watch lesson
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
    </div>
  );
};
