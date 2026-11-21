import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { useBusinessCard } from "@/hooks/useBusinessCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SIGN_IMAGE = "/lesson-assets/getting-reviews-sign-base.png";
const CARD_BASE = "https://member.thebarberlaunch.com/card/";

export function ReviewSignCustomizer() {
  const { data: card, isLoading } = useBusinessCard();
  const [name, setName] = useState("");
  const [downloading, setDownloading] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrUrl = card?.short_code ? `${CARD_BASE}${card.short_code}` : "";
  const hasReviewLink = Boolean(card?.google_review_url?.trim());

  const handleDownload = async () => {
    const cleanName = name.trim();
    if (!cleanName || !qrUrl || !qrCanvasRef.current) return;
    setDownloading(true);
    try {
      const background = new Image();
      await new Promise<void>((resolve, reject) => {
        background.onload = () => resolve();
        background.onerror = () => reject(new Error("Sign image could not be loaded"));
        background.src = SIGN_IMAGE;
      });

      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: "letter" });
      pdf.addImage(background, "PNG", 0, 0, 8.5, 11);
      pdf.setFont("helvetica", "bold");
      let fontSize = 31;
      pdf.setFontSize(fontSize);
      while (fontSize > 15 && pdf.getTextWidth(cleanName) > 6.8) {
        fontSize -= 1;
        pdf.setFontSize(fontSize);
      }
      pdf.setTextColor(0, 0, 0);
      pdf.text(cleanName, 4.25, 1.5, { align: "center" });
      pdf.addImage(qrCanvasRef.current.toDataURL("image/png"), "PNG", 2.45, 2.52, 3.6, 3.6);
      const fileName = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "review";
      pdf.save(`${fileName}-review-sign.pdf`);
      toast.success("Review sign downloaded");
    } catch (error) {
      console.error(error);
      toast.error("Could not download the review sign");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <section className="glass-card rounded-2xl p-4 md:p-6 space-y-5">
      <div>
        <h2 className="font-display text-xl font-semibold">Make your review sign</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Enter your name or business name. The QR code from Share Your Card is added automatically.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="review-sign-name">Name or business name</Label>
        <Input
          id="review-sign-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={55}
          placeholder="Type the name to show on your sign"
        />
      </div>

      {qrUrl && hasReviewLink ? (
        <p className="text-xs text-muted-foreground break-all">
          QR destination: {qrUrl}. Clients can open your card and tap its Google review link.
        </p>
      ) : qrUrl ? (
        <p className="text-sm text-muted-foreground">
          Your card QR is ready. Add your Google review link to the <Link className="text-primary underline" to="/business-card">Digital Business Card</Link> before displaying this Google review sign to customers.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {isLoading ? "Loading your business card QR code…" : <>Create your <Link className="text-primary underline" to="/business-card">Digital Business Card</Link> first.</>}
        </p>
      )}

      <div className="relative mx-auto w-full max-w-md bg-white overflow-hidden" aria-label="Review sign preview">
        <img src={SIGN_IMAGE} alt="Printable review sign design" className="block w-full" />
        <div className="absolute top-[11%] left-[8%] w-[84%] text-center text-black font-semibold leading-tight break-words" style={{ fontSize: "clamp(16px, 4vw, 31px)" }}>
          {name.trim() || <span className="text-gray-400">Your name or business name</span>}
        </div>
        <div className="absolute left-[29%] top-[22.9%] w-[42.35%] aspect-square bg-white flex items-center justify-center">
          {qrUrl ? (
            <QRCodeSVG value={qrUrl} size={1024} level="M" includeMargin className="w-full h-full" />
          ) : (
            <span className="text-center text-gray-400 text-xs px-3">Your QR code appears here</span>
          )}
        </div>
      </div>

      {qrUrl && <QRCodeCanvas ref={qrCanvasRef} value={qrUrl} size={1024} level="M" includeMargin className="absolute opacity-0 pointer-events-none" aria-hidden="true" />}
      <Button onClick={handleDownload} disabled={!name.trim() || !qrUrl || downloading} className="w-full sm:w-auto">
        <Download className="w-4 h-4 mr-2" /> {downloading ? "Preparing PDF…" : "Download 8.5 × 11 sign"}
      </Button>
    </section>
  );
}
