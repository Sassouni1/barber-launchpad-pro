import { useEffect, useRef, useState } from 'react';
import { Canvas as FabricCanvas } from 'fabric';
import { Button } from '@/components/ui/button';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange: (hasSignature: boolean, signatureData: string | null) => void;
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

    canvas.freeDrawingBrush.color = '#d4af37';
    canvas.freeDrawingBrush.width = 2;

    canvas.on('path:created', () => {
      const dataUrl = canvas.toDataURL({ format: 'png', multiplier: 1 });
      onSignatureChange(true, dataUrl);
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
