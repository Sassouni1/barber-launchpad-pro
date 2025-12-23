import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCourses, type Module } from '@/hooks/useCourses';
import { BookOpen, Play, FileText, HelpCircle, ClipboardList, Clock, Settings, Loader2, ArrowRight, ChevronDown, X } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { cn, getVimeoEmbedUrl } from '@/lib/utils';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Custom hook for lg breakpoint (1024px)
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState<boolean>(false);

  useEffect(() => {
    const mql = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mql.matches);
    mql.addEventListener('change', onChange);
    setIsDesktop(mql.matches);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isDesktop;
}

interface CoursesProps {
  courseType?: 'hair-system' | 'business';
}

export default function Courses({ courseType = 'hair-system' }: CoursesProps) {
  const { data: allCourses = [], isLoading } = useCourses();
  // Filter courses by category
  const courses = allCourses.filter(course => 
    (course as any).category === courseType
  );
  const [selectedModule, setSelectedModule] = useState<string | null>(null);
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollMore, setCanScrollMore] = useState(false);
  const isDesktop = useIsDesktop();

  const pageTitle = courseType === 'hair-system' ? 'Hair System Training' : 'Business Mastery';

  // Check if there's more content to scroll
  useEffect(() => {
    const checkScroll = () => {
      const container = scrollContainerRef.current;
      if (container) {
        const hasMoreContent = container.scrollHeight > container.clientHeight;
        const notAtBottom = container.scrollTop + container.clientHeight < container.scrollHeight - 20;
        setCanScrollMore(hasMoreContent && notAtBottom);
      }
    };

    checkScroll();
    const container = scrollContainerRef.current;
    container?.addEventListener('scroll', checkScroll);
    window.addEventListener('resize', checkScroll);
    
    return () => {
      container?.removeEventListener('scroll', checkScroll);
      window.removeEventListener('resize', checkScroll);
    };
  }, [courses]);

  const goToLesson = (moduleId: string, tab?: string) => {
    const url = tab ? `/courses/${courseType}/lesson/${moduleId}?tab=${tab}` : `/courses/${courseType}/lesson/${moduleId}`;
    navigate(url);
  };

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
          <p className="text-muted-foreground">Courses will appear here once available</p>
          {isAdmin && (
            <Link to="/admin/courses">
              <Button className="gap-2">
                <Settings className="w-4 h-4" />
                Go to Admin
              </Button>
            </Link>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // Mobile Module Detail Sheet - only shows on mobile (lg:hidden via CSS media query)
  const MobileModuleSheet = () => (
    <Sheet open={!!selectedModule} onOpenChange={(open) => !open && setSelectedModule(null)} modal={false}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl p-0">
        {moduleData && (
          <div className="flex flex-col h-full">
            <SheetHeader className="p-4 border-b border-border/30">
              <p className="text-xs text-muted-foreground">{moduleData.courseName}</p>
              <SheetTitle className="text-lg font-bold gold-text text-left">{moduleData.module.title}</SheetTitle>
            </SheetHeader>

            {/* Video Preview */}
            <div className="relative aspect-video bg-black">
              {moduleData.module.video_url ? (
                <iframe
                  src={getVimeoEmbedUrl(moduleData.module.video_url)}
                  className="absolute inset-0 w-full h-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={moduleData.module.title}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                  <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center border border-primary/40">
                    <Play className="w-6 h-6 text-primary ml-1" />
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {moduleData.module.description && (
                <p className="text-sm text-muted-foreground">{moduleData.module.description}</p>
              )}
              
              <Button 
                className="w-full gold-gradient text-primary-foreground font-semibold py-5"
                onClick={() => goToLesson(moduleData.module.id)}
              >
                <Play className="w-5 h-5 mr-2" />
                Start Lesson
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>

              {(moduleData.module.has_quiz || moduleData.module.has_homework) && (
                <div className="flex gap-2">
                  {moduleData.module.has_quiz && (
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => goToLesson(moduleData.module.id, 'quiz')}
                    >
                      <HelpCircle className="w-4 h-4 mr-2 text-amber-400" />
                      Quiz
                    </Button>
                  )}
                  {moduleData.module.has_homework && (
                    <Button 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => goToLesson(moduleData.module.id, 'homework')}
                    >
                      <ClipboardList className="w-4 h-4 mr-2 text-green-400" />
                      Homework
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );

  return (
    <DashboardLayout>
      {/* Mobile View */}
      <div className="lg:hidden flex flex-col h-[calc(100vh-8rem)]">
        <div className="glass-card rounded-xl p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-lg font-bold gold-text">{pageTitle}</h1>
              <p className="text-muted-foreground text-xs mt-0.5">Tap a module to start</p>
            </div>
            {isAdmin && (
              <Link to="/admin/courses">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs px-2">
                  <Settings className="w-3.5 h-3.5" />
                  Edit
                </Button>
              </Link>
            )}
          </div>
          
          <Select value={courseType} onValueChange={(value) => navigate(`/courses/${value}`)}>
            <SelectTrigger className="w-full bg-secondary/50 border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="hair-system">Hair System Training</SelectItem>
              <SelectItem value="business">Business Mastery</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {courses.map((course) => (
            <div key={course.id} className="space-y-2">
              <div className="glass-card rounded-lg p-3 border-l-2 border-primary/50">
                <h2 className="font-semibold text-sm">{course.title}</h2>
              </div>

              <div className="space-y-2 pl-2">
                {(course.modules || []).map((module, index) => (
                  <button
                    key={module.id}
                    onClick={() => navigate(`/courses/${courseType}/lesson/${module.id}`)}
                    className="w-full p-3 rounded-xl flex items-center gap-3 transition-all duration-200 text-left border-2 border-border bg-secondary/10 shadow-md shadow-black/20 active:scale-[0.98]"
                  >
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 font-bold text-sm bg-secondary border border-border text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm truncate">{module.title}</h4>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {module.duration && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />
                            {module.duration}
                          </span>
                        )}
                        {module.has_quiz && <HelpCircle className="w-3 h-3 text-amber-400" />}
                        {module.has_homework && <ClipboardList className="w-3 h-3 text-green-400" />}
                        {module.has_download && <FileText className="w-3 h-3 text-blue-400" />}
                      </div>
                    </div>
                    <Play className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Only render Sheet on mobile - must be conditional, not CSS hidden (portal) */}
        {!isDesktop && <MobileModuleSheet />}
      </div>

      {/* Desktop View */}
      <div className="hidden lg:flex gap-6 h-[calc(100vh-8rem)]">
        {/* Left Panel - Courses & Modules */}
        <div className="w-96 flex-shrink-0 overflow-hidden flex flex-col">
          <div className="glass-card rounded-xl p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="font-display text-xl font-bold gold-text">{pageTitle}</h1>
                <p className="text-muted-foreground text-sm mt-1">Select a module to continue</p>
              </div>
              {isAdmin && (
                <Link to="/admin/courses">
                  <Button variant="outline" size="sm" className="gap-2">
                    <Settings className="w-4 h-4" />
                    Edit Courses
                  </Button>
                </Link>
              )}
            </div>
            
            <Select value={courseType} onValueChange={(value) => navigate(`/courses/${value}`)}>
              <SelectTrigger className="w-full bg-secondary/50 border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                <SelectItem value="hair-system">Hair System Training</SelectItem>
                <SelectItem value="business">Business Mastery</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="relative flex-1">
            <div 
              ref={scrollContainerRef}
              className="absolute inset-0 overflow-y-auto space-y-3 pr-2 scrollbar-thin"
            >
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
                          'border-2 hover:border-primary/50 hover:bg-secondary/20',
                          isSelected 
                            ? 'bg-gradient-to-r from-primary/10 to-transparent border-primary/70 shadow-lg shadow-primary/20' 
                            : 'border-border bg-secondary/10 shadow-md shadow-black/20'
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
            
            {/* Scroll indicator */}
            {canScrollMore && (
              <div className="absolute bottom-0 left-0 right-2 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none flex items-end justify-center pb-2">
                <div className="flex flex-col items-center animate-bounce">
                  <ChevronDown className="w-5 h-5 text-primary" />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel - Module Content */}
        <div className="flex-1 overflow-y-auto">
          {moduleData ? (
            <div className="glass-card rounded-xl overflow-hidden">
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

              {/* Video Player */}
              <div className="relative aspect-video bg-black border-b border-border/30">
                {moduleData.module.video_url ? (
                  <iframe
                    src={getVimeoEmbedUrl(moduleData.module.video_url)}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; fullscreen; picture-in-picture"
                    allowFullScreen
                    title={moduleData.module.title}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-background/50">
                    <div className="absolute inset-0 cyber-grid opacity-30" />
                    <div className="relative z-10 text-center">
                      <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4 border border-primary/40">
                        <Play className="w-8 h-8 text-primary ml-1" />
                      </div>
                      {moduleData.module.duration && (
                        <p className="text-muted-foreground text-sm">
                          <Clock className="w-4 h-4 inline mr-1" />
                          {moduleData.module.duration}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-6 space-y-4">
                <Button 
                  className="w-full gold-gradient text-primary-foreground font-semibold py-6 text-lg"
                  onClick={() => goToLesson(moduleData.module.id)}
                >
                  <Play className="w-5 h-5 mr-2" />
                  Start Lesson
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>

                {(moduleData.module.has_quiz || moduleData.module.has_homework) && (
                  <div className="flex gap-3">
                    {moduleData.module.has_quiz && (
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => goToLesson(moduleData.module.id, 'quiz')}
                      >
                        <HelpCircle className="w-4 h-4 mr-2 text-amber-400" />
                        Take Quiz
                      </Button>
                    )}
                    {moduleData.module.has_homework && (
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => goToLesson(moduleData.module.id, 'homework')}
                      >
                        <ClipboardList className="w-4 h-4 mr-2 text-green-400" />
                        Homework
                      </Button>
                    )}
                  </div>
                )}
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
