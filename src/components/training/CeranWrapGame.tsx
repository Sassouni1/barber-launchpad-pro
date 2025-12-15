import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, Eraser, Eye, EyeOff, Send, Trophy, RotateCcw, Layers, Grid3X3, Pencil, ZoomIn, ZoomOut, Move, ChevronLeft, ChevronRight } from 'lucide-react';
import { TopViewHeadSVG } from './TopViewHeadSVG';
import { useAuth } from '@/hooks/useAuth';
import confetti from 'canvas-confetti';

interface Point {
  x: number;
  y: number;
}

interface CeranWrapGameProps {
  onBack: () => void;
}

type ThinningPattern = 'crown' | 'temples' | 'diffuse' | 'frontal' | 'fullTop';
type TapeMode = 'none' | 'vertical' | 'horizontal' | 'complete';
type DrawMode = 'draw' | 'erase';

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
    name: 'Full Top Recession',
    description: 'Trace the large bald area covering the entire top of the scalp',
    guidePoints: [
      // Large oval covering entire top
      { x: 85, y: 70 }, { x: 110, y: 55 }, { x: 150, y: 50 },
      { x: 190, y: 55 }, { x: 215, y: 70 }, { x: 225, y: 100 },
      { x: 228, y: 140 }, { x: 225, y: 180 }, { x: 210, y: 215 },
      { x: 180, y: 240 }, { x: 150, y: 248 }, { x: 120, y: 240 },
      { x: 90, y: 215 }, { x: 75, y: 180 }, { x: 72, y: 140 },
      { x: 75, y: 100 }, { x: 85, y: 70 },
    ],
  },
  {
    pattern: 'frontal',
    name: 'Frontal Thinning',
    description: 'Trace the M-shaped receding hairline at the temples',
    guidePoints: [
      { x: 217.09, y: 132 },
      { x: 207.45, y: 134.36 },
      { x: 194.36, y: 132.91 },
      { x: 180.55, y: 135.82 },
      { x: 161.64, y: 139.45 },
      { x: 144.91, y: 138.36 },
      { x: 122, y: 137.64 },
      { x: 95.82, y: 138.73 },
      { x: 71.82, y: 140.91 },
      { x: 80.73, y: 119.45 },
      { x: 89.45, y: 110.73 },
      { x: 95.45, y: 99.27 },
      { x: 109.09, y: 96.55 },
      { x: 123.27, y: 95.45 },
      { x: 136.91, y: 104.73 },
      { x: 152.73, y: 105.82 },
      { x: 169.09, y: 105.82 },
      { x: 183.27, y: 100.36 },
      { x: 198.55, y: 97.09 },
      { x: 211.64, y: 102.55 },
      { x: 222.55, y: 116.73 },
      { x: 229.64, y: 127.64 },
      { x: 218.18, y: 136.36 },
      { x: 220.36, y: 132 },
      { x: 206.36, y: 137.27 },
    ],
  },
];

export function CeranWrapGame({ onBack }: CeranWrapGameProps) {
  const { isAdmin, isAdminModeActive } = useAuth();
  const canToggleGuide = isAdmin && isAdminModeActive;
  const [currentRound, setCurrentRound] = useState(0);
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showWrap, setShowWrap] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [scores, setScores] = useState<number[]>([]);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [hasCompletedAll, setHasCompletedAll] = useState(() => {
    return localStorage.getItem('ceranWrapGameCompleted') === 'true';
  });
  const [tapeMode, setTapeMode] = useState<TapeMode>('none');
  const [verticalTapes, setVerticalTapes] = useState<number[]>([]);
  const [horizontalTapes, setHorizontalTapes] = useState<number[]>([]);
  const [eyebrowsRaised, setEyebrowsRaised] = useState(false);
  const [drawMode, setDrawMode] = useState<DrawMode>('draw');
  const [isZoomed, setIsZoomed] = useState(false);
  const [isAdjustingGuide, setIsAdjustingGuide] = useState(false);
  const [adjustedFrontalGuide, setAdjustedFrontalGuide] = useState<Point[]>(rounds[2].guidePoints);
  const [adjustedTemplesGuide, setAdjustedTemplesGuide] = useState<Point[]>(rounds[1].guidePoints);
  const [adjustedCrownGuide, setAdjustedCrownGuide] = useState<Point[]>(rounds[0].guidePoints);
  const [draggingPointIndex, setDraggingPointIndex] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const round = rounds[currentRound];
  const currentGuidePoints = 
    round.pattern === 'frontal' ? adjustedFrontalGuide : 
    round.pattern === 'temples' ? adjustedTemplesGuide : 
    round.pattern === 'crown' ? adjustedCrownGuide :
    round.guidePoints;

  const getCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent): Point | null => {
    if (!svgRef.current) return null;
    
    const svg = svgRef.current;
    
    let clientX: number, clientY: number;
    
    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Use SVG coordinate transformation to correctly map screen -> SVG coords,
    // this automatically respects viewBox, zoom, and any transforms.
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const cursorPt = pt.matrixTransform(ctm.inverse());
    
    return { x: cursorPt.x, y: cursorPt.y };
  }, []);

  const handleTapeClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    console.log('[CeranWrapGame] handleTapeClick, tapeMode:', tapeMode);
    const point = getCoordinates(e);
    console.log('[CeranWrapGame] click point:', point);
    if (!point) return;

    if (tapeMode === 'vertical') {
      console.log('[CeranWrapGame] adding vertical tape at x=', point.x);
      setVerticalTapes(prev => {
        const next = [...prev, point.x];
        console.log('[CeranWrapGame] verticalTapes now:', next);
        return next;
      });
    } else if (tapeMode === 'horizontal') {
      console.log('[CeranWrapGame] adding horizontal tape at y=', point.y);
      setHorizontalTapes(prev => {
        const next = [...prev, point.y];
        console.log('[CeranWrapGame] horizontalTapes now:', next);
        return next;
      });
    }
  }, [tapeMode, getCoordinates]);

  const eraseNearPoint = useCallback((point: Point) => {
    const eraseRadius = 6;
    setStrokes(prevStrokes => {
      return prevStrokes.map(stroke => {
        // Split stroke at erased points - remove points near the eraser
        const newStroke: Point[] = [];
        const segments: Point[][] = [];
        
        for (const p of stroke) {
          const distance = Math.sqrt(
            Math.pow(p.x - point.x, 2) + Math.pow(p.y - point.y, 2)
          );
          if (distance > eraseRadius) {
            newStroke.push(p);
          } else if (newStroke.length > 1) {
            // Start a new segment when we hit an erased point
            segments.push([...newStroke]);
            newStroke.length = 0;
          } else {
            newStroke.length = 0;
          }
        }
        if (newStroke.length > 1) {
          segments.push(newStroke);
        }
        return segments;
      }).flat().filter(stroke => stroke.length > 1);
    });
  }, []);

  const handleGuidePointDragStart = useCallback((e: React.MouseEvent | React.TouchEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingPointIndex(index);
  }, []);

  const handleGuidePointDrag = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (draggingPointIndex === null || !isAdjustingGuide) return;
    e.preventDefault();
    
    const point = getCoordinates(e);
    if (point) {
      const pattern = rounds[currentRound].pattern;
      if (pattern === 'frontal') {
        setAdjustedFrontalGuide(prev => {
          const newPoints = [...prev];
          newPoints[draggingPointIndex] = point;
          return newPoints;
        });
      } else if (pattern === 'temples') {
        setAdjustedTemplesGuide(prev => {
          const newPoints = [...prev];
          newPoints[draggingPointIndex] = point;
          return newPoints;
        });
      } else if (pattern === 'crown') {
        setAdjustedCrownGuide(prev => {
          const newPoints = [...prev];
          newPoints[draggingPointIndex] = point;
          return newPoints;
        });
      }
    }
  }, [draggingPointIndex, isAdjustingGuide, getCoordinates, currentRound]);

  const handleGuidePointDragEnd = useCallback(() => {
    setDraggingPointIndex(null);
  }, []);

  const handleStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    // If adjusting guide, don't draw
    if (isAdjustingGuide) return;
    
    // If in tape mode, handle tape placement instead of drawing
    if (tapeMode === 'vertical' || tapeMode === 'horizontal') {
      handleTapeClick(e);
      return;
    }
    
    const point = getCoordinates(e);
    if (point) {
      if (drawMode === 'erase') {
        eraseNearPoint(point);
      } else {
        setIsDrawing(true);
        setCurrentStroke([point]);
      }
    }
  }, [getCoordinates, tapeMode, handleTapeClick, drawMode, eraseNearPoint, isAdjustingGuide]);

  const handleMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    const point = getCoordinates(e);
    if (!point) return;
    
    if (drawMode === 'erase') {
      const isPressed = 'touches' in e ? e.touches.length > 0 : (e as React.MouseEvent).buttons === 1;
      if (isPressed) {
        eraseNearPoint(point);
      }
      return;
    }
    
    if (!isDrawing) return;
    setCurrentStroke(prev => [...prev, point]);
  }, [isDrawing, getCoordinates, drawMode, eraseNearPoint]);

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

    let coveredPoints = 0;

    currentGuidePoints.forEach(guidePoint => {
      const isNearby = allPoints.some(drawnPoint => {
        const distance = Math.sqrt(
          Math.pow(drawnPoint.x - guidePoint.x, 2) + 
          Math.pow(drawnPoint.y - guidePoint.y, 2)
        );
        return distance < 25;
      });
      if (isNearby) coveredPoints++;
    });

    return Math.round((coveredPoints / currentGuidePoints.length) * 100);
  };

  const handleSubmit = () => {
    const score = calculateScore();
    setScores(prev => [...prev, score]);
    setShowGuide(true);
    setIsSubmitted(true);
  };

  const handleNextRound = () => {
    if (currentRound < rounds.length - 1) {
      setCurrentRound(prev => prev + 1);
      setStrokes([]);
      setCurrentStroke([]);
      setShowGuide(false);
      setIsSubmitted(false);
      // Reset tape state for next round
      setTapeMode('none');
      setVerticalTapes([]);
      setHorizontalTapes([]);
      setShowWrap(false);
    } else {
      setHasCompletedAll(true);
      localStorage.setItem('ceranWrapGameCompleted', 'true');
      setIsGameComplete(true);
    }
  };

  const navigateToRound = (roundIndex: number) => {
    if (!hasCompletedAll || roundIndex < 0 || roundIndex >= rounds.length) return;
    setCurrentRound(roundIndex);
    setStrokes([]);
    setCurrentStroke([]);
    setShowGuide(false);
    setTapeMode('none');
    setVerticalTapes([]);
    setHorizontalTapes([]);
    setShowWrap(false);
  };

  const restartGame = () => {
    setCurrentRound(0);
    setStrokes([]);
    setCurrentStroke([]);
    setScores([]);
    setShowGuide(false);
    setIsSubmitted(false);
    setIsGameComplete(false);
    setTapeMode('none');
    setVerticalTapes([]);
    setHorizontalTapes([]);
  };

  const handleAddTape = () => {
    if (tapeMode === 'none' || tapeMode === 'complete') {
      setTapeMode('vertical');
    } else if (tapeMode === 'vertical') {
      setTapeMode('horizontal');
    } else if (tapeMode === 'horizontal') {
      setTapeMode('vertical');
    }
  };

  const clearTape = () => {
    setVerticalTapes([]);
    setHorizontalTapes([]);
    setTapeMode('none');
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
            
            {hasCompletedAll && (
              <div className="flex justify-center items-center gap-4 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => navigateToRound(currentRound - 1)}
                  disabled={currentRound === 0}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Prev
                </Button>
                <span className="text-xs text-muted-foreground">Practice Mode</span>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => navigateToRound(currentRound + 1)}
                  disabled={currentRound === rounds.length - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground mb-4 text-center">
            {round.description}
          </p>

          <div className="relative flex justify-center overflow-hidden">
            <svg
              ref={svgRef}
              viewBox={round.pattern === 'frontal' && isZoomed ? "50 100 200 180" : "0 0 300 360"}
              className={`w-[320px] h-[384px] md:w-[500px] md:h-[600px] lg:w-[550px] lg:h-[660px] touch-none transition-all duration-300 ${
                tapeMode === 'vertical' || tapeMode === 'horizontal'
                  ? 'cursor-cell'
                  : drawMode === 'erase'
                  ? 'cursor-pointer'
                  : 'cursor-crosshair'
              }`}
            >
              {/* Head SVG content (non-interactive, clicks pass through to SVG root) */}
              <g pointerEvents="none">
                <TopViewHeadSVG 
                  thinningPattern={round.pattern}
                  className="w-full h-full"
                  eyebrowsRaised={round.pattern === 'frontal' ? eyebrowsRaised : false}
                />
              </g>

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
              
              {/* Ceran wrap layer - toggleable - matches shorter head shape */}
              {showWrap && (
                <>
                  <ellipse
                    cx="150"
                    cy="170"
                    rx="100"
                    ry="110"
                    fill="url(#wrapShine)"
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth="1"
                    className="transition-opacity duration-300"
                    pointerEvents="none"
                  />
                  <ellipse
                    cx="150"
                    cy="170"
                    rx="100"
                    ry="110"
                    fill="url(#wrapTexture)"
                    className="transition-opacity duration-300"
                    pointerEvents="none"
                  />
                </>
              )}

              {/* Vertical tape strips - clear tape on top of wrap */}
              {verticalTapes.map((x, i) => (
                <rect
                  key={`v-${i}`}
                  x={x - 12}
                  y={60}
                  width={24}
                  height={220}
                  fill="rgba(255,255,255,0.05)"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="1"
                  rx="2"
                />
              ))}

              {/* Horizontal tape strips - clear tape on top of wrap */}
              {horizontalTapes.map((y, i) => (
                <rect
                  key={`h-${i}`}
                  x={50}
                  y={y - 12}
                  width={200}
                  height={24}
                  fill="rgba(255,255,255,0.05)"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="1"
                  rx="2"
                />
              ))}

              {/* Guide points - draggable when adjusting */}
              {(showGuide || isAdjustingGuide) && currentGuidePoints.map((point, i) => (
                <circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r={isAdjustingGuide ? 8 : 4}
                  fill={isAdjustingGuide ? "rgba(59, 130, 246, 0.8)" : "rgba(34, 197, 94, 0.8)"}
                  stroke="white"
                  strokeWidth={isAdjustingGuide ? 2 : 1}
                  style={{ cursor: isAdjustingGuide ? 'grab' : 'default' }}
                  pointerEvents={isAdjustingGuide ? 'all' : 'none'}
                  onMouseDown={(e) => isAdjustingGuide && handleGuidePointDragStart(e, i)}
                  onTouchStart={(e) => isAdjustingGuide && handleGuidePointDragStart(e, i)}
                />
              ))}

              {/* Guide line connecting points */}
              {(showGuide || isAdjustingGuide) && (
                <path
                  d={`M ${currentGuidePoints.map(p => `${p.x},${p.y}`).join(' L ')}`}
                  fill="none"
                  stroke={isAdjustingGuide ? "rgba(59, 130, 246, 0.6)" : "rgba(34, 197, 94, 0.6)"}
                  strokeWidth="3"
                  strokeDasharray="8,4"
                  pointerEvents="none"
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

              {/* Transparent overlay to capture all pointer events */}
              <rect
                x="0"
                y="0"
                width="300"
                height="360"
                fill="rgba(0,0,0,0.001)"
                pointerEvents={isAdjustingGuide ? 'none' : 'all'}
                onMouseDown={handleStart}
                onMouseMove={handleMove}
                onMouseUp={handleEnd}
                onMouseLeave={handleEnd}
                onTouchStart={handleStart}
                onTouchMove={handleMove}
                onTouchEnd={handleEnd}
                style={{ cursor: isAdjustingGuide ? 'default' : tapeMode === 'vertical' || tapeMode === 'horizontal' ? 'cell' : drawMode === 'erase' ? 'pointer' : 'crosshair' }}
              />
              
              {/* Overlay for guide point dragging */}
              {isAdjustingGuide && draggingPointIndex !== null && (
                <rect
                  x="0"
                  y="0"
                  width="300"
                  height="360"
                  fill="transparent"
                  pointerEvents="all"
                  onMouseMove={handleGuidePointDrag}
                  onMouseUp={handleGuidePointDragEnd}
                  onMouseLeave={handleGuidePointDragEnd}
                  onTouchMove={handleGuidePointDrag}
                  onTouchEnd={handleGuidePointDragEnd}
                  style={{ cursor: 'grabbing' }}
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
            variant={drawMode === 'draw' && tapeMode === 'none' ? 'default' : 'outline'}
            onClick={() => { setDrawMode('draw'); setTapeMode('none'); }}
            className="flex-1 gap-2"
          >
            <Pencil className="w-4 h-4" />
            Draw
          </Button>

          {round.pattern === 'frontal' && (
            <>
              <Button
                variant={drawMode === 'erase' ? 'default' : 'outline'}
                onClick={() => { setDrawMode('erase'); setTapeMode('none'); }}
                className="flex-1 gap-2"
              >
                <Eraser className="w-4 h-4" />
                Erase
              </Button>

              <Button
                variant={isZoomed ? 'default' : 'outline'}
                onClick={() => setIsZoomed(!isZoomed)}
                className="flex-1 gap-2"
              >
                {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                {isZoomed ? 'Zoom Out' : 'Zoom In'}
              </Button>
            </>
          )}

          {round.pattern === 'frontal' && (
            <>
              <Button
                variant={eyebrowsRaised ? 'default' : 'outline'}
                onClick={() => setEyebrowsRaised(!eyebrowsRaised)}
                className="flex-1 gap-2"
              >
                {eyebrowsRaised ? 'Lower Brows' : 'Lift Eyebrows'}
              </Button>
            </>
          )}

          {isAdmin && isAdminModeActive && (round.pattern === 'frontal' || round.pattern === 'temples' || round.pattern === 'crown') && (
            <Button
              variant={isAdjustingGuide ? 'default' : 'outline'}
              onClick={() => {
                if (isAdjustingGuide) {
                  // Log the adjusted coordinates when done
                  const adjustedGuide = 
                    round.pattern === 'frontal' ? adjustedFrontalGuide : 
                    round.pattern === 'temples' ? adjustedTemplesGuide : 
                    adjustedCrownGuide;
                  console.log(`ADJUSTED ${round.pattern.toUpperCase()} GUIDE POINTS:`, JSON.stringify(adjustedGuide, null, 2));
                }
                setIsAdjustingGuide(!isAdjustingGuide);
                if (!isAdjustingGuide) {
                  setDrawMode('draw');
                  setTapeMode('none');
                }
              }}
              className="flex-1 gap-2"
            >
              <Move className="w-4 h-4" />
              {isAdjustingGuide ? 'Done' : 'Adjust Guide'}
            </Button>
          )}

          <Button
            variant={tapeMode !== 'none' ? 'default' : 'outline'}
            onClick={handleAddTape}
            className="flex-1 gap-2"
            disabled={!showWrap}
          >
            <Grid3X3 className="w-4 h-4" />
            {(tapeMode === 'none' || tapeMode === 'complete') && 'V-Tape'}
            {tapeMode === 'vertical' && 'H-Tape'}
            {tapeMode === 'horizontal' && 'V-Tape'}
          </Button>

          {(verticalTapes.length > 0 || horizontalTapes.length > 0) && (
            <Button
              variant="ghost"
              onClick={clearTape}
              className="flex-1 gap-2 text-xs"
            >
              Clear
            </Button>
          )}
          
          {/* Only show guide toggle for admins before submission */}
          {canToggleGuide && !isSubmitted && (
            <Button
              variant="outline"
              onClick={() => setShowGuide(!showGuide)}
              className="flex-1 gap-2"
            >
              {showGuide ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showGuide ? 'Hide' : 'Guide'}
            </Button>
          )}

          {/* After submission, allow toggling the guide for everyone */}
          {isSubmitted && (
            <Button
              variant="outline"
              onClick={() => setShowGuide(!showGuide)}
              className="flex-1 gap-2"
            >
              {showGuide ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showGuide ? 'Hide' : 'Guide'}
            </Button>
          )}

          {!isSubmitted ? (
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
