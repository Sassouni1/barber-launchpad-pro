import { Link } from 'react-router-dom';
import { useTodosWithSubtasks } from '@/hooks/useTodos';
import { useDynamicTodos } from '@/hooks/useDynamicTodos';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, Lock } from 'lucide-react';

export function TodoList() {
  const { data: todos = [], isLoading } = useTodosWithSubtasks();
  const { allListsCompleted, totalLists, isLoading: dynamicLoading } = useDynamicTodos();

  const groupedTodos = {
    course: todos.filter(t => t.type === 'course'),
    daily: todos.filter(t => t.type === 'daily'),
    weekly: todos.filter(t => t.type === 'weekly'),
  };

  const weekGroups = [1, 2, 3, 4, 5].map(week => ({
    week,
    todos: groupedTodos.course.filter(t => t.week_number === week),
  }));

  const isLocked = totalLists > 0 && !allListsCompleted;

  if (isLoading || dynamicLoading) {
    return (
      <div className="glass-card p-6 rounded-xl">
        <div className="animate-pulse space-y-3">
          <div className="h-6 bg-muted rounded w-1/3" />
          <div className="h-4 bg-muted rounded w-full" />
          <div className="h-4 bg-muted rounded w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 rounded-xl space-y-6">
      <h2 className="font-display text-xl font-semibold">Your To-Do List</h2>

      {/* Daily Tasks */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
          Daily
          {isLocked && <Lock className="w-3.5 h-3.5 text-primary" />}
        </h3>

        {isLocked ? (
          <p className="text-sm text-foreground/70">Complete your dynamic to-do lists to unlock daily tasks.</p>
        ) : groupedTodos.daily.length === 0 ? (
          <p className="text-sm text-muted-foreground/60">No daily tasks</p>
        ) : (
          <div className="space-y-2">
            {groupedTodos.daily.map(todo => (
              <div key={todo.id} className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                <Checkbox id={todo.id} />
                <div className="flex-1 flex items-center gap-2">
                  <label htmlFor={todo.id} className="text-sm font-medium cursor-pointer">
                    {todo.title}
                  </label>
                  {todo.module_id && (
                    <Link
                      to={`/courses/lesson/${todo.module_id}`}
                      className="text-xs text-primary underline flex items-center gap-1 shrink-0"
                    >
                      <Play className="w-3 h-3" />
                      Watch lesson
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Tasks */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2 flex items-center gap-2">
          Weekly
          {isLocked && <Lock className="w-3.5 h-3.5 text-primary" />}
        </h3>

        {isLocked ? (
          <p className="text-sm text-foreground/70">Complete your dynamic to-do lists to unlock weekly tasks.</p>
        ) : groupedTodos.weekly.length === 0 ? (
          <p className="text-sm text-muted-foreground/60">No weekly tasks</p>
        ) : (
          <div className="space-y-2">
            {groupedTodos.weekly.map(todo => (
              <div key={todo.id} className="p-3 bg-background/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox id={todo.id} />
                  <div className="flex-1 flex items-center gap-2">
                    <label htmlFor={todo.id} className="text-sm font-medium cursor-pointer">
                      {todo.title}
                    </label>
                    {todo.module_id && (
                      <Link
                        to={`/courses/lesson/${todo.module_id}`}
                        className="text-xs text-primary underline flex items-center gap-1 shrink-0"
                      >
                        <Play className="w-3 h-3" />
                        Watch lesson
                      </Link>
                    )}
                  </div>
                </div>
                {todo.subtasks && todo.subtasks.length > 0 && (
                  <div className="ml-8 mt-2 space-y-1.5">
                    {todo.subtasks.map((subtask, index) => (
                      <div key={subtask.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Checkbox id={subtask.id} className="h-3.5 w-3.5" />
                        <div className="flex-1 flex items-center gap-2">
                          <label htmlFor={subtask.id} className="cursor-pointer">
                            {index + 1}. {subtask.title}
                          </label>
                          {subtask.module_id && (
                            <Link
                              to={`/courses/lesson/${subtask.module_id}`}
                              className="text-xs text-primary underline flex items-center gap-1 shrink-0"
                            >
                              <Play className="w-3 h-3" />
                              Watch
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Course Tasks by Week */}
      {weekGroups.map(({ week, todos }) => 
        todos.length > 0 && (
          <div key={week}>
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Week {week}</h3>
            <div className="space-y-2">
              {todos.map(todo => (
                <div key={todo.id} className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                  <Checkbox id={todo.id} />
                  <label htmlFor={todo.id} className="text-sm font-medium cursor-pointer">
                    {todo.title}
                  </label>
                </div>
              ))}
            </div>
          </div>
        )
      )}
    </div>
  );
}