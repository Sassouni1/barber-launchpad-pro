import { useTodos } from '@/hooks/useTodos';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function TodoList() {
  const { data: todos = [], isLoading } = useTodos();

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
    <div className="glass-card p-6 rounded-xl">
      <h2 className="font-display text-xl font-semibold mb-4">Your To-Do List</h2>
      
      <Tabs defaultValue="daily" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-4">
          <TabsTrigger value="daily">Daily</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="course">Course</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="space-y-2">
          {groupedTodos.daily.length === 0 ? (
            <p className="text-sm text-muted-foreground">No daily tasks</p>
          ) : (
            groupedTodos.daily.map(todo => (
              <div key={todo.id} className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                <Checkbox id={todo.id} />
                <label htmlFor={todo.id} className="text-sm font-medium cursor-pointer">
                  {todo.title}
                </label>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="weekly" className="space-y-2">
          {groupedTodos.weekly.length === 0 ? (
            <p className="text-sm text-muted-foreground">No weekly tasks</p>
          ) : (
            groupedTodos.weekly.map(todo => (
              <div key={todo.id} className="flex items-center gap-3 p-3 bg-background/50 rounded-lg">
                <Checkbox id={todo.id} />
                <label htmlFor={todo.id} className="text-sm font-medium cursor-pointer">
                  {todo.title}
                </label>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="course" className="space-y-4">
          {weekGroups.every(w => w.todos.length === 0) ? (
            <p className="text-sm text-muted-foreground">No course tasks</p>
          ) : (
            weekGroups.map(({ week, todos }) => 
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
            )
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}