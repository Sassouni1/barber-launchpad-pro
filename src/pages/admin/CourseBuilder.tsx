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
  DialogTrigger,
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
} from 'lucide-react';
import {
  useCourses,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
  useCreateModule,
  useUpdateModule,
  useDeleteModule,
  useCreateLesson,
  useUpdateLesson,
  useDeleteLesson,
  type CourseWithModules,
  type Module,
  type Lesson,
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
  const createLesson = useCreateLesson();
  const updateLesson = useUpdateLesson();
  const deleteLesson = useDeleteLesson();

  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [expandedModule, setExpandedModule] = useState<string | null>(null);

  // Dialog states
  const [showCourseDialog, setShowCourseDialog] = useState(false);
  const [showModuleDialog, setShowModuleDialog] = useState(false);
  const [showLessonDialog, setShowLessonDialog] = useState(false);
  const [editingCourse, setEditingCourse] = useState<CourseWithModules | null>(null);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(null);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'course' | 'module' | 'lesson'; id: string; name: string } | null>(null);

  // Form states
  const [courseForm, setCourseForm] = useState({ title: '', description: '' });
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [lessonForm, setLessonForm] = useState({
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
    setModuleForm({ title: '', description: '' });
    setShowModuleDialog(true);
  };

  const openEditModule = (module: Module) => {
    setEditingModule(module);
    setModuleForm({ title: module.title, description: module.description || '' });
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

  // Lesson handlers
  const openNewLesson = (moduleId: string) => {
    setSelectedModuleId(moduleId);
    setEditingLesson(null);
    setLessonForm({ title: '', description: '', video_url: '', duration: '', has_download: false, has_quiz: false, has_homework: false });
    setShowLessonDialog(true);
  };

  const openEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setLessonForm({
      title: lesson.title,
      description: lesson.description || '',
      video_url: lesson.video_url || '',
      duration: lesson.duration || '',
      has_download: lesson.has_download,
      has_quiz: lesson.has_quiz,
      has_homework: lesson.has_homework,
    });
    setShowLessonDialog(true);
  };

  const handleSaveLesson = async () => {
    if (editingLesson) {
      await updateLesson.mutateAsync({ id: editingLesson.id, ...lessonForm });
    } else if (selectedModuleId) {
      const module = courses?.flatMap((c) => c.modules).find((m) => m.id === selectedModuleId);
      const maxOrder = module?.lessons.reduce((max, l) => Math.max(max, l.order_index), -1) ?? -1;
      await createLesson.mutateAsync({ module_id: selectedModuleId, ...lessonForm, order_index: maxOrder + 1 });
    }
    setShowLessonDialog(false);
  };

  // Delete handlers
  const handleDelete = async () => {
    if (!deleteTarget) return;
    
    if (deleteTarget.type === 'course') {
      await deleteCourse.mutateAsync(deleteTarget.id);
    } else if (deleteTarget.type === 'module') {
      await deleteModule.mutateAsync(deleteTarget.id);
    } else {
      await deleteLesson.mutateAsync(deleteTarget.id);
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
                    <div key={module.id} className="border-b border-border/20 last:border-b-0">
                      <button
                        onClick={() => setExpandedModule(expandedModule === module.id ? null : module.id)}
                        className="w-full px-6 py-4 flex items-center gap-4 hover:bg-secondary/10 transition-colors"
                      >
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab ml-4" />
                        <div className="flex-1 text-left">
                          <h3 className="font-medium">{module.title}</h3>
                          <p className="text-xs text-muted-foreground">{module.lessons.length} lessons</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditModule(module);
                            }}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ type: 'module', id: module.id, name: module.title });
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                          {expandedModule === module.id ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </button>

                      {/* Lessons */}
                      {expandedModule === module.id && (
                        <div className="px-6 pb-4 space-y-2 ml-12">
                          {module.lessons.map((lesson) => (
                            <div
                              key={lesson.id}
                              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors"
                            >
                              <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm truncate">{lesson.title}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Video className="w-3 h-3" />
                                    {lesson.duration || 'No duration'}
                                  </span>
                                  {lesson.has_download && (
                                    <span className="text-xs text-primary flex items-center gap-1">
                                      <FileText className="w-3 h-3" />
                                      Files
                                    </span>
                                  )}
                                  {lesson.has_quiz && (
                                    <span className="text-xs text-primary flex items-center gap-1">
                                      <HelpCircle className="w-3 h-3" />
                                      Quiz
                                    </span>
                                  )}
                                  {lesson.has_homework && (
                                    <span className="text-xs text-primary flex items-center gap-1">
                                      <ClipboardList className="w-3 h-3" />
                                      Homework
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditLesson(lesson)}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget({ type: 'lesson', id: lesson.id, name: lesson.title })}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}

                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2"
                            onClick={() => openNewLesson(module.id)}
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Lesson
                          </Button>
                        </div>
                      )}
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
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {editingCourse ? 'Save Changes' : 'Create Course'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Module Dialog */}
      <Dialog open={showModuleDialog} onOpenChange={setShowModuleDialog}>
        <DialogContent className="glass-card border-border/50">
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
                placeholder="e.g., Getting Started"
                className="bg-secondary/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={moduleForm.description}
                onChange={(e) => setModuleForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Module overview"
                className="bg-secondary/50"
              />
            </div>
            <Button
              className="w-full gold-gradient text-primary-foreground"
              onClick={handleSaveModule}
              disabled={!moduleForm.title || createModule.isPending || updateModule.isPending}
            >
              {createModule.isPending || updateModule.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {editingModule ? 'Save Changes' : 'Create Module'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lesson Dialog */}
      <Dialog open={showLessonDialog} onOpenChange={setShowLessonDialog}>
        <DialogContent className="glass-card border-border/50 max-w-2xl">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">
              {editingLesson ? 'Edit Lesson' : 'New Lesson'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Lesson Title</Label>
                <Input
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Introduction to Techniques"
                  className="bg-secondary/50"
                />
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Input
                  value={lessonForm.duration}
                  onChange={(e) => setLessonForm((f) => ({ ...f, duration: e.target.value }))}
                  placeholder="e.g., 15:30"
                  className="bg-secondary/50"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Video URL</Label>
              <Input
                value={lessonForm.video_url}
                onChange={(e) => setLessonForm((f) => ({ ...f, video_url: e.target.value }))}
                placeholder="Vimeo or YouTube URL"
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={lessonForm.description}
                onChange={(e) => setLessonForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What will students learn in this lesson?"
                className="bg-secondary/50"
              />
            </div>

            <div className="space-y-4">
              <Label>Optional Content</Label>
              <div className="grid grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span className="text-sm">Downloads</span>
                  </div>
                  <Switch
                    checked={lessonForm.has_download}
                    onCheckedChange={(v) => setLessonForm((f) => ({ ...f, has_download: v }))}
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <HelpCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">Quiz</span>
                  </div>
                  <Switch
                    checked={lessonForm.has_quiz}
                    onCheckedChange={(v) => setLessonForm((f) => ({ ...f, has_quiz: v }))}
                  />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-primary" />
                    <span className="text-sm">Homework</span>
                  </div>
                  <Switch
                    checked={lessonForm.has_homework}
                    onCheckedChange={(v) => setLessonForm((f) => ({ ...f, has_homework: v }))}
                  />
                </div>
              </div>
            </div>

            <Button
              className="w-full gold-gradient text-primary-foreground"
              onClick={handleSaveLesson}
              disabled={!lessonForm.title || createLesson.isPending || updateLesson.isPending}
            >
              {createLesson.isPending || updateLesson.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : null}
              {editingLesson ? 'Save Changes' : 'Create Lesson'}
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
              {deleteTarget?.type === 'course' && ' All modules and lessons within this course will also be deleted.'}
              {deleteTarget?.type === 'module' && ' All lessons within this module will also be deleted.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
