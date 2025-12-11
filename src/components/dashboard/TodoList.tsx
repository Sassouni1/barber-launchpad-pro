import { useTodosWithSubtasks } from '@/hooks/useTodos';
import { Checkbox } from '@/components/ui/checkbox';

export function TodoList() {
  const { data: todos = [], isLoading } = useTodosWithSubtasks();

  const groupedTodos = {
    course: todos.filter(t => t.type === 'course'),
    daily: todos.filter(t => t.type === 'daily'),
    weekly: todos.filter(t => t.type === 'weekly'),
  };

  const weekGroups = [1, 2, 3, 4, 5].map(week => ({
    week,
    todos: groupedTodos.course.filter(t => t.week_number === week),
  }));

  if (isLoading) {
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
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Daily</h3>
        {groupedTodos.daily.length === 0 ? (
          <p className="text-sm text-muted-foreground/60">No daily tasks</p>
        ) : (
          <div className="space-y-2">
            {groupedTodos.daily.map(todo => (
              <div key={todo.id} className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                <Checkbox id={todo.id} />
                <label htmlFor={todo.id} className="text-sm font-medium cursor-pointer">
                  {todo.title}
                </label>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weekly Tasks */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-2">Weekly</h3>
        {groupedTodos.weekly.length === 0 ? (
          <p className="text-sm text-muted-foreground/60">No weekly tasks</p>
        ) : (
          <div className="space-y-2">
            {groupedTodos.weekly.map(todo => (
              <div key={todo.id} className="p-3 bg-background/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Checkbox id={todo.id} />
                  <label htmlFor={todo.id} className="text-sm font-medium cursor-pointer">
                    {todo.title}
                  </label>
                </div>
                {todo.subtasks && todo.subtasks.length > 0 && (
                  <div className="ml-8 mt-2 space-y-1.5">
                    {todo.subtasks.map((subtask, index) => (
                      <div key={subtask.id} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="text-xs">{index + 1}.</span>
                        <span>{subtask.title}</span>
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