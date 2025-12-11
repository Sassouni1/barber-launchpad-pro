import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo, Todo } from '@/hooks/useTodos';
import { useCourses } from '@/hooks/useCourses';
import { Plus, Pencil, Trash2, ListTodo } from 'lucide-react';

export default function TodosManager() {
  const { data: todos = [], isLoading } = useTodos();
  const { data: courses = [] } = useCourses();
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'course' as 'course' | 'daily' | 'weekly',
    week_number: 1,
    course_id: '',
  });

  const resetForm = () => {
    setFormData({ title: '', description: '', type: 'course', week_number: 1, course_id: '' });
    setEditingTodo(null);
  };

  const handleOpenDialog = (todo?: Todo) => {
    if (todo) {
      setEditingTodo(todo);
      setFormData({
        title: todo.title,
        description: todo.description || '',
        type: todo.type,
        week_number: todo.week_number || 1,
        course_id: todo.course_id || '',
      });
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: formData.title,
      description: formData.description || null,
      type: formData.type,
      week_number: formData.type === 'course' ? formData.week_number : null,
      course_id: formData.type === 'course' && formData.course_id ? formData.course_id : null,
      order_index: 0,
    };

    if (editingTodo) {
      await updateTodo.mutateAsync({ id: editingTodo.id, ...payload });
    } else {
      await createTodo.mutateAsync(payload);
    }
    setIsDialogOpen(false);
    resetForm();
  };

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
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold">Manage Todos</h1>
            <p className="text-muted-foreground">Create tasks for course weeks and daily/weekly checklists</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="w-4 h-4 mr-2" /> Add Todo
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingTodo ? 'Edit Todo' : 'Create Todo'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  placeholder="Todo title"
                  value={formData.title}
                  onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                  required
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={formData.description}
                  onChange={e => setFormData(p => ({ ...p, description: e.target.value }))}
                />
                <Select
                  value={formData.type}
                  onValueChange={(v: 'course' | 'daily' | 'weekly') => setFormData(p => ({ ...p, type: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course">Course Task</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>

                {formData.type === 'course' && (
                  <>
                    <Select
                      value={String(formData.week_number)}
                      onValueChange={v => setFormData(p => ({ ...p, week_number: Number(v) }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Week" />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(w => (
                          <SelectItem key={w} value={String(w)}>Week {w}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select
                      value={formData.course_id || "none"}
                      onValueChange={v => setFormData(p => ({ ...p, course_id: v === "none" ? "" : v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Link to course (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No course</SelectItem>
                        {courses.map(c => (
                          <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </>
                )}

                <Button type="submit" className="w-full">
                  {editingTodo ? 'Update' : 'Create'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Course Tasks by Week */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Course Tasks</h2>
          {weekGroups.map(({ week, todos }) => (
            <div key={week} className="glass-card p-4 rounded-xl">
              <h3 className="font-medium mb-3">Week {week}</h3>
              {todos.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks for this week</p>
              ) : (
                <div className="space-y-2">
                  {todos.map(todo => (
                    <div key={todo.id} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                      <div>
                        <p className="font-medium">{todo.title}</p>
                        {todo.description && <p className="text-sm text-muted-foreground">{todo.description}</p>}
                      </div>
                      <div className="flex gap-2">
                        <Button size="icon" variant="ghost" onClick={() => handleOpenDialog(todo)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteTodo.mutate(todo.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Daily & Weekly */}
        <div className="grid md:grid-cols-2 gap-6">
          <div className="glass-card p-4 rounded-xl">
            <h2 className="text-lg font-semibold mb-3">Daily Tasks</h2>
            {groupedTodos.daily.length === 0 ? (
              <p className="text-sm text-muted-foreground">No daily tasks</p>
            ) : (
              <div className="space-y-2">
                {groupedTodos.daily.map(todo => (
                  <div key={todo.id} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <p className="font-medium">{todo.title}</p>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleOpenDialog(todo)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteTodo.mutate(todo.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="glass-card p-4 rounded-xl">
            <h2 className="text-lg font-semibold mb-3">Weekly Tasks</h2>
            {groupedTodos.weekly.length === 0 ? (
              <p className="text-sm text-muted-foreground">No weekly tasks</p>
            ) : (
              <div className="space-y-2">
                {groupedTodos.weekly.map(todo => (
                  <div key={todo.id} className="flex items-center justify-between p-3 bg-background/50 rounded-lg">
                    <p className="font-medium">{todo.title}</p>
                    <div className="flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleOpenDialog(todo)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteTodo.mutate(todo.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
