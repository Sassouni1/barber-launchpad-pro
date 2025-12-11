import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { courses } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';
import { ChevronDown, BookOpen, CheckCircle2, Lock, Play, FileText, HelpCircle, ClipboardList, Clock } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export default function Courses() {
  const [expandedModules, setExpandedModules] = useState<string[]>(['m2']);
  const [selectedLesson, setSelectedLesson] = useState<string | null>('l4');

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
      for (const module of course.modules) {
        const lesson = module.lessons.find(l => l.id === selectedLesson);
        if (lesson) return { lesson, module, course };
      }
    }
    return null;
  };

  const lessonData = findLesson();

  return (
    <DashboardLayout>
      <div className="flex gap-6 h-[calc(100vh-8rem)]">
        {/* Left Panel - Module Tabs */}
        <div className="w-96 flex-shrink-0 overflow-hidden flex flex-col">
          <div className="glass-card rounded-xl p-4 mb-4">
            <h1 className="font-display text-xl font-bold gold-text">Course Library</h1>
            <p className="text-muted-foreground text-sm mt-1">Select a lesson to continue</p>
          </div>
          
          <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
            {courses.map((course) => (
              <div key={course.id} className="space-y-2">
                {/* Course Title */}
                <div className="glass-card rounded-lg p-3 border-l-2 border-primary/50">
                  <div className="flex items-center justify-between mb-2">
                    <h2 className="font-semibold text-sm">{course.title}</h2>
                    <span className="text-xs text-primary font-medium">{course.progress}%</span>
                  </div>
                  <Progress value={course.progress} className="h-1.5" />
                </div>

                {/* Modules */}
                {course.modules.map((module) => {
                  const isExpanded = expandedModules.includes(module.id);
                  const completedLessons = module.lessons.filter(l => l.completed).length;
                  
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
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0',
                          module.progress === 100 
                            ? 'bg-primary/20 text-primary' 
                            : 'bg-secondary text-muted-foreground'
                        )}>
                          {module.progress === 100 ? (
                            <CheckCircle2 className="w-4 h-4" />
                          ) : (
                            <BookOpen className="w-4 h-4" />
                          )}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <h3 className="font-medium text-sm truncate">{module.title}</h3>
                          <p className="text-xs text-muted-foreground">
                            {completedLessons}/{module.lessons.length} lessons • {module.progress}%
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
                          {module.lessons.map((lesson, lessonIndex) => {
                            const previousLesson = module.lessons[lessonIndex - 1];
                            const isLocked = lessonIndex > 0 && !previousLesson?.completed && !lesson.completed;
                            const isSelected = selectedLesson === lesson.id;

                            return (
                              <button
                                key={lesson.id}
                                disabled={isLocked}
                                onClick={() => !isLocked && setSelectedLesson(lesson.id)}
                                className={cn(
                                  'w-full p-3 rounded-lg flex items-center gap-3 transition-all duration-200 text-left',
                                  isLocked && 'opacity-40 cursor-not-allowed',
                                  !isLocked && !isSelected && 'hover:bg-secondary/30',
                                  isSelected && 'bg-primary/10 border border-primary/40',
                                  lesson.completed && !isSelected && 'border border-primary/20 bg-primary/5'
                                )}
                              >
                                <div className={cn(
                                  'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 border',
                                  lesson.completed 
                                    ? 'bg-primary text-primary-foreground border-primary' 
                                    : isLocked 
                                    ? 'bg-muted border-muted-foreground/30 text-muted-foreground'
                                    : isSelected
                                    ? 'bg-primary/20 border-primary text-primary'
                                    : 'bg-secondary border-border text-foreground'
                                )}>
                                  {lesson.completed ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  ) : isLocked ? (
                                    <Lock className="w-3 h-3" />
                                  ) : (
                                    <Play className="w-3 h-3 ml-0.5" />
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-medium text-sm truncate">{lesson.title}</h4>
                                  <p className="text-xs text-muted-foreground truncate">{lesson.description}</p>
                                </div>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  <span className="text-xs text-muted-foreground">{lesson.duration}</span>
                                  {lesson.hasQuiz && (
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
                <p className="text-muted-foreground mt-1">{lessonData.lesson.description}</p>
              </div>

              {/* Video Player Placeholder */}
              <div className="relative aspect-video bg-background/50 flex items-center justify-center border-b border-border/30">
                <div className="absolute inset-0 cyber-grid opacity-30" />
                <div className="relative z-10 text-center">
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 border border-primary/40 hover:bg-primary/30 transition-colors cursor-pointer group">
                    <Play className="w-8 h-8 text-primary ml-1 group-hover:scale-110 transition-transform" />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    <Clock className="w-4 h-4 inline mr-1" />
                    {lessonData.lesson.duration}
                  </p>
                </div>
              </div>

              {/* Lesson Resources */}
              <div className="flex-1 p-6 space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Lesson Resources</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {lessonData.lesson.hasDownload && (
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border/30 hover:border-primary/30 transition-colors cursor-pointer group">
                      <FileText className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                      <h4 className="font-medium text-sm">Downloads</h4>
                      <p className="text-xs text-muted-foreground">PDF guides & resources</p>
                    </div>
                  )}
                  
                  {lessonData.lesson.hasQuiz && (
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border/30 hover:border-primary/30 transition-colors cursor-pointer group">
                      <HelpCircle className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                      <h4 className="font-medium text-sm">Quiz</h4>
                      <p className="text-xs text-muted-foreground">Test your knowledge</p>
                    </div>
                  )}
                  
                  {lessonData.lesson.hasHomework && (
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border/30 hover:border-primary/30 transition-colors cursor-pointer group">
                      <ClipboardList className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                      <h4 className="font-medium text-sm">Homework</h4>
                      <p className="text-xs text-muted-foreground">Practice assignment</p>
                    </div>
                  )}
                </div>

                {/* Mark Complete Button */}
                {!lessonData.lesson.completed && (
                  <button className="w-full mt-4 py-3 px-4 rounded-lg gold-gradient text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
                    Mark Lesson as Complete
                  </button>
                )}
                
                {lessonData.lesson.completed && (
                  <div className="flex items-center gap-2 text-primary mt-4">
                    <CheckCircle2 className="w-5 h-5" />
                    <span className="font-medium">Lesson Completed</span>
                  </div>
                )}
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
