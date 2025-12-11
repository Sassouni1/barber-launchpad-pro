import { courses } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Play, Clock, FileText, Zap, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ContinueLearning() {
  const navigate = useNavigate();
  
  // Find the next incomplete lesson
  const nextLesson = courses
    .flatMap((course) =>
      course.modules.flatMap((module) =>
        module.lessons.map((lesson) => ({
          ...lesson,
          courseName: course.title,
          moduleName: module.title,
        }))
      )
    )
    .find((lesson) => !lesson.completed);

  if (!nextLesson) return null;

  return (
    <div className="glass-card cyber-corners p-6 rounded-xl animate-fade-up hover-lift spotlight-pulse" style={{ animationDelay: '0.2s' }}>
      {/* Header badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-full">
          <div className="relative w-2 h-2">
            <div className="absolute inset-0 bg-primary rounded-full animate-ping" />
            <div className="relative w-2 h-2 bg-primary rounded-full" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-cyber text-primary">Continue Mission</span>
        </div>
      </div>

      <div className="space-y-4">
        {/* Module label */}
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{nextLesson.moduleName}</p>
        </div>
        
        {/* Title */}
        <h3 className="font-display text-2xl font-bold tracking-tight">{nextLesson.title}</h3>
        <p className="text-muted-foreground leading-relaxed">{nextLesson.description}</p>

        {/* Meta info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5 px-2 py-1 bg-secondary/50 rounded-md border border-border/30">
            <Clock className="w-4 h-4 text-primary" />
            {nextLesson.duration}
          </span>
          {nextLesson.hasDownload && (
            <span className="flex items-center gap-1.5 px-2 py-1 bg-secondary/50 rounded-md border border-border/30">
              <FileText className="w-4 h-4 text-primary" />
              Resources
            </span>
          )}
        </div>

        {/* CTA Button */}
        <Button 
          onClick={() => navigate(`/courses/lesson/${nextLesson.id}`)}
          className="w-full h-12 gold-gradient text-primary-foreground font-semibold text-base hover:opacity-90 transition-all group gold-glow"
        >
          <Play className="w-5 h-5 mr-2" />
          Continue Lesson
          <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
        </Button>
      </div>
    </div>
  );
}
