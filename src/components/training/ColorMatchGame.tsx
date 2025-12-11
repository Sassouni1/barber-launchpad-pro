import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { CheckCircle2, RotateCcw, Trophy, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { BaldingHeadSVG } from './BaldingHeadSVG';
import { HairSwatch } from './HairSwatch';

// Hair color swatches with their hex colors based on real hair system codes
const hairSwatches = [
  { id: '1', name: '#1 - Jet Black', color: '#0a0a0a' },
  { id: '1A', name: '#1A - Off Black', color: '#1a1a1a' },
  { id: '1B', name: '#1B - Natural Black', color: '#2a2117' },
  { id: '2', name: '#2 - Darkest Brown', color: '#3b2717' },
  { id: '3', name: '#3 - Dark Brown', color: '#4a3520' },
  { id: '4', name: '#4 - Medium Brown', color: '#5c4033' },
  { id: '5', name: '#5 - Light Brown', color: '#7a5c45' },
  { id: '6', name: '#6 - Chestnut Brown', color: '#8b6914' },
];

// Grey percentage swatches for grey matching rounds - base hair color + grey percentage
const greySwatches = [
  { id: '1A', name: '#1A - Off Black', color: '#1a1a1a', greyPercent: 0 },
  { id: '10G', name: '10% Grey', color: '#1a1a1a', greyPercent: 10 },
  { id: '20G', name: '20% Grey', color: '#1a1a1a', greyPercent: 20 },
  { id: '30G', name: '30% Grey', color: '#1a1a1a', greyPercent: 30 },
  { id: '40G', name: '40% Grey', color: '#1a1a1a', greyPercent: 40 },
];

// Rounds with target colors that trainees need to match
const rounds = [
  { targetColor: '#2a2117', correctAnswer: '1B', description: 'Natural black with warm undertones', type: 'color' as const, greyPercent: 0 },
  { targetColor: '#3b2717', correctAnswer: '2', description: 'Very dark brown, almost black', type: 'color' as const, greyPercent: 0 },
  { targetColor: '#0a0a0a', correctAnswer: '1', description: 'Pure jet black', type: 'color' as const, greyPercent: 0 },
  { targetColor: '#1a1a1a', correctAnswer: '30G', description: 'Client has 30% grey mixed in - find the matching grey level', type: 'grey' as const, greyPercent: 30 },
  { targetColor: '#4a3520', correctAnswer: '3', description: 'Rich dark brown', type: 'color' as const, greyPercent: 0 },
  { targetColor: '#5c4033', correctAnswer: '4', description: 'Medium warm brown', type: 'color' as const, greyPercent: 0 },
  { targetColor: '#1a1a1a', correctAnswer: '1A', description: 'Soft off-black', type: 'color' as const, greyPercent: 0 },
];

export function ColorMatchGame() {
  const [currentRound, setCurrentRound] = useState(0);
  const [selectedSwatch, setSelectedSwatch] = useState<string | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);

  const round = rounds[currentRound];
  const progress = ((currentRound) / rounds.length) * 100;
  const activePalette = round.type === 'grey' ? greySwatches : hairSwatches;
  const currentSwatch = activePalette.find(s => s.id === selectedSwatch);
  const selectedGreySwatch = round.type === 'grey' ? greySwatches.find(s => s.id === selectedSwatch) : null;

  const handleSwatchSelect = (swatchId: string) => {
    if (isSubmitted) return;
    setSelectedSwatch(swatchId);
    setShowOverlay(true);
  };

  const handleSubmit = () => {
    if (!selectedSwatch) return;
    
    setIsSubmitted(true);
    const isCorrect = selectedSwatch === round.correctAnswer;
    
    if (isCorrect) {
      setScore((s) => s + 1);
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
      if (score >= rounds.length * 0.7) {
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#D4AF37', '#FFD700', '#B8860B'],
        });
      }
    } else {
      setCurrentRound((r) => r + 1);
      setSelectedSwatch(null);
      setShowOverlay(true);
      setIsSubmitted(false);
    }
  };

  const handleRestart = () => {
    setCurrentRound(0);
    setSelectedSwatch(null);
    setShowOverlay(true);
    setIsSubmitted(false);
    setScore(0);
    setGameComplete(false);
  };

  if (gameComplete) {
    const percentage = Math.round((score / rounds.length) * 100);
    return (
      <Card className="glass-card p-8 text-center">
        <Trophy className={cn(
          'w-16 h-16 mx-auto mb-4',
          percentage >= 70 ? 'text-primary' : 'text-muted-foreground'
        )} />
        <h2 className="text-2xl font-display font-bold mb-2">
          {percentage >= 80 ? 'Excellent Work!' : percentage >= 60 ? 'Good Job!' : 'Keep Practicing!'}
        </h2>
        <p className="text-4xl font-bold gold-text mb-2">
          {score} / {rounds.length}
        </p>
        <p className="text-muted-foreground mb-6">
          You matched {percentage}% of hair colors correctly
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
          <span>Round {currentRound + 1} of {rounds.length}</span>
          <span>Score: {score}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card className="glass-card p-6">
        <h2 className="text-lg font-medium text-center mb-2">
          Match the Client's Hair Color
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Select a hair swatch to place on top of the client's hair. Find the color that matches best!
        </p>

        {/* Main comparison area */}
        <div className="flex flex-col items-center gap-6 mb-8">
          {/* Client's head (back view) with overlay swatch */}
          <div className="relative">
            <p className="text-sm text-muted-foreground text-center mb-3">Client's Hair (Back View)</p>
            <div className="relative inline-block">
              <BaldingHeadSVG 
                hairColor={round.targetColor}
                greyPercentage={round.greyPercent}
                className="w-52 h-56"
              />
              
              {/* Overlay hair swatch positioned on top of the head */}
              {selectedSwatch && currentSwatch && showOverlay && (
                <div className="absolute top-8 left-1/2 -translate-x-1/2 w-28 transition-all duration-300 animate-fade-in">
                  <HairSwatch 
                    color={currentSwatch.color}
                    greyPercent={selectedGreySwatch?.greyPercent || 0}
                    label={selectedGreySwatch ? selectedGreySwatch.name.split(' ')[0] : `#${currentSwatch.id}`}
                    isCorrect={isSubmitted && selectedSwatch === round.correctAnswer}
                    isWrong={isSubmitted && selectedSwatch !== round.correctAnswer}
                  />
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground text-center mt-2">{round.description}</p>
            
            {/* Toggle overlay visibility */}
            {selectedSwatch && !isSubmitted && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setShowOverlay(!showOverlay)}
                className="mt-2 mx-auto flex gap-2"
              >
                {showOverlay ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showOverlay ? 'Hide Sample' : 'Show Sample'}
              </Button>
            )}
          </div>

          {/* Swatch palette */}
          <div className="text-center w-full">
            <p className="text-sm text-muted-foreground mb-3">Select a Hair Sample to Compare</p>
            <div className="flex flex-wrap justify-center gap-3">
              {activePalette.map((swatch) => (
                <button
                  key={swatch.id}
                  onClick={() => handleSwatchSelect(swatch.id)}
                  disabled={isSubmitted}
                  className={cn(
                    'relative w-16 h-12 rounded-lg border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-primary/50',
                    selectedSwatch === swatch.id 
                      ? 'border-primary ring-2 ring-primary/30 scale-110' 
                      : 'border-border hover:border-primary/50',
                    isSubmitted && swatch.id === round.correctAnswer && 'border-green-500 ring-2 ring-green-500/30',
                    isSubmitted && 'opacity-70'
                  )}
                  style={{ backgroundColor: swatch.color }}
                  title={swatch.name}
                >
                  <span className="sr-only">{swatch.name}</span>
                  {/* Hair texture effect */}
                  <div 
                    className="absolute inset-0 rounded-md opacity-20"
                    style={{
                      backgroundImage: `repeating-linear-gradient(
                        90deg,
                        transparent,
                        transparent 1px,
                        rgba(255,255,255,0.3) 1px,
                        rgba(255,255,255,0.3) 2px
                      )`
                    }}
                  />
                  <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                    {swatch.id.includes('G') ? swatch.name.split(' ')[0] : `#${swatch.id}`}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected swatch info */}
        {selectedSwatch && currentSwatch && !isSubmitted && (
          <div className="text-center mb-4 p-3 rounded-lg bg-secondary/30 border border-border">
            <p className="text-sm">
              Comparing: <span className="font-bold text-primary">{currentSwatch.name}</span>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Look at the sample on the client's hair. Does it match?
            </p>
          </div>
        )}

        {/* Result feedback */}
        {isSubmitted && (
          <div className={cn(
            'mb-4 p-4 rounded-lg text-center',
            selectedSwatch === round.correctAnswer 
              ? 'bg-green-500/10 border border-green-500/30 text-green-500' 
              : 'bg-destructive/10 border border-destructive/30 text-destructive'
          )}>
            {selectedSwatch === round.correctAnswer ? (
              <p className="font-medium">
                Correct! The best match is {activePalette.find(s => s.id === round.correctAnswer)?.name}
              </p>
            ) : (
              <p className="font-medium">
                Not quite. The correct answer is {activePalette.find(s => s.id === round.correctAnswer)?.name}
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-center gap-4">
          {!isSubmitted ? (
            <Button 
              onClick={handleSubmit} 
              disabled={!selectedSwatch}
              className="gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              Submit Answer
            </Button>
          ) : (
            <Button onClick={handleNext} className="gap-2">
              {currentRound + 1 >= rounds.length ? 'See Results' : 'Next Round'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
