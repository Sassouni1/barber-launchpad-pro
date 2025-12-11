import { useState, useRef, forwardRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { RotateCcw, ArrowRight, Trophy, Eraser, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';
import { HeadFront, HeadAngled20, HeadAngled40 } from './heads';

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
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);
  const [gameComplete, setGameComplete] = useState(false);
  const [eyebrowsLifted, setEyebrowsLifted] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [rotation, setRotation] = useState(0);
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
      setCurrentStroke([point]);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isSubmitted) return;
    e.preventDefault();
    const point = getSvgCoordinates(e);
    if (point) {
      setCurrentStroke((prev) => [...prev, point]);
    }
  };

  const handleEnd = () => {
    if (currentStroke.length > 1) {
      setStrokes((prev) => [...prev, currentStroke]);
    }
    setCurrentStroke([]);
    setIsDrawing(false);
  };

  const calculateScore = (): number => {
    const allPoints = strokes.flat();
    if (allPoints.length < 5) return 0;

    let totalDistance = 0;
    const guidePoints = round.guidePoints;

    for (const guide of guidePoints) {
      let minDist = Infinity;
      for (const drawn of allPoints) {
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
    if (strokes.flat().length < 5) return;
    
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
      setStrokes([]);
      setCurrentStroke([]);
      setIsSubmitted(false);
    }
  };

  const handleClear = () => {
    setStrokes([]);
    setCurrentStroke([]);
  };

  const handleRestart = () => {
    setCurrentRound(0);
    setStrokes([]);
    setCurrentStroke([]);
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
        <p className="text-xs text-muted-foreground text-center mb-4">
          Draw from left to right across the forehead
        </p>

        {/* Control buttons at top */}
        {!isSubmitted && (
          <div className="flex flex-wrap justify-center gap-3 mb-4">
            <Button
              variant={showGuide ? "default" : "outline"}
              size="sm"
              onClick={() => setShowGuide(!showGuide)}
            >
              {showGuide ? 'Hide Guide' : 'Show Guide'}
            </Button>
            <Button
              variant={eyebrowsLifted ? "default" : "outline"}
              size="sm"
              onClick={() => setEyebrowsLifted(!eyebrowsLifted)}
            >
              {eyebrowsLifted ? 'Release Eyebrows' : 'Lift Eyebrows'}
            </Button>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotation(r => r - 20)}
                disabled={rotation <= -40}
              >
                ← Turn
              </Button>
              <span className="text-xs text-muted-foreground px-2">{rotation === 0 ? 'Front' : `${Math.abs(rotation)}° ${rotation > 0 ? 'Right' : 'Left'}`}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotation(r => r + 20)}
                disabled={rotation >= 40}
              >
                Turn →
              </Button>
            </div>
          </div>
        )}

        {eyebrowsLifted && !isSubmitted && (
          <p className="text-xs text-center text-muted-foreground mb-4">
            The hairline should go <span className="text-green-500 font-medium">1 finger width above</span> the top wrinkle
          </p>
        )}

        {/* Large SVG Head with drawing area */}
        <div className="flex justify-center mb-6 relative">
          {/* Render appropriate head based on rotation */}
          {rotation === 0 && (
            <HeadFront
              ref={svgRef}
              eyebrowsLifted={eyebrowsLifted}
              showGuide={showGuide}
              className="w-80 h-[22rem] md:w-[400px] md:h-[460px] cursor-crosshair touch-none"
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            />
          )}
          
          {rotation === -20 && (
            <HeadAngled20
              ref={svgRef}
              direction="left"
              eyebrowsLifted={eyebrowsLifted}
              showGuide={showGuide}
              className="w-80 h-[22rem] md:w-[400px] md:h-[460px] cursor-crosshair touch-none"
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            />
          )}
          
          {rotation === 20 && (
            <HeadAngled20
              ref={svgRef}
              direction="right"
              eyebrowsLifted={eyebrowsLifted}
              showGuide={showGuide}
              className="w-80 h-[22rem] md:w-[400px] md:h-[460px] cursor-crosshair touch-none"
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            />
          )}
          
          {rotation === -40 && (
            <HeadAngled40
              ref={svgRef}
              direction="left"
              eyebrowsLifted={eyebrowsLifted}
              showGuide={showGuide}
              className="w-80 h-[22rem] md:w-[400px] md:h-[460px] cursor-crosshair touch-none"
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            />
          )}
          
          {rotation === 40 && (
            <HeadAngled40
              ref={svgRef}
              direction="right"
              eyebrowsLifted={eyebrowsLifted}
              showGuide={showGuide}
              className="w-80 h-[22rem] md:w-[400px] md:h-[460px] cursor-crosshair touch-none"
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            />
          )}

          {/* Drawing overlay SVG - always on top */}
          <svg 
            viewBox="0 0 300 350" 
            className="w-80 h-[22rem] md:w-[400px] md:h-[460px] absolute top-0 left-1/2 -translate-x-1/2 pointer-events-none"
          >
            {/* User drawn hairline - completed strokes */}
            {strokes.map((stroke, index) => (
              stroke.length > 1 && (
                <path
                  key={index}
                  d={getPathFromPoints(stroke)}
                  stroke="#1c1a1a"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              )
            ))}
            
            {/* Current stroke being drawn */}
            {currentStroke.length > 1 && (
              <path
                d={getPathFromPoints(currentStroke)}
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
                disabled={strokes.length === 0 && currentStroke.length === 0}
                className="gap-2"
              >
                <Eraser className="w-4 h-4" />
                Clear
              </Button>
              <Button 
                onClick={handleSubmit} 
                disabled={strokes.flat().length < 5}
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
