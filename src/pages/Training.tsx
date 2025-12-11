import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ColorMatchGame } from '@/components/training/ColorMatchGame';
import { HairlineGame } from '@/components/training/HairlineGame';
import { TrainingGameSelector } from '@/components/training/TrainingGameSelector';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

type GameType = 'color-match' | 'hairline' | null;

export default function Training() {
  const [selectedGame, setSelectedGame] = useState<GameType>(null);

  const handleBack = () => {
    setSelectedGame(null);
  };

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
      </div>
    </DashboardLayout>
  );
}
