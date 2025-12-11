import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useCourses } from '@/hooks/useCourses';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft,
  Download,
  FileText,
  CheckCircle2,
  Play,
  HelpCircle,
  ClipboardList,
  Loader2,
} from 'lucide-react';

export default function Lesson() {
  const navigate = useNavigate();
  const { lessonId } = useParams();
  const { data: courses = [], isLoading } = useCourses();
  const [activeTab, setActiveTab] = useState<'video' | 'quiz' | 'homework'>('video');
  const [homeworkComplete, setHomeworkComplete] = useState(false);

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  // Find the module (now acts as lesson)
  const module = courses
    .flatMap((c) => (c.modules || []).map((m) => ({ ...m, courseName: c.title })))
    .find((m) => m.id === lessonId);

  if (!module) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <h1 className="font-display text-2xl font-bold mb-4">Module not found</h1>
          <Button onClick={() => navigate('/courses')}>Back to Courses</Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4 animate-fade-up">
          <Button variant="ghost" size="icon" onClick={() => navigate('/courses')}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <p className="text-sm text-muted-foreground">{module.courseName}</p>
            <h1 className="font-display text-3xl font-bold">{module.title}</h1>
          </div>
        </div>

        {/* Video Player */}
        <div className="glass-card rounded-2xl overflow-hidden animate-fade-up" style={{ animationDelay: '0.1s' }}>
          <div className="aspect-video bg-black/50 flex items-center justify-center relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent" />
            <div className="text-center z-10">
              <div className="w-20 h-20 rounded-full gold-gradient flex items-center justify-center mx-auto mb-4 cursor-pointer hover:scale-110 transition-transform animate-pulse-gold">
                <Play className="w-8 h-8 text-primary-foreground ml-1" />
              </div>
              <p className="text-muted-foreground">Click to play module video</p>
              {module.duration && (
                <p className="text-sm text-muted-foreground mt-1">{module.duration}</p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 animate-fade-up" style={{ animationDelay: '0.2s' }}>
          <Button
            variant={activeTab === 'video' ? 'default' : 'secondary'}
            onClick={() => setActiveTab('video')}
            className={activeTab === 'video' ? 'gold-gradient' : ''}
          >
            <FileText className="w-4 h-4 mr-2" />
            Resources
          </Button>
          {module.has_quiz && (
            <Button
              variant={activeTab === 'quiz' ? 'default' : 'secondary'}
              onClick={() => setActiveTab('quiz')}
              className={activeTab === 'quiz' ? 'gold-gradient' : ''}
            >
              <HelpCircle className="w-4 h-4 mr-2" />
              Quiz
            </Button>
          )}
          {module.has_homework && (
            <Button
              variant={activeTab === 'homework' ? 'default' : 'secondary'}
              onClick={() => setActiveTab('homework')}
              className={activeTab === 'homework' ? 'gold-gradient' : ''}
            >
              <ClipboardList className="w-4 h-4 mr-2" />
              Homework
            </Button>
          )}
        </div>

        {/* Tab Content */}
        <div className="glass-card p-6 rounded-2xl animate-fade-up" style={{ animationDelay: '0.3s' }}>
          {activeTab === 'video' && (
            <div className="space-y-6">
              <div>
                <h2 className="font-display text-xl font-semibold mb-2">About This Module</h2>
                <p className="text-muted-foreground">{module.description || 'No description available.'}</p>
              </div>

              {module.has_download && (
                <div>
                  <h3 className="font-semibold mb-3">Downloadable Resources</h3>
                  <div className="space-y-2">
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="w-4 h-4 mr-3" />
                      Module Notes.pdf
                    </Button>
                    <Button variant="outline" className="w-full justify-start">
                      <Download className="w-4 h-4 mr-3" />
                      Practice Worksheet.pdf
                    </Button>
                  </div>
                </div>
              )}

              <Button className="w-full gold-gradient text-primary-foreground font-semibold">
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Mark as Complete
              </Button>
            </div>
          )}

          {activeTab === 'quiz' && module.has_quiz && (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold">Module Quiz</h2>
              <p className="text-muted-foreground">Quiz functionality coming soon.</p>
            </div>
          )}

          {activeTab === 'homework' && module.has_homework && (
            <div className="space-y-6">
              <h2 className="font-display text-xl font-semibold">Homework Assignment</h2>
              <div className="bg-secondary/30 p-4 rounded-lg space-y-4">
                <p className="text-muted-foreground">
                  Practice the techniques learned in this module and document your progress.
                </p>
                <ul className="list-disc list-inside space-y-2 text-muted-foreground">
                  <li>Complete 3 practice sessions</li>
                  <li>Take before and after photos</li>
                  <li>Note any challenges faced</li>
                  <li>Record questions for next module</li>
                </ul>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg bg-secondary/30">
                <Checkbox
                  checked={homeworkComplete}
                  onCheckedChange={(checked) => setHomeworkComplete(checked as boolean)}
                  className="w-6 h-6"
                />
                <span className="font-medium">I have completed this homework assignment</span>
              </div>

              <Button
                className="w-full gold-gradient text-primary-foreground font-semibold"
                disabled={!homeworkComplete}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Submit Homework
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
