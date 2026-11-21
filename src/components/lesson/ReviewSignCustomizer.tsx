import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeCanvas, QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Download, ExternalLink, Printer } from "lucide-react";
import { toast } from "sonner";
import { useBusinessCard } from "@/hooks/useBusinessCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const SIGN_IMAGE = "/lesson-assets/getting-reviews-sign-base.png";
const CARD_BASE = "https://member.thebarberlaunch.com/card/";
const STAND_URL = "https://www.amazon.com/dp/B0GYRJHY38?th=1";

export function ReviewSignCustomizer() {
  const { data: card, isLoading } = useBusinessCard();
  const [name, setName] = useState("");
  const [downloading, setDownloading] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const qrUrl = card?.short_code ? `${CARD_BASE}${card.short_code}` : "";
  const hasReviewLink = Boolean(card?.google_review_url?.trim());

  useEffect(() => {
    if (card?.business_name) setName((current) => current || card.business_name);
  }, [card?.business_name]);

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
      const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: [5, 7] });
      const backgroundWidth = 7 * background.naturalWidth / background.naturalHeight;
      pdf.addImage(background, "PNG", (5 - backgroundWidth) / 2, 0, backgroundWidth, 7);
      pdf.setFont("helvetica", "bold");
      let fontSize = 20;
      pdf.setFontSize(fontSize);
      while (fontSize > 10 && pdf.getTextWidth(cleanName) > 4.2) {
        fontSize -= 1;
        pdf.setFontSize(fontSize);
      }
      pdf.setTextColor(0, 0, 0);
      pdf.text(cleanName, 2.5, 0.95, { align: "center" });
      pdf.addImage(qrCanvasRef.current.toDataURL("image/png"), "PNG", 1.35, 1.6, 2.3, 2.3);
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
    <div className="space-y-5">
      <section className="rounded-2xl border border-white/10 bg-[#101216] p-5 sm:p-7 md:p-8" aria-labelledby="review-stand-title">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <span className="rounded-full bg-gradient-to-r from-[#f6d778] to-[#c99635] px-3 py-1 text-xs font-bold tracking-[0.16em] text-black">STEP 1</span>
          <h2 id="review-stand-title" className="font-display text-2xl font-semibold text-white sm:text-3xl">Order your sign holder</h2>
        </div>
        <div className="mt-5 grid items-center gap-5 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)] sm:gap-8">
          <div className="relative mx-auto h-36 w-44 sm:h-40" aria-hidden="true">
            <div className="absolute bottom-3 left-2 h-5 w-40 -skew-x-12 rounded-sm border border-white/30 bg-gradient-to-r from-white/5 via-white/15 to-white/5 shadow-[0_10px_24px_rgba(0,0,0,0.35)]" />
            <div className="absolute bottom-6 left-10 h-32 w-24 -skew-x-6 rounded-sm border border-white/45 bg-gradient-to-br from-white/20 via-white/[0.03] to-white/10 shadow-[inset_2px_0_0_rgba(255,255,255,0.22),0_12px_22px_rgba(0,0,0,0.25)]" />
            <div className="absolute bottom-7 left-12 h-28 w-20 -skew-x-6 border border-white/15" />
          </div>
          <div className="space-y-4 sm:border-l sm:border-white/10 sm:pl-8">
            <p className="text-lg font-medium text-white">5 × 7 magnetic acrylic stand <span className="text-white/55">· 2-pack</span></p>
            <p className="text-sm leading-relaxed text-white/55">Display the finished review sign at your station.</p>
            <a href={STAND_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#d9ad4a] px-5 py-2.5 font-semibold text-[#efc86a] transition-colors hover:bg-[#d9ad4a]/10">
              View on Amazon <ExternalLink className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-white/10 bg-[#101216] p-5 sm:p-7 md:p-8" aria-labelledby="review-sign-title">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <span className="rounded-full bg-gradient-to-r from-[#f6d778] to-[#c99635] px-3 py-1 text-xs font-bold tracking-[0.16em] text-black">STEP 2</span>
          <h2 id="review-sign-title" className="font-display text-2xl font-semibold text-white sm:text-3xl">Make your review sign</h2>
        </div>

        <div className="mt-6 grid items-start gap-7 sm:grid-cols-2 sm:gap-7">
          <div className="relative mx-auto aspect-[5/7] w-full max-w-[390px] overflow-hidden rounded-xl bg-white shadow-[0_18px_45px_rgba(0,0,0,0.4)]" aria-label="Review sign preview">
            <img src={SIGN_IMAGE} alt="Printable review sign design" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute left-[8%] top-[11%] w-[84%] break-words text-center font-semibold leading-tight text-black" style={{ fontSize: "clamp(16px, 3vw, 29px)" }}>
              {name.trim() || <span className="text-gray-400">Your name or business name</span>}
            </div>
            <div className="absolute left-[27%] top-[22.9%] flex aspect-square w-[46%] items-center justify-center bg-white">
              {qrUrl ? (
                <QRCodeSVG value={qrUrl} size={1024} level="M" includeMargin className="h-full w-full" />
              ) : (
                <span className="px-3 text-center text-xs text-gray-400">Your QR code appears here</span>
              )}
            </div>
          </div>

          <div className="space-y-6 sm:pt-6">
            <div className="space-y-2">
              <Label htmlFor="review-sign-name" className="text-sm font-semibold text-white">Name or business name</Label>
              <Input
                id="review-sign-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={55}
                placeholder="Type the name to show on your sign"
                className="h-12 border-white/20 bg-[#1b1d23] text-base text-white placeholder:text-white/35"
              />
            </div>

            {qrUrl ? (
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-sm font-semibold text-white"><CheckCircle2 className="h-5 w-5 text-emerald-400" /> Digital Business Card QR connected</p>
                <p className="text-sm leading-relaxed text-white/55">Clients scan your card, then tap your Google review link.</p>
                {!hasReviewLink && <p className="text-sm leading-relaxed text-[#efc86a]">Add your Google review link to the <Link className="underline" to="/business-card">Digital Business Card</Link> before displaying this sign to customers.</p>}
              </div>
            ) : (
              <p className="text-sm leading-relaxed text-[#efc86a]">{isLoading ? "Loading your card QR…" : <>Create your <Link className="underline" to="/business-card">Digital Business Card</Link> to add its QR automatically.</>}</p>
            )}

            <Button onClick={handleDownload} disabled={!name.trim() || !qrUrl || downloading} className="h-auto min-h-12 w-full bg-gradient-to-r from-[#f6d778] to-[#c99635] px-5 py-3 text-sm font-bold text-black hover:from-[#ffe18c] hover:to-[#d6a446] sm:text-base">
              <Download className="mr-2 h-5 w-5" /> {downloading ? "Preparing PDF…" : "Download print-ready PDF"}
            </Button>
          </div>
        </div>
      </section>

      <p className="flex items-center gap-2 px-1 text-sm text-white/55"><Printer className="h-4 w-4 text-[#d9ad4a]" /> Print at 100% size and trim to 5 × 7 inches.</p>
      {qrUrl && <QRCodeCanvas ref={qrCanvasRef} value={qrUrl} size={1024} level="M" includeMargin className="hidden" aria-hidden="true" />}
    </div>
  );
}
