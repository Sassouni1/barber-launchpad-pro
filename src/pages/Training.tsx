import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ColorMatchGame } from '@/components/training/ColorMatchGame';
import { HairlineGame } from '@/components/training/HairlineGame';
import { CeranWrapGame } from '@/components/training/CeranWrapGame';
import { TrainingGameSelector } from '@/components/training/TrainingGameSelector';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTrainingGamesUnlocked } from '@/hooks/useTrainingGamesUnlocked';
import { Progress } from '@/components/ui/progress';

type GameType = 'color-match' | 'hairline' | 'ceran-wrap' | null;

export default function Training() {
  const [selectedGame, setSelectedGame] = useState<GameType>(null);
  const navigate = useNavigate();
  const { unlocked, isLoading, passedQuizzes, totalQuizzes } = useTrainingGamesUnlocked();

  const handleBack = () => setSelectedGame(null);

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
          {!unlocked && !isLoading && totalQuizzes > 0 && (
            <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-card/50">
              <p className="text-sm text-muted-foreground mb-2">
                Complete all Hair System quizzes to fully unlock progress tracking.
              </p>
              <div className="flex items-center gap-3">
                <Progress value={(passedQuizzes / totalQuizzes) * 100} className="flex-1" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {passedQuizzes}/{totalQuizzes} quizzes
                </span>
              </div>
            </div>
          )}
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
