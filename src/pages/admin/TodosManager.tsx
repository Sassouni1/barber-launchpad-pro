import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useTodosWithSubtasks, useCreateTodo, useUpdateTodo, useDeleteTodo, useCreateSubtask, useDeleteSubtask, Todo } from '@/hooks/useTodos';
import { useCourses } from '@/hooks/useCourses';
import {
  useDynamicTodoLists,
  useCreateDynamicList,
  useUpdateDynamicList,
  useDeleteDynamicList,
  useCreateDynamicItem,
  useUpdateDynamicItem,
  useDeleteDynamicItem,
  type DynamicTodoList,
  type DynamicTodoItem,
} from '@/hooks/useDynamicTodosAdmin';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Pencil, Trash2, X, Sparkles, ChevronDown, ChevronRight, GripVertical, Loader2, Play } from 'lucide-react';
import { SelectGroup, SelectLabel } from '@/components/ui/select';

export default function TodosManager() {
  const { data: todos = [], isLoading } = useTodosWithSubtasks();
  const { data: courses = [] } = useCourses({ includeUnpublished: true });
  const createTodo = useCreateTodo();
  const updateTodo = useUpdateTodo();
  const deleteTodo = useDeleteTodo();
  const createSubtask = useCreateSubtask();
  const deleteSubtask = useDeleteSubtask();

  // Dynamic todos hooks
  const { data: dynamicLists, isLoading: dynamicLoading } = useDynamicTodoLists();
  const createDynamicList = useCreateDynamicList();
  const updateDynamicList = useUpdateDynamicList();
  const deleteDynamicList = useDeleteDynamicList();
  const createDynamicItem = useCreateDynamicItem();
  const updateDynamicItem = useUpdateDynamicItem();
  const deleteDynamicItem = useDeleteDynamicItem();

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

  // Dynamic todos state
  const [expandedDynamicList, setExpandedDynamicList] = useState<string | null>(null);
  const [showDynamicListDialog, setShowDynamicListDialog] = useState(false);
  const [showDynamicItemDialog, setShowDynamicItemDialog] = useState(false);
  const [editingDynamicList, setEditingDynamicList] = useState<DynamicTodoList | null>(null);
  const [selectedDynamicListId, setSelectedDynamicListId] = useState<string | null>(null);
  const [dynamicListForm, setDynamicListForm] = useState({ title: '', due_days: '' });
  const [dynamicItemForm, setDynamicItemForm] = useState({ title: '', module_id: '' });
  const [editingDynamicItem, setEditingDynamicItem] = useState<DynamicTodoItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'dynamic-list' | 'dynamic-item'; id: string; name: string } | null>(null);

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
      
      const existingSubtasks = editingTodo.subtasks || [];
      for (const existing of existingSubtasks) {
        if (!subtaskInputs.includes(existing.title)) {
          await deleteSubtask.mutateAsync({ id: existing.id, todoId: editingTodo.id });
        }
      }
      
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

  // Dynamic list handlers
  const openNewDynamicList = () => {
    setEditingDynamicList(null);
    setDynamicListForm({ title: '', due_days: '' });
    setShowDynamicListDialog(true);
  };

  const openEditDynamicList = (list: DynamicTodoList) => {
    setEditingDynamicList(list);
    setDynamicListForm({ title: list.title, due_days: list.due_days?.toString() || '' });
    setShowDynamicListDialog(true);
  };

  const handleSaveDynamicList = async () => {
    const dueDays = dynamicListForm.due_days ? parseInt(dynamicListForm.due_days) : null;
    if (editingDynamicList) {
      await updateDynamicList.mutateAsync({ id: editingDynamicList.id, title: dynamicListForm.title, due_days: dueDays });
    } else {
      const maxOrder = dynamicLists?.reduce((max, l) => Math.max(max, l.order_index), -1) ?? -1;
      await createDynamicList.mutateAsync({ title: dynamicListForm.title, order_index: maxOrder + 1, due_days: dueDays });
    }
    setShowDynamicListDialog(false);
  };

  const openNewDynamicItem = (listId: string) => {
    setSelectedDynamicListId(listId);
    setEditingDynamicItem(null);
    setDynamicItemForm({ title: '', module_id: '' });
    setShowDynamicItemDialog(true);
  };

  const openEditDynamicItem = (item: DynamicTodoItem) => {
    setSelectedDynamicListId(item.list_id);
    setEditingDynamicItem(item);
    setDynamicItemForm({ title: item.title, module_id: item.module_id || '' });
    setShowDynamicItemDialog(true);
  };

  const handleSaveDynamicItem = async () => {
    if (editingDynamicItem) {
      await updateDynamicItem.mutateAsync({
        id: editingDynamicItem.id,
        title: dynamicItemForm.title,
        module_id: dynamicItemForm.module_id || null,
      });
    } else if (selectedDynamicListId) {
      const list = dynamicLists?.find((l) => l.id === selectedDynamicListId);
      const maxOrder = list?.items.reduce((max, i) => Math.max(max, i.order_index), -1) ?? -1;
      await createDynamicItem.mutateAsync({
        list_id: selectedDynamicListId,
        title: dynamicItemForm.title,
        order_index: maxOrder + 1,
        module_id: dynamicItemForm.module_id || null,
      });
    }
    setShowDynamicItemDialog(false);
    setEditingDynamicItem(null);
  };

  const handleDeleteDynamic = async () => {
    if (!deleteTarget) return;
    if (deleteTarget.type === 'dynamic-list') {
      await deleteDynamicList.mutateAsync(deleteTarget.id);
    } else if (deleteTarget.type === 'dynamic-item') {
      await deleteDynamicItem.mutateAsync(deleteTarget.id);
    }
    setDeleteTarget(null);
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

  if (isLoading || dynamicLoading) {
    return (
      <DashboardLayout isAdminView>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout isAdminView>
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

        {/* Dynamic To-Do Lists Section */}
        <div className="pt-8 border-t border-border/30">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-primary" />
              <h2 className="font-display text-2xl font-bold">Dynamic To-Do Lists</h2>
            </div>
            <Button variant="outline" onClick={openNewDynamicList}>
              <Plus className="w-4 h-4 mr-2" />
              New List
            </Button>
          </div>

          {dynamicLists?.length === 0 && (
            <div className="glass-card rounded-2xl p-8 text-center">
              <p className="text-muted-foreground mb-4">No dynamic to-do lists yet.</p>
              <Button variant="outline" onClick={openNewDynamicList}>
                <Plus className="w-4 h-4 mr-2" />
                Create First List
              </Button>
            </div>
          )}

          <div className="space-y-4">
            {dynamicLists?.map((list, listIndex) => (
              <div
                key={list.id}
                className="glass-card rounded-2xl overflow-hidden animate-fade-up"
                style={{ animationDelay: `${listIndex * 0.1}s` }}
              >
                <button
                  onClick={() => setExpandedDynamicList(expandedDynamicList === list.id ? null : list.id)}
                  className="w-full p-6 flex items-center gap-4 hover:bg-secondary/20 transition-colors"
                >
                  <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
                  <div className="flex-1 text-left">
                    <h3 className="font-display text-xl font-semibold">{list.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {list.items.length} items
                      {list.due_days && <span className="ml-2">• Due within {list.due_days} days</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditDynamicList(list);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTarget({ type: 'dynamic-list', id: list.id, name: list.title });
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                    {expandedDynamicList === list.id ? (
                      <ChevronDown className="w-5 h-5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </button>

                {expandedDynamicList === list.id && (
                  <div className="border-t border-border/30">
                      {list.items.map((item) => (
                        <div
                          key={item.id}
                          className="px-6 py-4 flex items-center gap-4 hover:bg-secondary/10 transition-colors border-b border-border/20 last:border-b-0"
                        >
                          <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab ml-4" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{item.title}</div>
                            {item.module_id && (
                              <div className="flex items-center gap-1 text-xs text-primary">
                                <Play className="w-3 h-3" />
                                <span>Linked to lesson</span>
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditDynamicItem(item)}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget({ type: 'dynamic-item', id: item.id, name: item.title })}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}

                      <div className="p-4 ml-8">
                        <Button variant="outline" size="sm" onClick={() => openNewDynamicItem(list.id)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Item
                        </Button>
                      </div>
                    </div>
                  )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Dynamic List Dialog */}
      <Dialog open={showDynamicListDialog} onOpenChange={setShowDynamicListDialog}>
        <DialogContent className="glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editingDynamicList ? 'Edit List' : 'New Dynamic List'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>List Title</Label>
              <Input
                value={dynamicListForm.title}
                onChange={(e) => setDynamicListForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Week 1 Tasks"
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Due Within (days from signup)</Label>
              <Input
                type="number"
                value={dynamicListForm.due_days}
                onChange={(e) => setDynamicListForm(prev => ({ ...prev, due_days: e.target.value }))}
                placeholder="e.g., 7 for one week"
                className="bg-secondary/50"
                min="1"
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for no deadline. Members who haven't completed this list within this timeframe will show as behind.
              </p>
            </div>
            <Button
              className="w-full gold-gradient text-primary-foreground"
              onClick={handleSaveDynamicList}
              disabled={!dynamicListForm.title || createDynamicList.isPending || updateDynamicList.isPending}
            >
              {createDynamicList.isPending || updateDynamicList.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {editingDynamicList ? 'Save Changes' : 'Create List'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dynamic Item Dialog */}
      <Dialog open={showDynamicItemDialog} onOpenChange={(open) => {
        setShowDynamicItemDialog(open);
        if (!open) setEditingDynamicItem(null);
      }}>
        <DialogContent className="glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editingDynamicItem ? 'Edit Item' : 'New Item'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Item Title</Label>
              <Input
                value={dynamicItemForm.title}
                onChange={(e) => setDynamicItemForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Complete introduction video"
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Link to Lesson (optional)</Label>
              <Select
                value={dynamicItemForm.module_id || "none"}
                onValueChange={(v) => setDynamicItemForm(prev => ({ ...prev, module_id: v === "none" ? "" : v }))}
              >
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Select a lesson" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No lesson link</SelectItem>
                  {courses.map(course => (
                    <SelectGroup key={course.id}>
                      <SelectLabel className="text-xs text-muted-foreground">
                        {course.title}
                        {!course.is_published && <span className="ml-1 text-amber-500">(unpublished)</span>}
                      </SelectLabel>
                      {course.modules?.map(module => (
                        <SelectItem key={module.id} value={module.id}>
                          {module.title}
                          {!module.is_published && <span className="ml-1 text-amber-500">(unpublished)</span>}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Members will see a "Watch lesson" link next to this item
              </p>
            </div>
            <Button
              className="w-full gold-gradient text-primary-foreground"
              onClick={handleSaveDynamicItem}
              disabled={!dynamicItemForm.title || createDynamicItem.isPending || updateDynamicItem.isPending}
            >
              {(createDynamicItem.isPending || updateDynamicItem.isPending) ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              {editingDynamicItem ? 'Save Changes' : 'Add Item'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="glass-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type === 'dynamic-list' ? 'list' : 'item'}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDynamic}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}