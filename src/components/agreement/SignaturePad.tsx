import { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas, PencilBrush } from 'fabric';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange: (hasSignature: boolean, signatureData: string | null) => void;
}

// Convert signature to white background with black strokes for storage/download
function convertToCleanSignature(canvas: FabricCanvas): string {
  // Create an offscreen canvas
  const offscreen = document.createElement('canvas');
  offscreen.width = canvas.getWidth();
  offscreen.height = canvas.getHeight();
  const ctx = offscreen.getContext('2d');
  if (!ctx) return canvas.toDataURL({ format: 'png', multiplier: 1 });
  
  // Fill with white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, offscreen.width, offscreen.height);
  
  // Get the original canvas data
  const originalCanvas = canvas.toCanvasElement();
  const originalCtx = originalCanvas.getContext('2d');
  if (!originalCtx) return canvas.toDataURL({ format: 'png', multiplier: 1 });
  
  // Get image data and convert gold to black
  const imageData = originalCtx.getImageData(0, 0, originalCanvas.width, originalCanvas.height);
  const data = imageData.data;
  
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    
    // Check if pixel is part of the dark background (#1a1a1a)
    if (r < 50 && g < 50 && b < 50) {
      // Make it transparent (will show white background)
      data[i + 3] = 0;
    } else if (a > 0) {
      // Convert any visible stroke to black
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = 255;
    }
  }
  
  // Put modified image data onto offscreen canvas
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = originalCanvas.width;
  tempCanvas.height = originalCanvas.height;
  const tempCtx = tempCanvas.getContext('2d');
  if (tempCtx) {
    tempCtx.putImageData(imageData, 0, 0);
    ctx.drawImage(tempCanvas, 0, 0);
  }
  
  return offscreen.toDataURL('image/png');
}

export function SignaturePad({ onSignatureChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [fabricCanvas, setFabricCanvas] = useState<FabricCanvas | null>(null);

  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const containerWidth = containerRef.current.offsetWidth;
    const canvasWidth = Math.min(containerWidth - 2, 500);
    const canvasHeight = 150;

    const canvas = new FabricCanvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: '#1a1a1a',
      isDrawingMode: true,
    });

    // Create and set the brush explicitly for Fabric.js v6
    const brush = new PencilBrush(canvas);
    brush.color = '#d4af37';
    brush.width = 2;
    canvas.freeDrawingBrush = brush;

    canvas.on('path:created', () => {
      // Export with white background and black signature for storage
      const cleanDataUrl = convertToCleanSignature(canvas);
      onSignatureChange(true, cleanDataUrl);
    });

    setFabricCanvas(canvas);

    return () => {
      canvas.dispose();
    };
  }, [onSignatureChange]);

  const handleClear = () => {
    if (!fabricCanvas) return;
    fabricCanvas.clear();
    fabricCanvas.backgroundColor = '#1a1a1a';
    fabricCanvas.renderAll();
    onSignatureChange(false, null);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm text-muted-foreground">Sign here:</label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          <Eraser className="w-3 h-3 mr-1" />
          Clear
        </Button>
      </div>
      <div 
        ref={containerRef}
        className="border border-border/50 rounded-lg overflow-hidden bg-[#1a1a1a]"
      >
        <canvas ref={canvasRef} className="cursor-crosshair" />
      </div>
      <p className="text-xs text-muted-foreground text-center">
        Use your mouse or finger to sign above
      </p>
    </div>
  );
}
