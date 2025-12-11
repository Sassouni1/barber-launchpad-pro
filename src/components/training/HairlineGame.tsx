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
            className="w-80 h-[22rem] md:w-[400px] md:h-[460px] cursor-crosshair touch-none"
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
              <radialGradient id="skinGradient" cx="50%" cy="40%" r="55%">
                <stop offset="0%" stopColor="#e8c49a" />
                <stop offset="50%" stopColor="#d4a574" />
                <stop offset="100%" stopColor="#c9956a" />
              </radialGradient>
              <radialGradient id="baldGradient" cx="50%" cy="40%" r="50%">
                <stop offset="0%" stopColor="#e8c49a" />
                <stop offset="70%" stopColor="#ddb688" />
                <stop offset="100%" stopColor="#d4a574" />
              </radialGradient>
            </defs>

            {/* Neck */}
            <path d="M 125 260 L 125 295 Q 125 305, 135 305 L 165 305 Q 175 305, 175 295 L 175 260" fill="#d4a574" />
            
            {/* Main face shape - proper proportions like reference */}
            <path 
              d={`
                M 85 130
                Q 80 90, 100 60
                Q 130 35, 150 35
                Q 170 35, 200 60
                Q 220 90, 215 130
                Q 218 170, 210 200
                Q 200 240, 175 260
                Q 155 272, 150 272
                Q 145 272, 125 260
                Q 100 240, 90 200
                Q 82 170, 85 130
              `}
              fill="url(#skinGradient)"
            />

            {/* Bald top - subtle shine */}
            <ellipse cx="150" cy="70" rx="50" ry="30" fill="url(#baldGradient)" />

            {/* Ear left */}
            <ellipse cx="78" cy="150" rx="10" ry="18" fill="#c9956a" />
            <ellipse cx="80" cy="150" rx="7" ry="13" fill="#d4a574" />
            
            {/* Ear right */}
            <ellipse cx="222" cy="150" rx="10" ry="18" fill="#c9956a" />
            <ellipse cx="220" cy="150" rx="7" ry="13" fill="#d4a574" />

            {/* Hair on sides - left - matching reference style */}
            <path 
              d={`
                M 95 55
                Q 75 65, 70 100
                Q 68 140, 75 180
                Q 78 200, 85 210
                L 92 205
                Q 85 190, 83 160
                Q 82 120, 88 85
                Q 92 65, 105 55
                Z
              `}
              fill="#2b2422"
            />
            
            {/* Hair on sides - right */}
            <path 
              d={`
                M 205 55
                Q 225 65, 230 100
                Q 232 140, 225 180
                Q 222 200, 215 210
                L 208 205
                Q 215 190, 217 160
                Q 218 120, 212 85
                Q 208 65, 195 55
                Z
              `}
              fill="#2b2422"
            />

            {/* Hair texture lines - left */}
            <g stroke="rgba(0,0,0,0.2)" strokeWidth="1" fill="none">
              <path d="M 78 80 Q 73 120, 78 170" />
              <path d="M 85 70 Q 78 110, 82 160" />
            </g>
            
            {/* Hair texture lines - right */}
            <g stroke="rgba(0,0,0,0.2)" strokeWidth="1" fill="none">
              <path d="M 222 80 Q 227 120, 222 170" />
              <path d="M 215 70 Q 222 110, 218 160" />
            </g>

            {/* Beard - chin area */}
            <path 
              d={`
                M 95 210
                Q 105 245, 125 265
                Q 140 275, 150 277
                Q 160 275, 175 265
                Q 195 245, 205 210
                Q 195 225, 180 240
                Q 160 255, 150 257
                Q 140 255, 120 240
                Q 105 225, 95 210
              `}
              fill="#2b2422"
            />

            {/* Beard texture */}
            <g stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" fill="none">
              <path d="M 110 230 Q 118 250, 125 260" />
              <path d="M 130 238 Q 138 255, 145 265" />
              <path d="M 150 240 Q 155 258, 155 268" />
              <path d="M 170 238 Q 162 255, 155 265" />
              <path d="M 190 230 Q 182 250, 175 260" />
            </g>

            {/* Eyes */}
            <ellipse cx="120" cy="145" rx="14" ry="10" fill="#f5f5f0" />
            <ellipse cx="180" cy="145" rx="14" ry="10" fill="#f5f5f0" />
            <circle cx="122" cy="146" r="6" fill="#4a3525" />
            <circle cx="178" cy="146" r="6" fill="#4a3525" />
            <circle cx="123" cy="147" r="3" fill="#1a1210" />
            <circle cx="177" cy="147" r="3" fill="#1a1210" />
            <circle cx="124" cy="144" r="1.5" fill="#fff" />
            <circle cx="178" cy="144" r="1.5" fill="#fff" />

            {/* Eyebrows */}
            <path d="M 100 130 Q 120 122, 135 130" stroke="#2b2422" strokeWidth="3" strokeLinecap="round" fill="none" />
            <path d="M 165 130 Q 180 122, 200 130" stroke="#2b2422" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* Nose */}
            <path d="M 150 145 L 147 180 Q 150 188, 153 180" stroke="#c9956a" strokeWidth="1.5" fill="none" />

            {/* Mouth */}
            <path d="M 130 210 Q 150 222, 170 210" stroke="#a06050" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* Forehead shine */}
            <ellipse cx="150" cy="65" rx="30" ry="15" fill="rgba(255,255,255,0.08)" />

            {/* Shirt collar */}
            <path d="M 105 315 Q 130 300, 150 298 Q 170 300, 195 315" stroke="#374151" strokeWidth="10" fill="none" strokeLinecap="round" />

            {/* Forehead guide zone */}
            <line x1="88" y1="55" x2="212" y2="55" stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="5 5" />

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
