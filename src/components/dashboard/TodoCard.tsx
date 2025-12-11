import { useState } from 'react';
import { TodoItem } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Plus, BookOpen, User, CheckCircle2, Target, Crosshair } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

interface TodoCardProps {
  title: string;
  todos: TodoItem[];
  type: 'daily' | 'weekly';
}

export function TodoCard({ title, todos: initialTodos, type }: TodoCardProps) {
  const [todos, setTodos] = useState(initialTodos);
  const [isAdding, setIsAdding] = useState(false);
  const [newTodo, setNewTodo] = useState('');

  const completedCount = todos.filter((t) => t.completed).length;
  const progress = Math.round((completedCount / todos.length) * 100);

  const toggleTodo = (id: string) => {
    setTodos(todos.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
  };

  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos([
      ...todos,
      {
        id: `new-${Date.now()}`,
        title: newTodo,
        completed: false,
        type: 'personal',
      },
    ]);
    setNewTodo('');
    setIsAdding(false);
  };

  const Icon = type === 'daily' ? Crosshair : Target;

  return (
    <div 
      className="glass-card cyber-corners p-6 rounded-xl animate-fade-up hover-lift" 
      style={{ animationDelay: type === 'daily' ? '0.3s' : '0.4s' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center gold-glow-subtle">
            <Icon className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-lg tracking-tight">{title}</h3>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mt-0.5">
              {completedCount}/{todos.length} Complete
            </p>
          </div>
        </div>
        
        {/* Progress ring */}
        <div className="relative w-14 h-14">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
            <path
              className="text-secondary"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
            <path
              className="text-primary"
              stroke="currentColor"
              strokeWidth="3"
              fill="none"
              strokeDasharray={`${progress}, 100`}
              strokeLinecap="round"
              style={{
                filter: 'drop-shadow(0 0 4px hsl(var(--gold) / 0.5))'
              }}
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-primary">
            {progress}%
          </span>
        </div>
      </div>

      {/* Todo list */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
        {todos.map((todo) => (
          <div
            key={todo.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg transition-all duration-300 border',
              todo.completed 
                ? 'bg-primary/5 border-primary/20 opacity-60' 
                : 'bg-secondary/30 border-border/30 hover:border-primary/30 hover:bg-secondary/50'
            )}
          >
            <Checkbox
              checked={todo.completed}
              onCheckedChange={() => toggleTodo(todo.id)}
              className={cn(
                'mt-0.5 border-2 transition-all duration-300',
                todo.completed && 'bg-primary border-primary data-[state=checked]:bg-primary'
              )}
            />
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-sm font-medium transition-all duration-300',
                todo.completed && 'line-through text-muted-foreground'
              )}>
                {todo.title}
              </p>
              <div className="flex items-center gap-1.5 mt-1.5">
                {todo.type === 'course' ? (
                  <BookOpen className="w-3 h-3 text-primary" />
                ) : (
                  <User className="w-3 h-3 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{todo.type}</span>
              </div>
            </div>
            {todo.completed && <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" />}
          </div>
        ))}
      </div>

      {/* Add todo */}
      {isAdding ? (
        <div className="mt-4 flex gap-2">
          <Input
            value={newTodo}
            onChange={(e) => setNewTodo(e.target.value)}
            placeholder="Add a personal goal..."
            className="bg-secondary/50 border-border/50 focus:border-primary"
            onKeyDown={(e) => e.key === 'Enter' && addTodo()}
            autoFocus
          />
          <Button size="sm" onClick={addTodo} className="gold-gradient text-primary-foreground font-semibold">
            Add
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setIsAdding(false)} className="text-muted-foreground">
            Cancel
          </Button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="sm"
          className="mt-4 w-full text-muted-foreground hover:text-primary hover:bg-primary/10 border border-dashed border-border/50 hover:border-primary/50"
          onClick={() => setIsAdding(true)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Personal Goal
        </Button>
      )}
    </div>
  );
}
