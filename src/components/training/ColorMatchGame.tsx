import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, XCircle, RotateCcw, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import hairColorChart from '@/assets/hair-colors.jpg';

// Hair color samples with their crop positions on the chart image
// These are approximate positions based on the chart layout
const hairSamples = [
  { id: '1', name: '#1 - Jet Black', cropX: 0, cropY: 0 },
  { id: '1A', name: '#1A - Off Black', cropX: 1, cropY: 0 },
  { id: '1B', name: '#1B - Natural Black', cropX: 2, cropY: 0 },
  { id: '2', name: '#2 - Darkest Brown', cropX: 3, cropY: 0 },
  { id: '3', name: '#3 - Dark Brown', cropX: 4, cropY: 0 },
  { id: '4', name: '#4 - Medium Brown', cropX: 0, cropY: 1 },
  { id: '5', name: '#5 - Light Brown', cropX: 1, cropY: 1 },
  { id: '6', name: '#6 - Chestnut Brown', cropX: 2, cropY: 1 },
  { id: '7', name: '#7 - Medium Ash Brown', cropX: 3, cropY: 1 },
  { id: '8', name: '#8 - Light Ash Brown', cropX: 4, cropY: 1 },
  { id: '1B10', name: '#1B10 - 10% Grey', cropX: 0, cropY: 2 },
  { id: '1B20', name: '#1B20 - 20% Grey', cropX: 1, cropY: 2 },
];

// Generate quiz rounds by shuffling and picking random samples
function generateRounds(count: number = 10) {
  const shuffled = [...hairSamples].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length)).map((sample) => {
    // Generate 3 wrong answers
    const wrongOptions = hairSamples
      .filter((s) => s.id !== sample.id)
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    
    // Combine correct answer with wrong ones and shuffle
    const options = [sample, ...wrongOptions].sort(() => Math.random() - 0.5);
    
    return {
      correctAnswer: sample.id,
      sample,
      options,
    };
  });
}

export function ColorMatchGame() {
  const [rounds] = useState(() => generateRounds(10));
  const [currentRound, setCurrentRound] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);

  const round = rounds[currentRound];
  const progress = ((currentRound) / rounds.length) * 100;

  const handleSelect = (answerId: string) => {
    if (selectedAnswer) return; // Already answered
    
    setSelectedAnswer(answerId);
    const correct = answerId === round.correctAnswer;
    setIsCorrect(correct);
    
    if (correct) {
      setScore((s) => s + 1);
      // Trigger confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#FFD700', '#B8860B'],
      });
    }
  };

  const handleNext = () => {
    if (currentRound + 1 >= rounds.length) {
      setGameComplete(true);
      if (score >= rounds.length * 0.8) {
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#D4AF37', '#FFD700', '#B8860B'],
        });
      }
    } else {
      setCurrentRound((r) => r + 1);
      setSelectedAnswer(null);
      setIsCorrect(null);
    }
  };

  const handleRestart = () => {
    setCurrentRound(0);
    setSelectedAnswer(null);
    setIsCorrect(null);
    setScore(0);
    setGameComplete(false);
  };

  if (gameComplete) {
    const percentage = Math.round((score / rounds.length) * 100);
    return (
      <Card className="glass-card p-8 text-center">
        <Trophy className={cn(
          'w-16 h-16 mx-auto mb-4',
          percentage >= 80 ? 'text-primary' : 'text-muted-foreground'
        )} />
        <h2 className="text-2xl font-display font-bold mb-2">
          {percentage >= 80 ? 'Excellent Work!' : percentage >= 60 ? 'Good Job!' : 'Keep Practicing!'}
        </h2>
        <p className="text-4xl font-bold gold-text mb-2">
          {score} / {rounds.length}
        </p>
        <p className="text-muted-foreground mb-6">
          You scored {percentage}% on hair color identification
        </p>
        <Button onClick={handleRestart} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Try Again
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Sample {currentRound + 1} of {rounds.length}</span>
          <span>Score: {score}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Hair sample display */}
      <Card className="glass-card p-6">
        <h2 className="text-lg font-medium text-center mb-4 text-muted-foreground">
          What color code is this hair sample?
        </h2>
        
        {/* Hair sample image - cropped from chart */}
        <div className="relative mx-auto w-48 h-48 overflow-hidden rounded-lg border-2 border-border bg-background mb-6">
          <img
            src={hairColorChart}
            alt="Hair sample"
            className="absolute"
            style={{
              width: '240%', // 5 columns
              height: '300%', // 3 rows
              objectFit: 'cover',
              left: `${-round.sample.cropX * 100}%`,
              top: `${-round.sample.cropY * 100}%`,
            }}
          />
        </div>

        {/* Answer options */}
        <div className="grid grid-cols-2 gap-3">
          {round.options.map((option) => {
            const isSelected = selectedAnswer === option.id;
            const isCorrectAnswer = option.id === round.correctAnswer;
            const showResult = selectedAnswer !== null;
            
            return (
              <Button
                key={option.id}
                variant="outline"
                onClick={() => handleSelect(option.id)}
                disabled={selectedAnswer !== null}
                className={cn(
                  'h-auto py-4 px-4 flex flex-col items-center gap-2 transition-all',
                  showResult && isCorrectAnswer && 'border-green-500 bg-green-500/10 text-green-500',
                  showResult && isSelected && !isCorrectAnswer && 'border-destructive bg-destructive/10 text-destructive animate-shake',
                  !showResult && 'hover:border-primary hover:bg-primary/5'
                )}
              >
                <span className="font-bold text-lg">{option.id}</span>
                <span className="text-xs text-muted-foreground">{option.name.split(' - ')[1]}</span>
                {showResult && isCorrectAnswer && (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                )}
                {showResult && isSelected && !isCorrectAnswer && (
                  <XCircle className="w-5 h-5 text-destructive" />
                )}
              </Button>
            );
          })}
        </div>

        {/* Feedback message */}
        {selectedAnswer && (
          <div className={cn(
            'mt-6 p-4 rounded-lg text-center',
            isCorrect ? 'bg-green-500/10 text-green-500' : 'bg-destructive/10 text-destructive'
          )}>
            {isCorrect ? (
              <p className="font-medium">Correct! This is {round.sample.name}</p>
            ) : (
              <p className="font-medium">
                Incorrect. The correct answer is {round.sample.name}
              </p>
            )}
          </div>
        )}

        {/* Next button */}
        {selectedAnswer && (
          <div className="mt-6 text-center">
            <Button onClick={handleNext} className="gap-2">
              {currentRound + 1 >= rounds.length ? 'See Results' : 'Next Sample'}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
