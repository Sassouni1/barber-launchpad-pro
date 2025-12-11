import { Card } from '@/components/ui/card';
import { Palette, PenTool } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrainingGameSelectorProps {
  onSelectGame: (game: 'color-match' | 'hairline') => void;
}

const games = [
  {
    id: 'color-match' as const,
    title: 'Color Matching',
    description: 'Learn to identify hair color codes by matching samples to client hair',
    icon: Palette,
  },
  {
    id: 'hairline' as const,
    title: 'Hairline Drawing',
    description: 'Practice drawing natural-looking hairlines on different face shapes',
    icon: PenTool,
  },
];

export function TrainingGameSelector({ onSelectGame }: TrainingGameSelectorProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-xl font-medium mb-2">Choose a Training Exercise</h2>
        <p className="text-sm text-muted-foreground">
          Select a skill to practice
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {games.map((game) => (
          <Card
            key={game.id}
            onClick={() => onSelectGame(game.id)}
            className={cn(
              'glass-card p-6 cursor-pointer transition-all duration-200',
              'hover:scale-[1.02] hover:border-primary/50',
              'flex flex-col items-center text-center gap-4'
            )}
          >
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <game.icon className="w-8 h-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-medium mb-1">{game.title}</h3>
              <p className="text-sm text-muted-foreground">{game.description}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
