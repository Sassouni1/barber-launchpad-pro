import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCourses } from '@/hooks/useCourses';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, BookOpen, CheckCircle2, Play, FileText, HelpCircle, ClipboardList, Clock, Settings, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Courses() {
  const { data: courses = [], isLoading } = useCourses();
  const [expandedModules, setExpandedModules] = useState<string[]>([]);
  const [selectedLesson, setSelectedLesson] = useState<string | null>(null);

  const toggleModule = (moduleId: string) => {
    setExpandedModules(prev => 
      prev.includes(moduleId) 
        ? prev.filter(id => id !== moduleId)
        : [...prev, moduleId]
    );
  };

  // Find selected lesson data
  const findLesson = () => {
    for (const course of courses) {
      for (const module of course.modules || []) {
        const lesson = (module.lessons || []).find(l => l.id === selectedLesson);
        if (lesson) return { lesson, module, course };
      }
    }
    return null;
  };

  const lessonData = findLesson();

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (courses.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[calc(100vh-8rem)] gap-4">
          <BookOpen className="w-16 h-16 text-muted-foreground" />
          <h2 className="text-xl font-semibold">No Courses Yet</h2>
          <p className="text-muted-foreground">Create your first course in the Admin panel</p>
          <Link to="/admin/courses">
            <Button className="gap-2">
              <Settings className="w-4 h-4" />
              Go to Admin
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="flex gap-6 h-[calc(100vh-8rem)]">
        {/* Left Panel - Module Tabs */}
        <div className="w-96 flex-shrink-0 overflow-hidden flex flex-col">
          <div className="glass-card rounded-xl p-4 mb-4 flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl font-bold gold-text">Course Library</h1>
              <p className="text-muted-foreground text-sm mt-1">Select a lesson to continue</p>
            </div>
            <Link to="/admin/courses">
              <Button variant="outline" size="sm" className="gap-2">
                <Settings className="w-4 h-4" />
                Edit Courses
              </Button>
            </Link>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {courses.map((course) => (
              <div key={course.id} className="space-y-2">
                {/* Course Title */}
                <div className="glass-card rounded-lg p-3 border-l-2 border-primary/50">
                  <h2 className="font-semibold text-sm">{course.title}</h2>
                  {course.description && (
                    <p className="text-xs text-muted-foreground mt-1">{course.description}</p>
                  )}
                </div>

                {/* Modules */}
                {(course.modules || []).map((module) => {
                  const isExpanded = expandedModules.includes(module.id);
                  const lessons = module.lessons || [];
                  
                  return (
                    <div key={module.id} className="space-y-1">
                      {/* Module Header */}
                      <button
                        onClick={() => toggleModule(module.id)}
                        className={cn(
                          'w-full p-3 rounded-lg flex items-center gap-3 transition-all duration-200',
                          'bg-secondary/30 hover:bg-secondary/50 border border-border/30',
                          isExpanded && 'bg-secondary/50 border-primary/30'
                        )}
                      >
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-secondary text-muted-foreground">
                          <BookOpen className="w-4 h-4" />
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <h3 className="font-medium text-sm truncate">{module.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {lessons.length} lessons
                          </p>
                        </div>
                        <ChevronDown className={cn(
                          'w-4 h-4 text-muted-foreground transition-transform duration-200',
                          isExpanded && 'rotate-180'
                        )} />
                      </button>

                      {/* Lessons */}
                      {isExpanded && (
                        <div className="pl-2 space-y-1 animate-fade-in">
                          {lessons.map((lesson) => {
                            const isSelected = selectedLesson === lesson.id;

                            return (
                              <button
                                key={lesson.id}
                                onClick={() => setSelectedLesson(lesson.id)}
                                className={cn(
                                  'w-full p-3 rounded-lg flex items-center gap-3 transition-all duration-200 text-left',
                                  'hover:bg-secondary/30',
                                  isSelected && 'bg-primary/10 border border-primary/40'
                                )}
                              >
                                <div className={cn(
                                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border',
                                  isSelected
                                    ? 'bg-primary/20 border-primary text-primary'
                                    : 'bg-secondary border-border text-foreground'
                                )}>
                                  <Play className="w-3 h-3 ml-0.5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm truncate">{lesson.title}</h4>
                                  {lesson.description && (
                                    <p className="text-xs text-muted-foreground truncate">{lesson.description}</p>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {lesson.duration && (
                                    <span className="text-xs text-muted-foreground">{lesson.duration}</span>
                                  )}
                                  {lesson.has_quiz && (
                                    <span className="px-1.5 py-0.5 bg-primary/20 text-primary rounded text-[10px] font-medium">
                                      Quiz
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Lesson Content */}
        <div className="flex-1 overflow-y-auto">
          {lessonData ? (
            <div className="glass-card rounded-xl overflow-hidden h-full flex flex-col">
              {/* Lesson Header */}
              <div className="p-6 border-b border-border/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span>{lessonData.course.title}</span>
                  <span>•</span>
                  <span>{lessonData.module.title}</span>
                </div>
                <h1 className="font-display text-2xl font-bold gold-text">{lessonData.lesson.title}</h1>
                {lessonData.lesson.description && (
                  <p className="text-muted-foreground mt-1">{lessonData.lesson.description}</p>
                )}
              </div>

              {/* Video Player Placeholder */}
              <div className="relative aspect-video bg-background/50 flex items-center justify-center border-b border-border/30">
                <div className="absolute inset-0 cyber-grid opacity-30" />
                <div className="relative z-10 text-center">
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 border border-primary/40 hover:bg-primary/30 transition-colors cursor-pointer group">
                    <Play className="w-8 h-8 text-primary ml-1 group-hover:scale-110 transition-transform" />
                  </div>
                  {lessonData.lesson.duration && (
                    <p className="text-muted-foreground text-sm">
                      <Clock className="w-4 h-4 inline mr-1" />
                      {lessonData.lesson.duration}
                    </p>
                  )}
                </div>
              </div>

              {/* Lesson Resources */}
              <div className="flex-1 p-6 space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Lesson Resources</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {lessonData.lesson.has_download && (
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border/30 hover:border-primary/30 transition-colors cursor-pointer group">
                      <FileText className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                      <h4 className="font-medium text-sm">Downloads</h4>
                      <p className="text-xs text-muted-foreground">PDF guides & resources</p>
                    </div>
                  )}
                  
                  {lessonData.lesson.has_quiz && (
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border/30 hover:border-primary/30 transition-colors cursor-pointer group">
                      <HelpCircle className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                      <h4 className="font-medium text-sm">Quiz</h4>
                      <p className="text-xs text-muted-foreground">Test your knowledge</p>
                    </div>
                  )}
                  
                  {lessonData.lesson.has_homework && (
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border/30 hover:border-primary/30 transition-colors cursor-pointer group">
                      <ClipboardList className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                      <h4 className="font-medium text-sm">Homework</h4>
                      <p className="text-xs text-muted-foreground">Practice assignment</p>
                    </div>
                  )}
                </div>

                <button className="w-full mt-4 py-3 px-4 rounded-lg gold-gradient text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
                  Mark Lesson as Complete
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-xl h-full flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Select a Lesson</h3>
                <p className="text-muted-foreground">Choose a lesson from the left panel to view its content</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
