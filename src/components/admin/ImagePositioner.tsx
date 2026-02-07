import { useRef, useState, useCallback, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Move } from "lucide-react";

interface ImagePositionerProps {
  imageUrl: string;
  posX: number;
  posY: number;
  onPositionChange: (x: number, y: number) => void;
}

const ImagePositioner = ({ imageUrl, posX, posY, onPositionChange }: ImagePositionerProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDragging || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
      const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)));
      onPositionChange(x, y);
    },
    [isDragging, onPositionChange]
  );

  const handlePointerUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [isDragging, handlePointerMove, handlePointerUp]);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.round(Math.min(100, Math.max(0, ((e.clientX - rect.left) / rect.width) * 100)));
    const y = Math.round(Math.min(100, Math.max(0, ((e.clientY - rect.top) / rect.height) * 100)));
    onPositionChange(x, y);
  };

  return (
    <div className="space-y-2">
      <Label className="flex items-center gap-1.5">
        <Move className="h-3.5 w-3.5" />
        Drag to reposition image
      </Label>
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className="relative w-full h-64 rounded-md overflow-hidden border border-border cursor-grab active:cursor-grabbing select-none touch-none"
      >
        <img
          src={imageUrl}
          alt="Preview"
          className="w-full h-full object-cover pointer-events-none"
          style={{ objectPosition: `${posX}% ${posY}%` }}
          draggable={false}
        />
        {/* Crosshair indicator */}
        <div
          className="absolute w-5 h-5 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ left: `${posX}%`, top: `${posY}%` }}
        >
          <div className="absolute inset-0 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" />
          <div className="absolute left-1/2 top-1/2 w-1 h-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]" />
        </div>
      </div>
    </div>
  );
};

export default ImagePositioner;
