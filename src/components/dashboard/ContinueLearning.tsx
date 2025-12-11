import { courses } from '@/data/mockData';
import { Button } from '@/components/ui/button';
import { Play, Clock, FileText } from 'lucide-react';
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
    <div className="glass-card p-6 rounded-2xl animate-fade-up hover-lift" style={{ animationDelay: '0.2s' }}>
      <div className="flex items-center gap-2 text-primary mb-4">
        <Play className="w-4 h-4" />
        <span className="text-sm font-medium uppercase tracking-wider">Continue Where You Left Off</span>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">{nextLesson.moduleName}</p>
          <h3 className="font-display text-xl font-semibold">{nextLesson.title}</h3>
          <p className="text-muted-foreground text-sm mt-1">{nextLesson.description}</p>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {nextLesson.duration}
          </span>
          {nextLesson.hasDownload && (
            <span className="flex items-center gap-1">
              <FileText className="w-4 h-4" />
              Resources
            </span>
          )}
        </div>

        <Button 
          onClick={() => navigate(`/courses/lesson/${nextLesson.id}`)}
          className="w-full gold-gradient text-primary-foreground font-semibold hover:opacity-90 transition-opacity"
        >
          <Play className="w-4 h-4 mr-2" />
          Continue Lesson
        </Button>
      </div>
    </div>
  );
}
