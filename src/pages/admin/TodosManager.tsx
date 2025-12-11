import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useTodosWithSubtasks, useCreateTodo, useUpdateTodo, useDeleteTodo, useCreateSubtask, useDeleteSubtask, Todo, Subtask } from '@/hooks/useTodos';
import { useCourses } from '@/hooks/useCourses';
import { Plus, Pencil, Trash2, ListTodo, X } from 'lucide-react';

export default function TodosManager() {
  const { data: todos = [], isLoading } = useTodosWithSubtasks();
  const { data: courses = [] } = useCourses();
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const createSubtask = useCreateSubtask();
  const deleteSubtask = useDeleteSubtask();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTodo, setEditingTodo] = useState<Todo | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'course' as 'course' | 'daily' | 'weekly',
    week_number: 1,
    course_id: '',
  });
  const [subtaskInputs, setSubtaskInputs] = useState<string[]>([]);
  const [newSubtaskInput, setNewSubtaskInput] = useState('');

  const resetForm = () => {
    setFormData({ title: '', description: '', type: 'course', week_number: 1, course_id: '' });
    setEditingTodo(null);
    setSubtaskInputs([]);
    setNewSubtaskInput('');
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
      setSubtaskInputs(todo.subtasks?.map(s => s.title) || []);
    } else {
      resetForm();
    }
    setIsDialogOpen(true);
  };

  const handleAddSubtask = () => {
    if (newSubtaskInput.trim()) {
      setSubtaskInputs([...subtaskInputs, newSubtaskInput.trim()]);
      setNewSubtaskInput('');
    }
  };

  const handleRemoveSubtask = (index: number) => {
    setSubtaskInputs(subtaskInputs.filter((_, i) => i !== index));
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
      
      // Delete removed subtasks
      const existingSubtasks = editingTodo.subtasks || [];
      for (const existing of existingSubtasks) {
        if (!subtaskInputs.includes(existing.title)) {
          await deleteSubtask.mutateAsync({ id: existing.id, todoId: editingTodo.id });
        }
      }
      
      // Add new subtasks
      const existingTitles = existingSubtasks.map(s => s.title);
      for (let i = 0; i < subtaskInputs.length; i++) {
        if (!existingTitles.includes(subtaskInputs[i])) {
          await createSubtask.mutateAsync({
            todo_id: editingTodo.id,
            title: subtaskInputs[i],
            order_index: i,
          });
        }
      }
    } else {
      const newTodo = await createTodo.mutateAsync(payload);
      // Add subtasks for new todo
      for (let i = 0; i < subtaskInputs.length; i++) {
        await createSubtask.mutateAsync({
          todo_id: newTodo.id,
          title: subtaskInputs[i],
          order_index: i,
        });
      }
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

  const renderTodoItem = (todo: Todo) => (
    <div key={todo.id} className="p-3 bg-background/50 rounded-lg">
      <div className="flex items-center justify-between">
        <div className="flex-1">
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
      {todo.subtasks && todo.subtasks.length > 0 && (
        <div className="mt-2 ml-4 space-y-1">
          {todo.subtasks.map((subtask, index) => (
            <div key={subtask.id} className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="text-primary">{index + 1}.</span>
              <span>{subtask.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

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
            <DialogContent className="max-w-lg">
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

                {/* Subtasks Section */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">Subtasks</label>
                  {subtaskInputs.length > 0 && (
                    <div className="space-y-2">
                      {subtaskInputs.map((subtask, index) => (
                        <div key={index} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
                          <span className="text-sm text-primary font-medium">{index + 1}.</span>
                          <span className="flex-1 text-sm">{subtask}</span>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-6 w-6"
                            onClick={() => handleRemoveSubtask(index)}
                          >
                            <X className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      placeholder="Add a subtask..."
                      value={newSubtaskInput}
                      onChange={e => setNewSubtaskInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddSubtask();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={handleAddSubtask}>
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

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
                  {todos.map(renderTodoItem)}
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
                {groupedTodos.daily.map(renderTodoItem)}
              </div>
            )}
          </div>

          <div className="glass-card p-4 rounded-xl">
            <h2 className="text-lg font-semibold mb-3">Weekly Tasks</h2>
            {groupedTodos.weekly.length === 0 ? (
              <p className="text-sm text-muted-foreground">No weekly tasks</p>
            ) : (
              <div className="space-y-2">
                {groupedTodos.weekly.map(renderTodoItem)}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
