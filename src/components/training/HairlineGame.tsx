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

// Different face shapes for practice - coordinates adjusted for 300x400 viewBox (taller head)
const faceShapes = [
  { 
    id: 'oval', 
    name: 'Oval Face', 
    description: 'Classic oval shape - aim for a natural rounded hairline',
    guidePoints: [
      { x: 70, y: 95 }, { x: 95, y: 80 }, { x: 150, y: 72 }, 
      { x: 205, y: 80 }, { x: 230, y: 95 }
    ]
  },
  { 
    id: 'square', 
    name: 'Square Face', 
    description: 'Angular jawline - soften with a slightly rounded hairline',
    guidePoints: [
      { x: 65, y: 100 }, { x: 90, y: 85 }, { x: 150, y: 75 }, 
      { x: 210, y: 85 }, { x: 235, y: 100 }
    ]
  },
  { 
    id: 'round', 
    name: 'Round Face', 
    description: 'Full cheeks - create height with a slightly higher hairline',
    guidePoints: [
      { x: 75, y: 90 }, { x: 100, y: 75 }, { x: 150, y: 68 }, 
      { x: 200, y: 75 }, { x: 225, y: 90 }
    ]
  },
  { 
    id: 'heart', 
    name: 'Heart Face', 
    description: 'Wide forehead - balance with a natural widow\'s peak',
    guidePoints: [
      { x: 60, y: 98 }, { x: 90, y: 82 }, { x: 150, y: 70 }, 
      { x: 210, y: 82 }, { x: 240, y: 98 }
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
    const scaleY = 400 / rect.height;

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
                onClick={() => setRotation(r => r - 10)}
                disabled={rotation <= -20}
              >
                ← Turn
              </Button>
              <span className="text-xs text-muted-foreground px-2">{rotation === 0 ? 'Front' : `${Math.abs(rotation)}° ${rotation > 0 ? 'Right' : 'Left'}`}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRotation(r => r + 10)}
                disabled={rotation >= 20}
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

        {/* Large SVG Head with drawing area - subtle 3D perspective */}
        <div 
          className="flex justify-center mb-6"
          style={{ 
            perspective: '800px',
            perspectiveOrigin: '50% 40%'
          }}
        >
          <div
            className="transition-transform duration-300 ease-out"
            style={{ 
              transformStyle: 'preserve-3d',
              transform: `rotateY(${rotation}deg)`,
            }}
          >
          <svg 
            ref={svgRef}
            viewBox="0 0 300 400" 
            className="w-80 h-[26rem] md:w-[400px] md:h-[520px] cursor-crosshair touch-none"
            style={{ 
              backfaceVisibility: 'hidden',
            }}
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

            {/* Head structure - keep in place */}
            <g>
            
            {/* Neck - moved down */}
            <path d="M 125 300 L 125 340 Q 125 350, 135 350 L 165 350 Q 175 350, 175 340 L 175 300" fill="#d4a574" />
            
            {/* Main face shape - same size, natural forehead */}
            <path 
              d={`
                M 85 130
                Q 80 90, 100 55
                Q 130 25, 150 25
                Q 170 25, 200 55
                Q 220 90, 215 130
                Q 218 170, 210 200
                Q 200 250, 175 280
                Q 155 295, 150 295
                Q 145 295, 125 280
                Q 100 250, 90 200
                Q 82 170, 85 130
              `}
              fill="url(#skinGradient)"
            />

            {/* Bald top - subtle shine */}
            <ellipse cx="150" cy="55" rx="55" ry="30" fill="url(#baldGradient)" />

            {/* Ear left - moved down with face */}
            <ellipse cx="78" cy="175" rx="10" ry="18" fill="#c9956a" />
            <ellipse cx="80" cy="175" rx="7" ry="13" fill="#d4a574" />
            
            {/* Ear right - moved down */}
            <ellipse cx="222" cy="175" rx="10" ry="18" fill="#c9956a" />
            <ellipse cx="220" cy="175" rx="7" ry="13" fill="#d4a574" />

            {/* Hair on sides - left */}
            <path 
              d={`
                M 95 50
                Q 75 60, 70 100
                Q 68 150, 75 200
                Q 78 225, 85 240
                L 92 235
                Q 85 215, 83 180
                Q 82 130, 88 85
                Q 92 60, 105 50
                Z
              `}
              fill="#2b2422"
            />
            
            {/* Hair on sides - right */}
            <path 
              d={`
                M 205 50
                Q 225 60, 230 100
                Q 232 150, 225 200
                Q 222 225, 215 240
                L 208 235
                Q 215 215, 217 180
                Q 218 130, 212 85
                Q 208 60, 195 50
                Z
              `}
              fill="#2b2422"
            />

            {/* Hair texture lines - left */}
            <g stroke="rgba(0,0,0,0.2)" strokeWidth="1" fill="none">
              <path d="M 78 80 Q 73 130, 78 190" />
              <path d="M 85 70 Q 78 120, 82 180" />
            </g>
            
            {/* Hair texture lines - right */}
            <g stroke="rgba(0,0,0,0.2)" strokeWidth="1" fill="none">
              <path d="M 222 80 Q 227 130, 222 190" />
              <path d="M 215 70 Q 222 120, 218 180" />
            </g>

            {/* Beard - chin area - moved down */}
            <path 
              d={`
                M 95 245
                Q 105 280, 125 300
                Q 140 310, 150 312
                Q 160 310, 175 300
                Q 195 280, 205 245
                Q 195 265, 180 280
                Q 160 295, 150 297
                Q 140 295, 120 280
                Q 105 265, 95 245
              `}
              fill="#2b2422"
            />

            {/* Beard texture - moved down */}
            <g stroke="rgba(0,0,0,0.15)" strokeWidth="0.8" fill="none">
              <path d="M 110 265 Q 118 285, 125 295" />
              <path d="M 130 273 Q 138 290, 145 300" />
              <path d="M 150 275 Q 155 293, 155 303" />
              <path d="M 170 273 Q 162 290, 155 300" />
              <path d="M 190 265 Q 182 285, 175 295" />
            </g>

            {/* Eyes - moved down */}
            <ellipse cx="120" cy="175" rx="14" ry="10" fill="#f5f5f0" />
            <ellipse cx="180" cy="175" rx="14" ry="10" fill="#f5f5f0" />
            <circle cx="122" cy="176" r="6" fill="#4a3525" />
            <circle cx="178" cy="176" r="6" fill="#4a3525" />
            <circle cx="123" cy="177" r="3" fill="#1a1210" />
            <circle cx="177" cy="177" r="3" fill="#1a1210" />
            <circle cx="124" cy="174" r="1.5" fill="#fff" />
            <circle cx="178" cy="174" r="1.5" fill="#fff" />

            {/* Eyebrows - moved down */}
            <path 
              d={eyebrowsLifted ? "M 100 155 Q 120 145, 135 155" : "M 100 160 Q 120 152, 135 160"} 
              stroke="#2b2422" 
              strokeWidth="3" 
              strokeLinecap="round" 
              fill="none" 
              className="transition-all duration-300"
            />
            <path 
              d={eyebrowsLifted ? "M 165 155 Q 180 145, 200 155" : "M 165 160 Q 180 152, 200 160"} 
              stroke="#2b2422" 
              strokeWidth="3" 
              strokeLinecap="round" 
              fill="none"
              className="transition-all duration-300"
            />

            {/* Forehead wrinkles - only visible when eyebrows lifted, moved down */}
            {eyebrowsLifted && (
              <g className="animate-fade-in">
                {/* Wrinkle lines */}
                <path d="M 105 138 Q 150 132, 195 138" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 108 125 Q 150 118, 192 125" stroke="#a07050" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 112 112 Q 150 106, 188 112" stroke="#a07050" strokeWidth="2" strokeLinecap="round" fill="none" />
                <path d="M 115 100 Q 150 94, 185 100" stroke="#a07050" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                
                {/* Wrinkle shadows for depth */}
                <path d="M 105 140 Q 150 134, 195 140" stroke="#c9956a" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5" />
                <path d="M 108 127 Q 150 120, 192 127" stroke="#c9956a" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5" />
                <path d="M 112 114 Q 150 108, 188 114" stroke="#c9956a" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.5" />
              </g>
            )}

            {/* Nose - moved down, closer to mouth */}
            <path d="M 150 180 L 147 210 Q 150 218, 153 210" stroke="#c9956a" strokeWidth="1.5" fill="none" />

            {/* Mouth - moved down */}
            <path d="M 130 235 Q 150 247, 170 235" stroke="#a06050" strokeWidth="3" strokeLinecap="round" fill="none" />

            {/* Forehead shine */}
            <ellipse cx="150" cy="70" rx="30" ry="15" fill="rgba(255,255,255,0.08)" opacity={eyebrowsLifted ? 0.3 : 1} />

            {/* Shirt collar - moved down */}
            <path d="M 105 360 Q 130 345, 150 343 Q 170 345, 195 360" stroke="#374151" strokeWidth="10" fill="none" strokeLinecap="round" />

            </g>
            
            {/* Forehead guide zone - only when Show Guide is clicked */}
            {showGuide && (
              <g className="animate-fade-in">
                <path 
                  d="M 95 85 Q 150 75, 205 85" 
                  stroke="#22c55e" 
                  strokeWidth="3" 
                  strokeLinecap="round" 
                  strokeDasharray="6 6" 
                  fill="none" 
                />
                <text x="150" y="65" textAnchor="middle" fill="#22c55e" fontSize="10" fontWeight="500">Ideal hairline</text>
              </g>
            )}
            {/* End of rotated head group */}

            {/* User drawn hairline - completed strokes (not rotated) */}
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
