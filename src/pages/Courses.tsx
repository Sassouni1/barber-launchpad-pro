import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { courses } from '@/data/mockData';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ChevronRight, BookOpen, CheckCircle2, Lock, Play } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

export default function Courses() {
  const navigate = useNavigate();
  const [expandedModule, setExpandedModule] = useState<string | null>('m2');

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="animate-fade-up">
          <h1 className="font-display text-4xl font-bold mb-2">Course Library</h1>
          <p className="text-muted-foreground text-lg">
            Master hair systems and build your business with our comprehensive curriculum.
          </p>
        </div>

        {courses.map((course, courseIndex) => (
          <div
            key={course.id}
            className="glass-card rounded-2xl overflow-hidden animate-fade-up"
            style={{ animationDelay: `${courseIndex * 0.1}s` }}
          >
            {/* Course Header */}
            <div className="p-6 border-b border-border/30">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="font-display text-2xl font-semibold">{course.title}</h2>
                  <p className="text-muted-foreground mt-1">{course.description}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary">{course.progress}%</div>
                  <div className="text-sm text-muted-foreground">Complete</div>
                </div>
              </div>
              <Progress value={course.progress} className="h-2 bg-secondary" />
            </div>

            {/* Modules */}
            <div className="divide-y divide-border/30">
              {course.modules.map((module) => (
                <div key={module.id}>
                  {/* Module Header */}
                  <button
                    onClick={() => setExpandedModule(expandedModule === module.id ? null : module.id)}
                    className="w-full p-4 flex items-center gap-4 hover:bg-secondary/30 transition-colors"
                  >
                    <div
                      className={cn(
                        'w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0',
                        module.progress === 100
                          ? 'bg-primary/20 text-primary'
                          : module.progress > 0
                          ? 'bg-secondary text-foreground'
                          : 'bg-secondary/50 text-muted-foreground'
                      )}
                    >
                      {module.progress === 100 ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <BookOpen className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold">{module.title}</h3>
                      <p className="text-sm text-muted-foreground">
                        {module.lessons.filter((l) => l.completed).length}/{module.lessons.length} lessons •{' '}
                        {module.progress}% complete
                      </p>
                    </div>
                    <ChevronRight
                      className={cn(
                        'w-5 h-5 text-muted-foreground transition-transform',
                        expandedModule === module.id && 'rotate-90'
                      )}
                    />
                  </button>

                  {/* Lessons */}
                  {expandedModule === module.id && (
                    <div className="px-4 pb-4 space-y-2 animate-fade-in">
                      {module.lessons.map((lesson, lessonIndex) => {
                        const previousLesson = module.lessons[lessonIndex - 1];
                        const isLocked = lessonIndex > 0 && !previousLesson?.completed && !lesson.completed;

                        return (
                          <div
                            key={lesson.id}
                            className={cn(
                              'flex items-center gap-4 p-4 rounded-xl transition-all duration-300',
                              lesson.completed
                                ? 'bg-primary/5 border border-primary/20'
                                : isLocked
                                ? 'bg-secondary/20 opacity-50'
                                : 'bg-secondary/30 hover:bg-secondary/50 cursor-pointer'
                            )}
                            onClick={() => !isLocked && navigate(`/courses/lesson/${lesson.id}`)}
                          >
                            <div
                              className={cn(
                                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                                lesson.completed
                                  ? 'bg-primary text-primary-foreground'
                                  : isLocked
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-secondary text-foreground'
                              )}
                            >
                              {lesson.completed ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : isLocked ? (
                                <Lock className="w-4 h-4" />
                              ) : (
                                <Play className="w-4 h-4" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-medium truncate">{lesson.title}</h4>
                              <p className="text-sm text-muted-foreground truncate">
                                {lesson.description}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <span>{lesson.duration}</span>
                              {lesson.hasQuiz && (
                                <span className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">
                                  Quiz
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </DashboardLayout>
  );
}
