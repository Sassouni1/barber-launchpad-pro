import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCourses, type Module } from '@/hooks/useCourses';
import { BookOpen, Play, FileText, HelpCircle, ClipboardList, Clock, Settings, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Courses() {
  const { data: courses = [], isLoading } = useCourses();
  const [selectedModule, setSelectedModule] = useState<string | null>(null);

  // Find selected module data
  const findModule = (): { module: Module; courseName: string } | null => {
    for (const course of courses) {
      const module = (course.modules || []).find(m => m.id === selectedModule);
      if (module) return { module, courseName: course.title };
    }
    return null;
  };

  const moduleData = findModule();

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
        {/* Left Panel - Courses & Modules */}
        <div className="w-96 flex-shrink-0 overflow-hidden flex flex-col">
          <div className="glass-card rounded-xl p-4 mb-4 flex items-center justify-between">
            <div>
              <h1 className="font-display text-xl font-bold gold-text">Course Library</h1>
              <p className="text-muted-foreground text-sm mt-1">Select a module to continue</p>
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
                <div className="space-y-2 pl-2">
                  {(course.modules || []).map((module, index) => {
                    const isSelected = selectedModule === module.id;

                    return (
                      <button
                        key={module.id}
                        onClick={() => setSelectedModule(module.id)}
                        className={cn(
                          'w-full p-4 rounded-xl flex items-start gap-4 transition-all duration-300 text-left',
                          'border-2 hover:border-primary/30 hover:bg-secondary/20',
                          isSelected 
                            ? 'bg-gradient-to-r from-primary/10 to-transparent border-primary/50 shadow-lg shadow-primary/5' 
                            : 'border-border/30 bg-secondary/10'
                        )}
                      >
                        <div className={cn(
                          'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 font-bold text-sm transition-all',
                          isSelected
                            ? 'gold-gradient text-primary-foreground shadow-md'
                            : 'bg-secondary border border-border text-muted-foreground'
                        )}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className={cn(
                            "font-semibold text-sm mb-1",
                            isSelected && "text-primary"
                          )}>{module.title}</h4>
                          {module.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{module.description}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            {module.duration && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" />
                                {module.duration}
                              </span>
                            )}
                            {module.has_download && (
                              <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                                <FileText className="w-3 h-3" />
                                Files
                              </span>
                            )}
                            {module.has_quiz && (
                              <span className="flex items-center gap-1 text-xs text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                                <HelpCircle className="w-3 h-3" />
                                Quiz
                              </span>
                            )}
                            {module.has_homework && (
                              <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-0.5 rounded-full">
                                <ClipboardList className="w-3 h-3" />
                                Homework
                              </span>
                            )}
                          </div>
                        </div>
                        <Play className={cn(
                          "w-5 h-5 flex-shrink-0 transition-transform",
                          isSelected ? "text-primary scale-110" : "text-muted-foreground"
                        )} />
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel - Module Content */}
        <div className="flex-1 overflow-y-auto">
          {moduleData ? (
            <div className="glass-card rounded-xl overflow-hidden h-full flex flex-col">
              {/* Module Header */}
              <div className="p-6 border-b border-border/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                  <span>{moduleData.courseName}</span>
                </div>
                <h1 className="font-display text-2xl font-bold gold-text">{moduleData.module.title}</h1>
                {moduleData.module.description && (
                  <p className="text-muted-foreground mt-1">{moduleData.module.description}</p>
                )}
              </div>

              {/* Video Player Placeholder */}
              <div className="relative aspect-video bg-background/50 flex items-center justify-center border-b border-border/30">
                <div className="absolute inset-0 cyber-grid opacity-30" />
                <div className="relative z-10 text-center">
                  <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 border border-primary/40 hover:bg-primary/30 transition-colors cursor-pointer group">
                    <Play className="w-8 h-8 text-primary ml-1 group-hover:scale-110 transition-transform" />
                  </div>
                  {moduleData.module.duration && (
                    <p className="text-muted-foreground text-sm">
                      <Clock className="w-4 h-4 inline mr-1" />
                      {moduleData.module.duration}
                    </p>
                  )}
                </div>
              </div>

              {/* Module Resources */}
              <div className="flex-1 p-6 space-y-4">
                <h3 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">Module Resources</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {moduleData.module.has_download && (
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border/30 hover:border-primary/30 transition-colors cursor-pointer group">
                      <FileText className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                      <h4 className="font-medium text-sm">Downloads</h4>
                      <p className="text-xs text-muted-foreground">PDF guides & resources</p>
                    </div>
                  )}
                  
                  {moduleData.module.has_quiz && (
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border/30 hover:border-primary/30 transition-colors cursor-pointer group">
                      <HelpCircle className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                      <h4 className="font-medium text-sm">Quiz</h4>
                      <p className="text-xs text-muted-foreground">Test your knowledge</p>
                    </div>
                  )}
                  
                  {moduleData.module.has_homework && (
                    <div className="p-4 rounded-lg bg-secondary/30 border border-border/30 hover:border-primary/30 transition-colors cursor-pointer group">
                      <ClipboardList className="w-5 h-5 text-primary mb-2 group-hover:scale-110 transition-transform" />
                      <h4 className="font-medium text-sm">Homework</h4>
                      <p className="text-xs text-muted-foreground">Practice assignment</p>
                    </div>
                  )}
                </div>

                <button className="w-full mt-4 py-3 px-4 rounded-lg gold-gradient text-primary-foreground font-semibold hover:opacity-90 transition-opacity">
                  Mark Module as Complete
                </button>
              </div>
            </div>
          ) : (
            <div className="glass-card rounded-xl h-full flex items-center justify-center">
              <div className="text-center">
                <BookOpen className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold text-lg mb-2">Select a Module</h3>
                <p className="text-muted-foreground">Choose a module from the left panel to view its content</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
