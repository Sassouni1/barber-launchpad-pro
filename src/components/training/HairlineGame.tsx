import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RotateCcw, ArrowRight, Trophy, Eraser, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface Point {
  x: number;
  y: number;
}

// Different face shapes for practice
const faceShapes = [
  { 
    id: 'oval', 
    name: 'Oval Face', 
    description: 'Classic oval shape - aim for a natural rounded hairline',
    guidePoints: [
      { x: 45, y: 58 }, { x: 65, y: 48 }, { x: 100, y: 42 }, 
      { x: 135, y: 48 }, { x: 155, y: 58 }
    ]
  },
  { 
    id: 'square', 
    name: 'Square Face', 
    description: 'Angular jawline - soften with a slightly rounded hairline',
    guidePoints: [
      { x: 42, y: 62 }, { x: 60, y: 50 }, { x: 100, y: 45 }, 
      { x: 140, y: 50 }, { x: 158, y: 62 }
    ]
  },
  { 
    id: 'round', 
    name: 'Round Face', 
    description: 'Full cheeks - create height with a slightly higher hairline',
    guidePoints: [
      { x: 50, y: 55 }, { x: 70, y: 45 }, { x: 100, y: 40 }, 
      { x: 130, y: 45 }, { x: 150, y: 55 }
    ]
  },
  { 
    id: 'heart', 
    name: 'Heart Face', 
    description: 'Wide forehead - balance with a natural widow\'s peak',
    guidePoints: [
      { x: 40, y: 60 }, { x: 60, y: 50 }, { x: 100, y: 44 }, 
      { x: 140, y: 50 }, { x: 160, y: 60 }
    ]
  },
];

interface HairlineGameProps {
  onBack: () => void;
}

export function HairlineGame({ onBack }: HairlineGameProps) {
  const [currentRound, setCurrentRound] = useState(0);
  const [drawnPoints, setDrawnPoints] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const round = faceShapes[currentRound];
  const progress = (currentRound / faceShapes.length) * 100;

  const getSvgCoordinates = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;

    const rect = svg.getBoundingClientRect();
    const scaleX = 200 / rect.width;
    const scaleY = 220 / rect.height;

    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    if (isSubmitted) return;
    e.preventDefault();
    setIsDrawing(true);
    const point = getSvgCoordinates(e);
    if (point) {
      setDrawnPoints([point]);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isSubmitted) return;
    e.preventDefault();
    const point = getSvgCoordinates(e);
    if (point) {
      setDrawnPoints((prev) => [...prev, point]);
    }
  };

  const handleEnd = () => {
    setIsDrawing(false);
  };

  const calculateScore = (): number => {
    if (drawnPoints.length < 5) return 0;

    let totalDistance = 0;
    const guidePoints = round.guidePoints;

    for (const guide of guidePoints) {
      let minDist = Infinity;
      for (const drawn of drawnPoints) {
        const dist = Math.sqrt((guide.x - drawn.x) ** 2 + (guide.y - drawn.y) ** 2);
        if (dist < minDist) minDist = dist;
      }
      totalDistance += minDist;
    }

    const avgDistance = totalDistance / guidePoints.length;
    const score = Math.max(0, Math.min(100, 100 - avgDistance * 2));
    return Math.round(score);
  };

  const handleSubmit = () => {
    if (drawnPoints.length < 5) return;
    
    const roundScore = calculateScore();
    setScore((s) => s + roundScore);
    setIsSubmitted(true);

    if (roundScore >= 70) {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#D4AF37', '#FFD700', '#B8860B'],
      });
    }
  };

  const handleNext = () => {
    if (currentRound + 1 >= faceShapes.length) {
      setGameComplete(true);
      const avgScore = score / faceShapes.length;
      if (avgScore >= 70) {
        confetti({
          particleCount: 200,
          spread: 100,
          origin: { y: 0.5 },
          colors: ['#D4AF37', '#FFD700', '#B8860B'],
        });
      }
    } else {
      setCurrentRound((r) => r + 1);
      setDrawnPoints([]);
      setIsSubmitted(false);
    }
  };

  const handleClear = () => {
    setDrawnPoints([]);
  };

  const handleRestart = () => {
    setCurrentRound(0);
    setDrawnPoints([]);
    setIsSubmitted(false);
    setScore(0);
    setGameComplete(false);
  };

  // Generate path string from points
  const getPathFromPoints = (points: Point[]): string => {
    if (points.length < 2) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  };

  const getGuidePathFromPoints = (points: Point[]): string => {
    if (points.length < 2) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const cpX = (prev.x + curr.x) / 2;
      const cpY = Math.min(prev.y, curr.y) - 3;
      path += ` Q ${cpX} ${cpY}, ${curr.x} ${curr.y}`;
    }
    return path;
  };

  if (gameComplete) {
    const avgScore = Math.round(score / faceShapes.length);
    return (
      <Card className="glass-card p-8 text-center">
        <Trophy className={cn(
          'w-16 h-16 mx-auto mb-4',
          avgScore >= 70 ? 'text-primary' : 'text-muted-foreground'
        )} />
        <h2 className="text-2xl font-display font-bold mb-2">
          {avgScore >= 80 ? 'Excellent Work!' : avgScore >= 60 ? 'Good Job!' : 'Keep Practicing!'}
        </h2>
        <p className="text-4xl font-bold gold-text mb-2">
          {avgScore}%
        </p>
        <p className="text-muted-foreground mb-6">
          Average hairline accuracy across all face shapes
        </p>
        <div className="flex justify-center gap-4">
          <Button variant="outline" onClick={onBack} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Games
          </Button>
          <Button onClick={handleRestart} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with back button */}
      <Button variant="ghost" onClick={onBack} className="gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" />
        Back to Games
      </Button>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Round {currentRound + 1} of {faceShapes.length}</span>
          <span>Total Score: {score}</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <Card className="glass-card p-6">
        <h2 className="text-lg font-medium text-center mb-2">
          Draw the Hairline
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-2">
          {round.name}: {round.description}
        </p>
        <p className="text-xs text-muted-foreground text-center mb-6">
          Draw from left to right across the forehead
        </p>

        {/* SVG Head with drawing area */}
        <div className="flex justify-center mb-6">
          <svg 
            ref={svgRef}
            viewBox="0 0 200 220" 
            className="w-52 h-56 cursor-crosshair touch-none"
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          >
            {/* Face - front view */}
            <ellipse 
              cx="100" 
              cy="120" 
              rx="65" 
              ry="80" 
              fill="#d4a574" 
            />
            
            {/* Ear left */}
            <ellipse cx="35" cy="120" rx="10" ry="18" fill="#c9956a" />
            <ellipse cx="37" cy="120" rx="6" ry="12" fill="#d4a574" />
            
            {/* Ear right */}
            <ellipse cx="165" cy="120" rx="10" ry="18" fill="#c9956a" />
            <ellipse cx="163" cy="120" rx="6" ry="12" fill="#d4a574" />
            
            {/* Hair on sides - left */}
            <path 
              d={`
                M 35 70
                Q 25 90, 28 120
                Q 30 150, 40 160
                L 45 160
                Q 38 150, 36 120
                Q 35 90, 42 70
                Z
              `}
              fill="#2b2422"
            />
            
            {/* Hair on sides - right */}
            <path 
              d={`
                M 165 70
                Q 175 90, 172 120
                Q 170 150, 160 160
                L 155 160
                Q 162 150, 164 120
                Q 165 90, 158 70
                Z
              `}
              fill="#2b2422"
            />
            
            {/* Hair texture lines - left */}
            <g stroke="rgba(0,0,0,0.2)" strokeWidth="1" fill="none">
              <path d="M 38 80 Q 32 100, 34 130" />
              <path d="M 40 75 Q 35 100, 37 140" />
            </g>
            
            {/* Hair texture lines - right */}
            <g stroke="rgba(0,0,0,0.2)" strokeWidth="1" fill="none">
              <path d="M 162 80 Q 168 100, 166 130" />
              <path d="M 160 75 Q 165 100, 163 140" />
            </g>

            {/* Bald top area - subtle shine */}
            <ellipse 
              cx="100" 
              cy="70" 
              rx="45" 
              ry="25" 
              fill="rgba(255,255,255,0.08)" 
            />
            
            {/* Eyes */}
            <ellipse cx="75" cy="125" rx="10" ry="6" fill="#fff" />
            <circle cx="75" cy="125" r="4" fill="#3a2a25" />
            <ellipse cx="125" cy="125" rx="10" ry="6" fill="#fff" />
            <circle cx="125" cy="125" r="4" fill="#3a2a25" />
            
            {/* Eyebrows */}
            <path d="M 60 115 Q 75 108, 88 115" stroke="#4a3830" strokeWidth="2.5" fill="none" />
            <path d="M 112 115 Q 125 108, 140 115" stroke="#4a3830" strokeWidth="2.5" fill="none" />
            
            {/* Nose */}
            <path d="M 100 125 L 97 145 Q 100 150, 103 145" stroke="#c9956a" strokeWidth="2" fill="none" />
            
            {/* Mouth */}
            <path d="M 85 170 Q 100 178, 115 170" stroke="#b87a5a" strokeWidth="2.5" fill="none" />
            
            {/* Forehead guide zone - subtle dashed line */}
            <line 
              x1="40" y1="55" x2="160" y2="55" 
              stroke="rgba(255,255,255,0.2)" 
              strokeWidth="1" 
              strokeDasharray="4 4"
            />
            
            {/* Shirt collar hint */}
            <path 
              d="M 55 200 Q 70 190, 100 188 Q 130 190, 145 200" 
              stroke="#374151" 
              strokeWidth="8" 
              fill="none"
              strokeLinecap="round"
            />

            {/* User drawn hairline */}
            {drawnPoints.length > 1 && (
              <path
                d={getPathFromPoints(drawnPoints)}
                stroke="#1c1a1a"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
                className="animate-fade-in"
              />
            )}

            {/* Guide hairline (shown after submit) */}
            {isSubmitted && (
              <path
                d={getGuidePathFromPoints(round.guidePoints)}
                stroke="#22c55e"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray="4 4"
                fill="none"
                className="animate-fade-in"
              />
            )}
          </svg>
        </div>

        {/* Result feedback */}
        {isSubmitted && (
          <div className={cn(
            'mb-4 p-4 rounded-lg text-center animate-fade-in',
            calculateScore() >= 70 
              ? 'bg-green-500/10 border border-green-500/30 text-green-500' 
              : 'bg-amber-500/10 border border-amber-500/30 text-amber-500'
          )}>
            <p className="font-medium">
              Accuracy: {calculateScore()}%
            </p>
            <p className="text-sm opacity-80 mt-1">
              The green dashed line shows the ideal hairline
            </p>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex justify-center gap-4">
          {!isSubmitted ? (
            <>
              <Button 
                variant="outline"
                onClick={handleClear} 
                disabled={drawnPoints.length === 0}
                className="gap-2"
              >
                <Eraser className="w-4 h-4" />
                Clear
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={drawnPoints.length < 5}
                className="gap-2"
              >
                Submit Hairline
              </Button>
            </>
          ) : (
            <Button onClick={handleNext} className="gap-2">
              {currentRound + 1 >= faceShapes.length ? 'See Results' : 'Next Face Shape'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
