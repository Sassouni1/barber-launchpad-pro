import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  Video,
  FileText,
  HelpCircle,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Loader2,
  Upload,
} from 'lucide-react';
import { ModuleFilesManager } from '@/components/admin/ModuleFilesManager';
import { QuizManager } from '@/components/admin/QuizManager';
import {
  useCourses,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
  useCreateModule,
  useUpdateModule,
  useDeleteModule,
  type CourseWithModules,
  type Module,
} from '@/hooks/useCourses';
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

export default function CourseBuilder() {
  const { data: courses, isLoading, error } = useCourses();
  const createCourse = useCreateCourse();
  const updateCourse = useUpdateCourse();
  const deleteCourse = useDeleteCourse();
  const createModule = useCreateModule();
  const updateModule = useUpdateModule();
  const deleteModule = useDeleteModule();

  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);

  // Dialog states
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [showModuleDialog, setShowModuleDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseWithModules | null>(null);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'course' | 'module'; id: string; name: string } | null>(null);

  // Files/Quiz manager
  const [filesManagerModule, setFilesManagerModule] = useState<{ id: string; name: string } | null>(null);
  const [quizManagerModule, setQuizManagerModule] = useState<{ id: string; name: string } | null>(null);

  // Form states
  const [courseForm, setCourseForm] = useState({ title: '', description: '' });
  const [moduleForm, setModuleForm] = useState({
    title: '',
    description: '',
    video_url: '',
    duration: '',
    has_download: false,
    has_quiz: false,
    has_homework: false,
  });

  // Course handlers
  const openNewCourse = () => {
    setEditingCourse(null);
    setCourseForm({ title: '', description: '' });
    setShowCourseDialog(true);
  };

  const openEditCourse = (course: CourseWithModules) => {
    setEditingCourse(course);
    setCourseForm({ title: course.title, description: course.description || '' });
    setShowCourseDialog(true);
  };

  const handleSaveCourse = async () => {
    if (editingCourse) {
      await updateCourse.mutateAsync({ id: editingCourse.id, ...courseForm });
    } else {
      const maxOrder = courses?.reduce((max, c) => Math.max(max, c.order_index), -1) ?? -1;
      await createCourse.mutateAsync({ ...courseForm, order_index: maxOrder + 1 });
    }
    setShowCourseDialog(false);
  };

  // Module handlers
  const openNewModule = (courseId: string) => {
    setSelectedCourseId(courseId);
    setEditingModule(null);
    setModuleForm({ title: '', description: '', video_url: '', duration: '', has_download: false, has_quiz: false, has_homework: false });
    setShowModuleDialog(true);
  };

  const openEditModule = (module: Module) => {
    setEditingModule(module);
    setModuleForm({
      title: module.title,
      description: module.description || '',
      video_url: module.video_url || '',
      duration: module.duration || '',
      has_download: module.has_download ?? false,
      has_quiz: module.has_quiz ?? false,
      has_homework: module.has_homework ?? false,
    });
    setShowModuleDialog(true);
  };

  const handleSaveModule = async () => {
    if (editingModule) {
      await updateModule.mutateAsync({ id: editingModule.id, ...moduleForm });
    } else if (selectedCourseId) {
      const course = courses?.find((c) => c.id === selectedCourseId);
      const maxOrder = course?.modules.reduce((max, m) => Math.max(max, m.order_index), -1) ?? -1;
      await createModule.mutateAsync({ course_id: selectedCourseId, ...moduleForm, order_index: maxOrder + 1 });
    }
    setShowModuleDialog(false);
  };

  // Delete handlers
  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    if (deleteTarget.type === 'course') {
      await deleteCourse.mutateAsync(deleteTarget.id);
    } else {
      await deleteModule.mutateAsync(deleteTarget.id);
    }
    setDeleteTarget(null);
  };

  if (isLoading) {
    return (
      <DashboardLayout isAdmin>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout isAdmin>
        <div className="text-center py-12">
          <p className="text-destructive">Failed to load courses. Please try again.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout isAdmin>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between animate-fade-up">
          <div>
            <h1 className="font-display text-4xl font-bold mb-2">Course Builder</h1>
            <p className="text-muted-foreground text-lg">Create and manage your course content.</p>
          </div>
          <Button className="gold-gradient text-primary-foreground" onClick={openNewCourse}>
            <Plus className="w-4 h-4 mr-2" />
            New Course
          </Button>
        </div>

        {/* Empty state */}
        {courses?.length === 0 && (
          <div className="glass-card rounded-2xl p-12 text-center animate-fade-up">
            <p className="text-muted-foreground mb-4">No courses yet. Create your first course to get started.</p>
            <Button className="gold-gradient text-primary-foreground" onClick={openNewCourse}>
              <Plus className="w-4 h-4 mr-2" />
              Create First Course
            </Button>
          </div>
        )}

        {/* Courses list */}
        <div className="space-y-4">
          {courses?.map((course, courseIndex) => (
            <div
              key={course.id}
              className="glass-card rounded-2xl overflow-hidden animate-fade-up"
              style={{ animationDelay: `${courseIndex * 0.1}s` }}
            >
              {/* Course Header */}
              <button
                onClick={() => setExpandedCourse(expandedCourse === course.id ? null : course.id)}
                className="w-full p-6 flex items-center gap-4 hover:bg-secondary/20 transition-colors"
              >
                <GripVertical className="w-5 h-5 text-muted-foreground cursor-grab" />
                <div className="flex-1 text-left">
                  <h2 className="font-display text-xl font-semibold">{course.title}</h2>
                  <p className="text-sm text-muted-foreground">{course.description}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditCourse(course);
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget({ type: 'course', id: course.id, name: course.title });
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  {expandedCourse === course.id ? (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Modules */}
              {expandedCourse === course.id && (
                <div className="border-t border-border/30">
                  {course.modules.map((module) => (
                    <div
                      key={module.id}
                      className="px-6 py-4 flex items-center gap-4 hover:bg-secondary/10 transition-colors border-b border-border/20 last:border-b-0"
                    >
                      <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab ml-4" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{module.title}</div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Video className="w-3 h-3" />
                            {module.duration || 'No duration'}
                          </span>
                          {module.has_download && (
                            <span className="text-xs text-primary flex items-center gap-1">
                              <FileText className="w-3 h-3" />
                              Files
                            </span>
                          )}
                          {module.has_quiz && (
                            <span className="text-xs text-primary flex items-center gap-1">
                              <HelpCircle className="w-3 h-3" />
                              Quiz
                            </span>
                          )}
                          {module.has_homework && (
                            <span className="text-xs text-primary flex items-center gap-1">
                              <ClipboardList className="w-3 h-3" />
                              Homework
                            </span>
                          )}
                        </div>
                      </div>
                      {module.has_download && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setFilesManagerModule({ id: module.id, name: module.title })}
                        >
                          <Upload className="w-3 h-3 mr-1" />
                          Files
                        </Button>
                      )}
                      {module.has_quiz && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => setQuizManagerModule({ id: module.id, name: module.title })}
                        >
                          <HelpCircle className="w-3 h-3 mr-1" />
                          Quiz
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditModule(module)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ type: 'module', id: module.id, name: module.title })}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}

                  <div className="p-4 ml-8">
                    <Button variant="outline" size="sm" onClick={() => openNewModule(course.id)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Module
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Course Dialog */}
      <Dialog open={showCourseDialog} onOpenChange={setShowCourseDialog}>
        <DialogContent className="glass-card border-border/50">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editingCourse ? 'Edit Course' : 'New Course'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Course Title</Label>
              <Input
                value={courseForm.title}
                onChange={(e) => setCourseForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Hair Systems Mastery"
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={courseForm.description}
                onChange={(e) => setCourseForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What will students learn?"
                className="bg-secondary/50"
              />
            </div>
            <Button
              className="w-full gold-gradient text-primary-foreground"
              onClick={handleSaveCourse}
              disabled={!courseForm.title || createCourse.isPending || updateCourse.isPending}
            >
              {createCourse.isPending || updateCourse.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {editingCourse ? 'Save Changes' : 'Create Course'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Module Dialog */}
      <Dialog open={showModuleDialog} onOpenChange={setShowModuleDialog}>
        <DialogContent className="glass-card border-border/50 max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editingModule ? 'Edit Module' : 'New Module'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Module Title</Label>
              <Input
                value={moduleForm.title}
                onChange={(e) => setModuleForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g., Introduction to Hair Systems"
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={moduleForm.description}
                onChange={(e) => setModuleForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Module description..."
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Video URL</Label>
              <Input
                value={moduleForm.video_url}
                onChange={(e) => setModuleForm((f) => ({ ...f, video_url: e.target.value }))}
                placeholder="https://..."
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Duration</Label>
              <Input
                value={moduleForm.duration}
                onChange={(e) => setModuleForm((f) => ({ ...f, duration: e.target.value }))}
                placeholder="e.g., 15:30"
                className="bg-secondary/50"
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label>Has Downloadable Files</Label>
              <Switch
                checked={moduleForm.has_download}
                onCheckedChange={(checked) => setModuleForm((f) => ({ ...f, has_download: checked }))}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label>Has Quiz</Label>
              <Switch
                checked={moduleForm.has_quiz}
                onCheckedChange={(checked) => setModuleForm((f) => ({ ...f, has_quiz: checked }))}
              />
            </div>
            <div className="flex items-center justify-between py-2">
              <Label>Has Homework</Label>
              <Switch
                checked={moduleForm.has_homework}
                onCheckedChange={(checked) => setModuleForm((f) => ({ ...f, has_homework: checked }))}
              />
            </div>
            <Button
              className="w-full gold-gradient text-primary-foreground"
              onClick={handleSaveModule}
              disabled={!moduleForm.title || createModule.isPending || updateModule.isPending}
            >
              {createModule.isPending || updateModule.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {editingModule ? 'Save Changes' : 'Create Module'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="glass-card border-border/50">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.type}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Files Manager */}
      {filesManagerModule && (
        <ModuleFilesManager
          moduleId={filesManagerModule.id}
          moduleName={filesManagerModule.name}
          open={!!filesManagerModule}
          onOpenChange={(open) => !open && setFilesManagerModule(null)}
        />
      )}

      {/* Quiz Manager */}
      {quizManagerModule && (
        <QuizManager
          moduleId={quizManagerModule.id}
          moduleName={quizManagerModule.name}
          open={!!quizManagerModule}
          onOpenChange={(open) => !open && setQuizManagerModule(null)}
        />
      )}
    </DashboardLayout>
  );
}