import { useCourses } from '@/hooks/useCourses';
import { useCompletedModules } from '@/hooks/useCompletedModules';
import { Button } from '@/components/ui/button';
import { Play, Clock, FileText, Zap, ArrowRight, BookOpen, Loader2, List, Sparkles, Trophy, Award } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export function ContinueLearning() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: courses = [], isLoading } = useCourses();
  const { data: completedMap = {} } = useCompletedModules();

  // Has the user actually generated a certificate (i.e. entered their name and
  // gone through the certification modal)? Passing all quizzes is NOT the same
  // as being certified — they still have to claim it.
  const { data: hasCertificate = false } = useQuery({
    queryKey: ['user-has-any-certification', user?.id],
    enabled: !!user?.id,
    staleTime: 60000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('certifications')
        .select('id')
        .eq('user_id', user!.id)
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
  });

  if (isLoading) {
    return (
      <div className="glass-card cyber-corners p-6 rounded-xl animate-fade-up flex items-center justify-center min-h-[200px]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // Flatten all modules in order across courses
  const allModules = courses.flatMap((course) =>
    (course.modules || []).map((module) => ({
      ...module,
      courseName: course.title,
      categoryId: ((course as any).category as string) || 'hair-system',
    }))
  );

  // Find the first module that hasn't been passed yet (i.e. next to do)
  const nextModule =
    allModules.find((m) => !completedMap[m.id]?.passed) || allModules[allModules.length - 1];
  const hasStarted = allModules.some((m) => completedMap[m.id]?.passed);
  const allDone = allModules.length > 0 && allModules.every((m) => completedMap[m.id]?.passed);

  const firstModule = nextModule;

  if (!firstModule) {
    return (
      <div className="glass-card cyber-corners p-6 rounded-xl animate-fade-up" style={{ animationDelay: '0.2s' }}>
        <div className="text-center py-8">
          <BookOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="font-semibold text-lg mb-2">No Modules Available</h3>
          <p className="text-muted-foreground mb-4">Create courses in the Admin panel to get started</p>
          <Button onClick={() => navigate('/admin/courses')} variant="outline">
            Go to Admin
          </Button>
        </div>
      </div>
    );
  }

  // Finished every module but hasn't claimed the certificate yet — send them
  // to the certification section where they enter their name.
  if (allDone && !hasCertificate) {
    return (
      <div className="glass-card cyber-corners p-6 rounded-xl animate-fade-up hover-lift spotlight-pulse" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full">
            <Award className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-cyber text-primary">Ready to Certify</span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Last step</p>
          </div>
          <h3 className="font-display text-2xl font-bold tracking-tight">Claim your certificate</h3>
          <p className="text-muted-foreground leading-relaxed">
            You've finished every module. Enter your name and we'll generate your official Hair System Mastery certificate.
          </p>
          <Button
            onClick={() => navigate('/courses/hair-system')}
            className="w-full h-12 gold-gradient text-primary-foreground font-semibold text-base hover:opacity-90 transition-all group gold-glow"
          >
            <Award className="w-5 h-5 mr-2" />
            Get My Certificate
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>
      </div>
    );
  }

  // Fully certified — push them to growth tools.
  if (allDone && hasCertificate) {
    return (
      <div className="glass-card cyber-corners p-6 rounded-xl animate-fade-up hover-lift spotlight-pulse" style={{ animationDelay: '0.2s' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full">
            <Trophy className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-cyber text-primary">Certified</span>
          </div>
        </div>
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Next up · Grow your business</p>
          </div>
          <h3 className="font-display text-2xl font-bold tracking-tight">Start creating content that brings in clients</h3>
          <p className="text-muted-foreground leading-relaxed">
            You've finished every module. Use the AI Social Media Generator to turn what you learned into posts that convert.
          </p>
          <div className="space-y-2">
            <Button
              onClick={() => navigate('/marketing')}
              className="w-full h-12 gold-gradient text-primary-foreground font-semibold text-base hover:opacity-90 transition-all group gold-glow"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Open AI Social Media Generator
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              onClick={() => navigate('/courses/hair-system')}
              variant="outline"
              className="w-full h-11 border-primary/30 hover:border-primary/60 hover:bg-primary/5 font-medium"
            >
              <List className="w-4 h-4 mr-2" />
              Review All Lessons
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card cyber-corners p-6 rounded-xl animate-fade-up hover-lift spotlight-pulse" style={{ animationDelay: '0.2s' }}>
      {/* Header badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full">
          <div className="relative w-2 h-2">
            <div className="absolute inset-0 bg-primary rounded-full animate-ping" />
            <div className="relative w-2 h-2 bg-primary rounded-full" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-cyber text-primary">{allDone ? 'All Complete' : hasStarted ? 'Continue Learning' : 'Start Learning'}</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Course label */}
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{firstModule.courseName}</p>
        </div>
        
        {/* Title */}
        <h3 className="font-display text-2xl font-bold tracking-tight">{firstModule.title}</h3>
        {firstModule.description && (
          <p className="text-muted-foreground leading-relaxed">{firstModule.description}</p>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          {firstModule.duration && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-secondary/50 rounded-md border border-border/30">
              <Clock className="w-4 h-4 text-primary" />
              {firstModule.duration}
            </span>
          )}
          {firstModule.has_download && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-secondary/50 rounded-md border border-border/30">
              <FileText className="w-4 h-4 text-primary" />
              Resources
            </span>
          )}
        </div>

        {/* CTA Buttons */}
        <div className="space-y-2">
          <Button
            onClick={() =>
              navigate(`/courses/${firstModule.categoryId}/lesson/${firstModule.id}`)
            }
            className="w-full h-12 gold-gradient text-primary-foreground font-semibold text-base hover:opacity-90 transition-all group gold-glow"
          >
            <Play className="w-5 h-5 mr-2" />
            {allDone ? 'Review Module' : hasStarted ? 'Continue Module' : 'Start Module'}
            <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
          </Button>
          <Button
            onClick={() => navigate(`/courses/${firstModule.categoryId}`)}
            variant="outline"
            className="w-full h-11 border-primary/30 hover:border-primary/60 hover:bg-primary/5 font-medium"
          >
            <List className="w-4 h-4 mr-2" />
            See All Lessons
          </Button>
        </div>
      </div>
    </div>
  );
}
