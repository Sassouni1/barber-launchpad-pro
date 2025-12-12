import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Eraser, Eye, EyeOff, Send, Trophy, RotateCcw, Layers } from 'lucide-react';
import { TopViewHeadSVG } from './TopViewHeadSVG';
import confetti from 'canvas-confetti';

interface Point {
  x: number;
  y: number;
}

interface CeranWrapGameProps {
  onBack: () => void;
}

type ThinningPattern = 'crown' | 'temples' | 'diffuse' | 'frontal' | 'fullTop';

interface Round {
  pattern: ThinningPattern;
  name: string;
  description: string;
  guidePoints: Point[];
}

const rounds: Round[] = [
  {
    pattern: 'crown',
    name: 'Crown Thinning',
    description: 'Trace the circular thinning area at the crown (back/top of head)',
    guidePoints: [
      { x: 124, y: 217 }, { x: 134, y: 207 }, { x: 150, y: 202 },
      { x: 166, y: 207 }, { x: 176, y: 217 }, { x: 182, y: 232 },
      { x: 178, y: 250 }, { x: 168, y: 262 }, { x: 150, y: 267 },
      { x: 132, y: 262 }, { x: 122, y: 250 }, { x: 118, y: 232 },
      { x: 124, y: 217 },
    ],
  },
  {
    pattern: 'temples',
    name: 'Temple Recession',
    description: 'Trace the M-shaped recession at the temples and front hairline',
    guidePoints: [
      // Left temple
      { x: 80, y: 75 }, { x: 90, y: 90 }, { x: 85, y: 110 }, { x: 80, y: 125 },
      // Front hairline 
      { x: 100, y: 80 }, { x: 130, y: 70 }, { x: 150, y: 65 }, { x: 170, y: 70 }, { x: 200, y: 80 },
      // Right temple
      { x: 220, y: 75 }, { x: 210, y: 90 }, { x: 215, y: 110 }, { x: 220, y: 125 },
    ],
  },
  {
    pattern: 'diffuse',
    name: 'Diffuse Thinning',
    description: 'Trace the larger general thinning area across the top of the scalp',
    guidePoints: [
      { x: 95, y: 70 }, { x: 120, y: 55 }, { x: 150, y: 50 },
      { x: 180, y: 55 }, { x: 205, y: 70 }, { x: 210, y: 100 },
      { x: 208, y: 140 }, { x: 200, y: 175 }, { x: 175, y: 195 },
      { x: 150, y: 200 }, { x: 125, y: 195 }, { x: 100, y: 175 },
      { x: 92, y: 140 }, { x: 90, y: 100 }, { x: 95, y: 70 },
    ],
  },
  {
    pattern: 'frontal',
    name: 'Frontal Thinning',
    description: 'Trace the thinning area at the front portion of the scalp',
    guidePoints: [
      { x: 90, y: 65 }, { x: 100, y: 80 }, { x: 110, y: 95 },
      { x: 130, y: 105 }, { x: 150, y: 108 }, { x: 170, y: 105 },
      { x: 190, y: 95 }, { x: 200, y: 80 }, { x: 210, y: 65 },
      { x: 180, y: 55 }, { x: 150, y: 50 }, { x: 120, y: 55 },
      { x: 90, y: 65 },
    ],
  },
  {
    pattern: 'fullTop',
    name: 'Full Top Balding',
    description: 'Trace the extensive bald area covering the entire top of the scalp (horseshoe pattern)',
    guidePoints: [
      // Large oval covering entire top from front hairline to crown
      { x: 80, y: 75 }, { x: 100, y: 60 }, { x: 130, y: 52 }, { x: 150, y: 50 },
      { x: 170, y: 52 }, { x: 200, y: 60 }, { x: 220, y: 75 },
      { x: 230, y: 110 }, { x: 235, y: 150 }, { x: 232, y: 195 },
      { x: 220, y: 235 }, { x: 195, y: 265 }, { x: 150, y: 280 },
      { x: 105, y: 265 }, { x: 80, y: 235 }, { x: 68, y: 195 },
      { x: 65, y: 150 }, { x: 70, y: 110 }, { x: 80, y: 75 },
    ],
  },
];

export function CeranWrapGame({ onBack }: CeranWrapGameProps) {
  const [currentRound, setCurrentRound] = useState(0);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showWrap, setShowWrap] = useState(true);
  const [scores, setScores] = useState<number[]>([]);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);

  const round = rounds[currentRound];

  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent): Point | null => {
    if (!svgRef.current) return null;
    
    const svg = svgRef.current;
    const rect = svg.getBoundingClientRect();
    
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    const viewBox = svg.viewBox.baseVal;
    const x = ((clientX - rect.left) / rect.width) * viewBox.width;
    const y = ((clientY - rect.top) / rect.height) * viewBox.height;
    
    return { x, y };
  }, []);

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    const point = getCoordinates(e);
    if (point) {
      setIsDrawing(true);
      setCurrentStroke([point]);
    }
  }, [getCoordinates]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();
    
    const point = getCoordinates(e);
    if (point) {
      setCurrentStroke(prev => [...prev, point]);
    }
  }, [isDrawing, getCoordinates]);

  const handleEnd = useCallback(() => {
    if (isDrawing && currentStroke.length > 0) {
      setStrokes(prev => [...prev, currentStroke]);
      setCurrentStroke([]);
    }
    setIsDrawing(false);
  }, [isDrawing, currentStroke]);

  const clearDrawing = () => {
    setStrokes([]);
    setCurrentStroke([]);
  };

  const calculateScore = (): number => {
    const allPoints = strokes.flat();
    if (allPoints.length === 0) return 0;

    const guidePoints = round.guidePoints;
    let coveredPoints = 0;

    guidePoints.forEach(guidePoint => {
      const isNearby = allPoints.some(drawnPoint => {
        const distance = Math.sqrt(
          Math.pow(drawnPoint.x - guidePoint.x, 2) + 
          Math.pow(drawnPoint.y - guidePoint.y, 2)
        );
        return distance < 25;
      });
      if (isNearby) coveredPoints++;
    });

    return Math.round((coveredPoints / guidePoints.length) * 100);
  };

  const handleSubmit = () => {
    const score = calculateScore();
    setScores(prev => [...prev, score]);
    setShowGuide(true);
  };

  const handleNextRound = () => {
    if (currentRound < rounds.length - 1) {
      setCurrentRound(prev => prev + 1);
      setStrokes([]);
      setCurrentStroke([]);
      setShowGuide(false);
    } else {
      setIsGameComplete(true);
    }
  };

  const restartGame = () => {
    setCurrentRound(0);
    setStrokes([]);
    setCurrentStroke([]);
    setScores([]);
    setShowGuide(false);
    setIsGameComplete(false);
  };

  useEffect(() => {
    if (isGameComplete) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
      });
    }
  }, [isGameComplete]);

  const averageScore = scores.length > 0 
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) 
    : 0;

  if (isGameComplete) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" onClick={onBack} className="gap-2 -ml-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Games
        </Button>

        <Card className="glass-card p-8 text-center">
          <Trophy className="w-16 h-16 mx-auto text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-2">Template Training Complete!</h2>
          <p className="text-muted-foreground mb-6">
            You've practiced all thinning patterns
          </p>
          
          <div className="space-y-4 mb-6">
            {rounds.map((r, i) => (
              <div key={r.pattern} className="flex justify-between items-center">
                <span>{r.name}</span>
                <span className={scores[i] >= 70 ? 'text-green-500' : scores[i] >= 50 ? 'text-yellow-500' : 'text-red-500'}>
                  {scores[i]}%
                </span>
              </div>
            ))}
            <div className="border-t pt-4 flex justify-between items-center font-bold">
              <span>Average Score</span>
              <span className="text-primary">{averageScore}%</span>
            </div>
          </div>

          <Button onClick={restartGame} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Play Again
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Button variant="ghost" onClick={onBack} className="gap-2 -ml-2">
        <ArrowLeft className="w-4 h-4" />
        Back to Games
      </Button>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Drawing area */}
        <Card className="glass-card p-4 flex-1">
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-muted-foreground">
                Round {currentRound + 1} of {rounds.length}
              </span>
              <span className="text-sm font-medium">{round.name}</span>
            </div>
            <Progress value={((currentRound) / rounds.length) * 100} className="h-2" />
          </div>

          <p className="text-sm text-muted-foreground mb-4 text-center">
            {round.description}
          </p>

          <div className="relative flex justify-center">
            <svg
              ref={svgRef}
              viewBox="0 0 300 360"
              className="w-[320px] h-[384px] md:w-[500px] md:h-[600px] lg:w-[550px] lg:h-[660px] cursor-crosshair touch-none"
              onMouseDown={handleStart}
              onMouseMove={handleMove}
              onMouseUp={handleEnd}
              onMouseLeave={handleEnd}
              onTouchStart={handleStart}
              onTouchMove={handleMove}
              onTouchEnd={handleEnd}
            >
              {/* Head SVG content */}
              <TopViewHeadSVG 
                thinningPattern={round.pattern}
                className="w-full h-full"
              />

              {/* Ceran wrap overlay */}
              <defs>
                <linearGradient id="wrapShine" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.15" />
                  <stop offset="30%" stopColor="white" stopOpacity="0.05" />
                  <stop offset="70%" stopColor="white" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="white" stopOpacity="0.08" />
                </linearGradient>
                <pattern id="wrapTexture" patternUnits="userSpaceOnUse" width="20" height="20">
                  <path d="M 0 10 Q 5 8 10 10 Q 15 12 20 10" fill="none" stroke="white" strokeWidth="0.3" opacity="0.2" />
                  <path d="M 0 5 Q 5 3 10 5 Q 15 7 20 5" fill="none" stroke="white" strokeWidth="0.2" opacity="0.15" />
                </pattern>
              </defs>
              
              {/* Ceran wrap layer - toggleable */}
              {showWrap && (
                <>
                  <ellipse
                    cx="150"
                    cy="180"
                    rx="95"
                    ry="130"
                    fill="url(#wrapShine)"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="1"
                    className="transition-opacity duration-300"
                  />
                  <ellipse
                    cx="150"
                    cy="180"
                    rx="95"
                    ry="130"
                    fill="url(#wrapTexture)"
                    className="transition-opacity duration-300"
                  />
                </>
              )}

              {/* Guide points */}
              {showGuide && round.guidePoints.map((point, i) => (
                <circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r="4"
                  fill="rgba(34, 197, 94, 0.8)"
                  stroke="white"
                  strokeWidth="1"
                />
              ))}

              {/* Guide line connecting points */}
              {showGuide && (
                <path
                  d={`M ${round.guidePoints.map(p => `${p.x},${p.y}`).join(' L ')}`}
                  fill="none"
                  stroke="rgba(34, 197, 94, 0.6)"
                  strokeWidth="3"
                  strokeDasharray="8,4"
                />
              )}

              {/* Drawn strokes - marker style */}
              {strokes.map((stroke, strokeIndex) => (
                <path
                  key={strokeIndex}
                  d={stroke.length > 0 
                    ? `M ${stroke[0].x},${stroke[0].y} ${stroke.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')}`
                    : ''
                  }
                  fill="none"
                  stroke="rgba(220, 38, 38, 0.85)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}

              {/* Current stroke being drawn */}
              {currentStroke.length > 0 && (
                <path
                  d={`M ${currentStroke[0].x},${currentStroke[0].y} ${currentStroke.slice(1).map(p => `L ${p.x},${p.y}`).join(' ')}`}
                  fill="none"
                  stroke="rgba(220, 38, 38, 0.85)"
                  strokeWidth="4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}
            </svg>
          </div>
        </Card>

        {/* Controls */}
        <Card className="glass-card p-4 md:w-48 flex flex-row md:flex-col gap-3">
          <Button 
            variant="outline" 
            onClick={clearDrawing}
            className="flex-1 gap-2"
            disabled={showGuide}
          >
            <Eraser className="w-4 h-4" />
            Clear
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowWrap(!showWrap)}
            className="flex-1 gap-2"
          >
            <Layers className="w-4 h-4" />
            {showWrap ? 'Remove Wrap' : 'Add Wrap'}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowGuide(!showGuide)}
            className="flex-1 gap-2"
          >
            {showGuide ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {showGuide ? 'Hide' : 'Guide'}
          </Button>

          {!showGuide ? (
            <Button 
              onClick={handleSubmit}
              className="flex-1 gap-2"
              disabled={strokes.length === 0}
            >
              <Send className="w-4 h-4" />
              Submit
            </Button>
          ) : (
            <Button 
              onClick={handleNextRound}
              className="flex-1 gap-2"
            >
              {currentRound < rounds.length - 1 ? 'Next' : 'Finish'}
            </Button>
          )}

          {showGuide && scores[currentRound] !== undefined && (
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {scores[currentRound]}%
              </div>
              <div className="text-xs text-muted-foreground">Accuracy</div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
