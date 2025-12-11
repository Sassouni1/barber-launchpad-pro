import { useState, useRef } from 'react';
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

// Different face shapes for practice - coordinates adjusted for 300x350 viewBox
const faceShapes = [
  { 
    id: 'oval', 
    name: 'Oval Face', 
    description: 'Classic oval shape - aim for a natural rounded hairline',
    guidePoints: [
      { x: 70, y: 75 }, { x: 95, y: 60 }, { x: 150, y: 52 }, 
      { x: 205, y: 60 }, { x: 230, y: 75 }
    ]
  },
  { 
    id: 'square', 
    name: 'Square Face', 
    description: 'Angular jawline - soften with a slightly rounded hairline',
    guidePoints: [
      { x: 65, y: 80 }, { x: 90, y: 65 }, { x: 150, y: 55 }, 
      { x: 210, y: 65 }, { x: 235, y: 80 }
    ]
  },
  { 
    id: 'round', 
    name: 'Round Face', 
    description: 'Full cheeks - create height with a slightly higher hairline',
    guidePoints: [
      { x: 75, y: 70 }, { x: 100, y: 55 }, { x: 150, y: 48 }, 
      { x: 200, y: 55 }, { x: 225, y: 70 }
    ]
  },
  { 
    id: 'heart', 
    name: 'Heart Face', 
    description: 'Wide forehead - balance with a natural widow\'s peak',
    guidePoints: [
      { x: 60, y: 78 }, { x: 90, y: 62 }, { x: 150, y: 50 }, 
      { x: 210, y: 62 }, { x: 240, y: 78 }
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
    const scaleX = 300 / rect.width;
    const scaleY = 350 / rect.height;

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

        {/* Large SVG Head with drawing area */}
        <div className="flex justify-center mb-6">
          <svg 
            ref={svgRef}
            viewBox="0 0 300 350" 
            className="w-72 h-80 md:w-80 md:h-[22rem] cursor-crosshair touch-none"
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          >
            {/* Definitions for gradients */}
            <defs>
              <radialGradient id="skinGradient" cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor="#e0b88a" />
                <stop offset="70%" stopColor="#d4a574" />
                <stop offset="100%" stopColor="#c9956a" />
              </radialGradient>
              <radialGradient id="baldGradient" cx="50%" cy="30%" r="50%">
                <stop offset="0%" stopColor="#e0b88a" />
                <stop offset="60%" stopColor="#d4a574" />
                <stop offset="100%" stopColor="#c9956a" />
              </radialGradient>
            </defs>

            {/* Neck */}
            <rect x="115" y="280" width="70" height="60" fill="#d4a574" rx="5" />
            
            {/* Main face shape */}
            <ellipse cx="150" cy="160" rx="95" ry="115" fill="url(#skinGradient)" />

            {/* Bald top - lighter area */}
            <ellipse cx="150" cy="85" rx="70" ry="45" fill="url(#baldGradient)" />

            {/* Ear left */}
            <ellipse cx="52" cy="165" rx="14" ry="25" fill="#c9956a" />
            <ellipse cx="55" cy="165" rx="9" ry="18" fill="#d4a574" />
            <ellipse cx="56" cy="165" rx="4" ry="10" fill="#c9956a" opacity="0.3" />
            
            {/* Ear right */}
            <ellipse cx="248" cy="165" rx="14" ry="25" fill="#c9956a" />
            <ellipse cx="245" cy="165" rx="9" ry="18" fill="#d4a574" />
            <ellipse cx="244" cy="165" rx="4" ry="10" fill="#c9956a" opacity="0.3" />

            {/* Hair on sides - left */}
            <path 
              d={`
                M 55 80
                Q 35 100, 38 140
                Q 40 180, 50 210
                Q 55 230, 65 240
                L 75 235
                Q 65 220, 60 200
                Q 52 170, 55 140
                Q 58 110, 68 85
                Q 75 70, 85 65
                L 75 60
                Q 60 65, 55 80
              `}
              fill="#2b2422"
            />
            
            {/* Hair on sides - right */}
            <path 
              d={`
                M 245 80
                Q 265 100, 262 140
                Q 260 180, 250 210
                Q 245 230, 235 240
                L 225 235
                Q 235 220, 240 200
                Q 248 170, 245 140
                Q 242 110, 232 85
                Q 225 70, 215 65
                L 225 60
                Q 240 65, 245 80
              `}
              fill="#2b2422"
            />

            {/* Hair texture lines - left */}
            <g stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" fill="none">
              <path d="M 50 100 Q 42 140, 50 190" />
              <path d="M 58 90 Q 48 130, 55 180" />
              <path d="M 65 85 Q 55 120, 60 170" />
            </g>
            
            {/* Hair texture lines - right */}
            <g stroke="rgba(0,0,0,0.15)" strokeWidth="1.5" fill="none">
              <path d="M 250 100 Q 258 140, 250 190" />
              <path d="M 242 90 Q 252 130, 245 180" />
              <path d="M 235 85 Q 245 120, 240 170" />
            </g>

            {/* Hair highlights */}
            <g stroke="rgba(255,255,255,0.1)" strokeWidth="2" fill="none">
              <path d="M 62 95 Q 52 130, 58 175" />
              <path d="M 238 95 Q 248 130, 242 175" />
            </g>

            {/* Beard */}
            <path 
              d={`
                M 70 235
                Q 80 270, 110 290
                Q 130 300, 150 302
                Q 170 300, 190 290
                Q 220 270, 230 235
                Q 220 245, 200 255
                Q 175 268, 150 270
                Q 125 268, 100 255
                Q 80 245, 70 235
              `}
              fill="#2b2422"
            />

            {/* Beard texture */}
            <g stroke="rgba(0,0,0,0.12)" strokeWidth="1" fill="none">
              <path d="M 90 250 Q 100 270, 110 280" />
              <path d="M 110 255 Q 120 275, 130 285" />
              <path d="M 130 258 Q 140 278, 150 290" />
              <path d="M 150 258 Q 160 278, 170 285" />
              <path d="M 170 255 Q 180 275, 190 280" />
              <path d="M 190 250 Q 200 270, 210 280" />
            </g>

            {/* Sideburns - left */}
            <path 
              d={`M 65 200 Q 68 220, 70 235 Q 60 225, 55 210 Q 52 195, 58 185 L 65 200`}
              fill="#2b2422"
            />

            {/* Sideburns - right */}
            <path 
              d={`M 235 200 Q 232 220, 230 235 Q 240 225, 245 210 Q 248 195, 242 185 L 235 200`}
              fill="#2b2422"
            />

            {/* Eyes */}
            <ellipse cx="110" cy="165" rx="18" ry="12" fill="#f5f5f0" />
            <ellipse cx="190" cy="165" rx="18" ry="12" fill="#f5f5f0" />
            <circle cx="112" cy="166" r="8" fill="#4a3525" />
            <circle cx="188" cy="166" r="8" fill="#4a3525" />
            <circle cx="113" cy="167" r="4" fill="#1a1210" />
            <circle cx="187" cy="167" r="4" fill="#1a1210" />
            <circle cx="115" cy="164" r="2" fill="#fff" />
            <circle cx="189" cy="164" r="2" fill="#fff" />

            {/* Eyebrows */}
            <path d="M 85 145 Q 110 135, 130 145" stroke="#2b2422" strokeWidth="4" strokeLinecap="round" fill="none" />
            <path d="M 170 145 Q 190 135, 215 145" stroke="#2b2422" strokeWidth="4" strokeLinecap="round" fill="none" />

            {/* Nose */}
            <path d="M 150 160 L 145 200 Q 150 210, 155 200 L 150 160" stroke="#c9956a" strokeWidth="2" fill="none" />
            <ellipse cx="142" cy="205" rx="6" ry="4" fill="#c9956a" opacity="0.3" />
            <ellipse cx="158" cy="205" rx="6" ry="4" fill="#c9956a" opacity="0.3" />

            {/* Mouth */}
            <path d="M 120 240 Q 150 255, 180 240" stroke="#a06050" strokeWidth="4" strokeLinecap="round" fill="none" />

            {/* Forehead shine */}
            <ellipse cx="150" cy="80" rx="40" ry="20" fill="rgba(255,255,255,0.08)" />

            {/* Shirt collar */}
            <path d="M 85 330 Q 115 315, 150 312 Q 185 315, 215 330" stroke="#374151" strokeWidth="12" fill="none" strokeLinecap="round" />

            {/* Forehead guide zone - subtle */}
            <line x1="55" y1="65" x2="245" y2="65" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="6 6" />

            {/* User drawn hairline */}
            {drawnPoints.length > 1 && (
              <path
                d={getPathFromPoints(drawnPoints)}
                stroke="#1c1a1a"
                strokeWidth="4"
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
                strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray="6 6"
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
