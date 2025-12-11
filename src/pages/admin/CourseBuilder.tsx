import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { courses } from '@/data/mockData';
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
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function CourseBuilder() {
  const [expandedCourse, setExpandedCourse] = useState<string | null>('1');
  const [expandedModule, setExpandedModule] = useState<string | null>('m2');
  const [showAddLesson, setShowAddLesson] = useState(false);

  return (
    <DashboardLayout isAdmin>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between animate-fade-up">
          <div>
            <h1 className="font-display text-4xl font-bold mb-2">Course Builder</h1>
            <p className="text-muted-foreground text-lg">
              Create and manage your course content.
            </p>
          </div>
          <Button className="gold-gradient text-primary-foreground">
            <Plus className="w-4 h-4 mr-2" />
            New Course
          </Button>
        </div>

        {/* Courses */}
        <div className="space-y-4">
          {courses.map((course, courseIndex) => (
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
                  <Button variant="ghost" size="icon">
                    <Edit2 className="w-4 h-4" />
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
                      {/* Module Header */}
                      <button
                        onClick={() =>
                          setExpandedModule(expandedModule === module.id ? null : module.id)
                        }
                        className="w-full px-6 py-4 flex items-center gap-4 hover:bg-secondary/10 transition-colors"
                      >
                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab ml-4" />
                        <div className="flex-1 text-left">
                          <h3 className="font-medium">{module.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {module.lessons.length} lessons
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
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
                                    {lesson.duration}
                                  </span>
                                  {lesson.hasDownload && (
                                    <span className="text-xs text-primary flex items-center gap-1">
                                      <FileText className="w-3 h-3" />
                                      Files
                                    </span>
                                  )}
                                  {lesson.hasQuiz && (
                                    <span className="text-xs text-primary flex items-center gap-1">
                                      <HelpCircle className="w-3 h-3" />
                                      Quiz
                                    </span>
                                  )}
                                  {lesson.hasHomework && (
                                    <span className="text-xs text-primary flex items-center gap-1">
                                      <ClipboardList className="w-3 h-3" />
                                      Homework
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Edit2 className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}

                          <Dialog open={showAddLesson} onOpenChange={setShowAddLesson}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="w-full mt-2">
                                <Plus className="w-4 h-4 mr-2" />
                                Add Lesson
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="glass-card border-border/50 max-w-2xl">
                              <DialogHeader>
                                <DialogTitle className="font-display text-2xl">
                                  Add New Lesson
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-6 mt-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Lesson Title</Label>
                                    <Input
                                      placeholder="e.g., Introduction to Techniques"
                                      className="bg-secondary/50"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Video URL</Label>
                                    <Input
                                      placeholder="Vimeo or YouTube URL"
                                      className="bg-secondary/50"
                                    />
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>Description</Label>
                                  <Textarea
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
                                      <Switch />
                                    </div>
                                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                                      <div className="flex items-center gap-2">
                                        <HelpCircle className="w-4 h-4 text-primary" />
                                        <span className="text-sm">Quiz</span>
                                      </div>
                                      <Switch />
                                    </div>
                                    <div className="flex items-center justify-between p-4 rounded-lg bg-secondary/30">
                                      <div className="flex items-center gap-2">
                                        <ClipboardList className="w-4 h-4 text-primary" />
                                        <span className="text-sm">Homework</span>
                                      </div>
                                      <Switch />
                                    </div>
                                  </div>
                                </div>

                                <Button className="w-full gold-gradient text-primary-foreground">
                                  Create Lesson
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      )}
                    </div>
                  ))}

                  <div className="p-4 ml-8">
                    <Button variant="outline" size="sm">
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
    </DashboardLayout>
  );
}
