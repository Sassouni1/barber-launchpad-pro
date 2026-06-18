import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ColorMatchGame } from '@/components/training/ColorMatchGame';
import { HairlineGame } from '@/components/training/HairlineGame';
import { CeranWrapGame } from '@/components/training/CeranWrapGame';
import { TrainingGameSelector } from '@/components/training/TrainingGameSelector';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Lock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTrainingGamesUnlocked } from '@/hooks/useTrainingGamesUnlocked';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

type GameType = 'color-match' | 'hairline' | 'ceran-wrap' | null;

export default function Training() {
  const [selectedGame, setSelectedGame] = useState<GameType>(null);
  const navigate = useNavigate();
  const { unlocked, isLoading, passedQuizzes, totalQuizzes } = useTrainingGamesUnlocked();

  const handleBack = () => setSelectedGame(null);

  if (!isLoading && !unlocked) {
    return (
      <DashboardLayout>
        <div className="p-6 max-w-2xl mx-auto">
          <div className="rounded-2xl border border-primary/20 bg-card/50 p-8 text-center">
            <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center mb-4">
              <Lock className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-display font-bold gold-text mb-2">
              Training Games Locked
            </h1>
            <p className="text-muted-foreground mb-6">
              Unlocks after all quizzes in Hair System Training are completed.
              {totalQuizzes > 0 && (
                <span className="block mt-2 text-sm">
                  Progress: {passedQuizzes} / {totalQuizzes} quizzes passed
                </span>
              )}
            </p>
            <Button onClick={() => navigate('/courses/hair-system')}>
              Go to Hair System Training
            </Button>
          </div>
        </div>
        <AlertDialog open>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" /> Training Games Locked
              </AlertDialogTitle>
              <AlertDialogDescription>
                Unlocks after all quizzes in Hair System Training are completed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => navigate('/courses/hair-system')}>
                Go to Training
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-display font-bold gold-text mb-2">
            Training Center
          </h1>
          <p className="text-muted-foreground">
            Practice essential hair system skills with interactive exercises
          </p>
        </div>

        {selectedGame === null && (
          <TrainingGameSelector onSelectGame={setSelectedGame} />
        )}

        {selectedGame === 'color-match' && (
          <>
            <Button variant="ghost" onClick={handleBack} className="gap-2 -ml-2 mb-4">
              <ArrowLeft className="w-4 h-4" />
              Back to Games
            </Button>
            <ColorMatchGame />
          </>
        )}

        {selectedGame === 'hairline' && (
          <HairlineGame onBack={handleBack} />
        )}

        {selectedGame === 'ceran-wrap' && (
          <CeranWrapGame onBack={handleBack} />
        )}
      </div>
    </DashboardLayout>
  );
}
