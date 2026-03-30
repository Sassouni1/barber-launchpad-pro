import { Loader2 } from "lucide-react";

export default function GHLCallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto" />
        <p className="text-muted-foreground">Connecting to GoHighLevel...</p>
        <p className="text-xs text-muted-foreground">This window will close automatically.</p>
      </div>
    </div>
  );
}
