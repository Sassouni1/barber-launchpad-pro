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
      { x: 80, y: 85 }, { x: 100, y: 75 }, { x: 120, y: 70 }, 
      { x: 150, y: 68 }, { x: 180, y: 70 }, { x: 200, y: 75 }, { x: 220, y: 85 }
    ]
  },
  { 
    id: 'square', 
    name: 'Square Face', 
    description: 'Angular jawline - soften with a slightly rounded hairline',
    guidePoints: [
      { x: 75, y: 90 }, { x: 95, y: 78 }, { x: 120, y: 72 }, 
      { x: 150, y: 70 }, { x: 180, y: 72 }, { x: 205, y: 78 }, { x: 225, y: 90 }
    ]
  },
  { 
    id: 'round', 
    name: 'Round Face', 
    description: 'Full cheeks - create height with a slightly higher hairline',
    guidePoints: [
      { x: 85, y: 80 }, { x: 105, y: 72 }, { x: 125, y: 68 }, 
      { x: 150, y: 65 }, { x: 175, y: 68 }, { x: 195, y: 72 }, { x: 215, y: 80 }
    ]
  },
  { 
    id: 'heart', 
    name: 'Heart Face', 
    description: 'Wide forehead - balance with a natural widow\'s peak',
    guidePoints: [
      { x: 70, y: 88 }, { x: 90, y: 78 }, { x: 115, y: 72 }, 
      { x: 150, y: 68 }, { x: 185, y: 72 }, { x: 210, y: 78 }, { x: 230, y: 88 }
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
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const round = faceShapes[currentRound];
  const progress = (currentRound / faceShapes.length) * 100;

  // Draw the face and hairline on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw face outline
    drawFace(ctx, round.id);

    // Draw user's hairline
    if (drawnPoints.length > 1) {
      ctx.beginPath();
      ctx.moveTo(drawnPoints[0].x, drawnPoints[0].y);
      
      for (let i = 1; i < drawnPoints.length; i++) {
        ctx.lineTo(drawnPoints[i].x, drawnPoints[i].y);
      }
      
      ctx.strokeStyle = '#1c1a1a';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Add hair texture strokes
      for (let i = 0; i < drawnPoints.length - 1; i += 3) {
        const point = drawnPoints[i];
        for (let j = 0; j < 5; j++) {
          ctx.beginPath();
          ctx.moveTo(point.x + (Math.random() - 0.5) * 8, point.y);
          ctx.lineTo(point.x + (Math.random() - 0.5) * 8, point.y - 15 - Math.random() * 20);
          ctx.strokeStyle = '#2b2422';
          ctx.lineWidth = 1;
          ctx.stroke();
        }
      }
    }

    // Show guide after submission
    if (isSubmitted) {
      ctx.beginPath();
      ctx.setLineDash([5, 5]);
      ctx.moveTo(round.guidePoints[0].x, round.guidePoints[0].y);
      
      for (let i = 1; i < round.guidePoints.length; i++) {
        ctx.lineTo(round.guidePoints[i].x, round.guidePoints[i].y);
      }
      
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [drawnPoints, isSubmitted, round]);

  const drawFace = (ctx: CanvasRenderingContext2D, shapeId: string) => {
    ctx.save();
    
    // Skin color
    const skinColor = '#d4a574';
    const shadowColor = '#c9956a';

    // Draw face based on shape
    ctx.beginPath();
    
    switch (shapeId) {
      case 'oval':
        ctx.ellipse(150, 180, 85, 110, 0, 0, Math.PI * 2);
        break;
      case 'square':
        ctx.moveTo(65, 100);
        ctx.lineTo(65, 260);
        ctx.quadraticCurveTo(65, 290, 95, 290);
        ctx.lineTo(205, 290);
        ctx.quadraticCurveTo(235, 290, 235, 260);
        ctx.lineTo(235, 100);
        ctx.quadraticCurveTo(235, 70, 150, 70);
        ctx.quadraticCurveTo(65, 70, 65, 100);
        break;
      case 'round':
        ctx.ellipse(150, 175, 90, 100, 0, 0, Math.PI * 2);
        break;
      case 'heart':
        ctx.moveTo(150, 280);
        ctx.quadraticCurveTo(70, 220, 60, 150);
        ctx.quadraticCurveTo(60, 80, 150, 70);
        ctx.quadraticCurveTo(240, 80, 240, 150);
        ctx.quadraticCurveTo(230, 220, 150, 280);
        break;
    }
    
    ctx.fillStyle = skinColor;
    ctx.fill();
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw ears
    ctx.beginPath();
    ctx.ellipse(52, 180, 12, 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = skinColor;
    ctx.fill();
    ctx.strokeStyle = shadowColor;
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(248, 180, 12, 20, 0, 0, Math.PI * 2);
    ctx.fillStyle = skinColor;
    ctx.fill();
    ctx.strokeStyle = shadowColor;
    ctx.stroke();

    // Draw eyes
    ctx.beginPath();
    ctx.ellipse(115, 180, 12, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(115, 180, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2a25';
    ctx.fill();

    ctx.beginPath();
    ctx.ellipse(185, 180, 12, 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(185, 180, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#3a2a25';
    ctx.fill();

    // Draw eyebrows
    ctx.beginPath();
    ctx.moveTo(100, 165);
    ctx.quadraticCurveTo(115, 158, 130, 165);
    ctx.strokeStyle = '#4a3830';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(170, 165);
    ctx.quadraticCurveTo(185, 158, 200, 165);
    ctx.stroke();

    // Draw nose
    ctx.beginPath();
    ctx.moveTo(150, 175);
    ctx.lineTo(145, 210);
    ctx.quadraticCurveTo(150, 218, 155, 210);
    ctx.strokeStyle = shadowColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw mouth
    ctx.beginPath();
    ctx.moveTo(130, 245);
    ctx.quadraticCurveTo(150, 255, 170, 245);
    ctx.strokeStyle = '#b87a5a';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw forehead guide zone (subtle)
    ctx.beginPath();
    ctx.setLineDash([3, 6]);
    ctx.moveTo(60, 90);
    ctx.lineTo(240, 90);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.restore();
  };

  const getCanvasCoordinates = (e: React.MouseEvent | React.TouchEvent): Point | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

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
    const point = getCanvasCoordinates(e);
    if (point) {
      setDrawnPoints([point]);
    }
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || isSubmitted) return;
    e.preventDefault();
    const point = getCanvasCoordinates(e);
    if (point) {
      setDrawnPoints((prev) => [...prev, point]);
    }
  };

  const handleEnd = () => {
    setIsDrawing(false);
  };

  const calculateScore = (): number => {
    if (drawnPoints.length < 5) return 0;

    // Simple scoring based on proximity to guide points
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
    // Score from 0-100, closer = better
    const score = Math.max(0, Math.min(100, 100 - avgDistance));
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

        {/* Drawing canvas */}
        <div 
          ref={containerRef}
          className="flex justify-center mb-6"
        >
          <canvas
            ref={canvasRef}
            width={300}
            height={320}
            className="border border-border rounded-lg bg-card cursor-crosshair touch-none"
            onMouseDown={handleStart}
            onMouseMove={handleMove}
            onMouseUp={handleEnd}
            onMouseLeave={handleEnd}
            onTouchStart={handleStart}
            onTouchMove={handleMove}
            onTouchEnd={handleEnd}
          />
        </div>

        {/* Result feedback */}
        {isSubmitted && (
          <div className={cn(
            'mb-4 p-4 rounded-lg text-center',
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
