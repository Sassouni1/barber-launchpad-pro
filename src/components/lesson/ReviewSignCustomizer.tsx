import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { CheckCircle2, Download, ExternalLink, Printer } from "lucide-react";
import { toast } from "sonner";
import { useBusinessCard } from "@/hooks/useBusinessCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const CARD_BASE = "https://member.thebarberlaunch.com/card/";
const STAND_URL = "https://www.amazon.com/dp/B0GYRJHY38?th=1";

function wrapSignName(value: string): string[] {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return ["YOUR NAME"];
  const lines = [""];
  for (const word of words) {
    const current = lines[lines.length - 1];
    if (current && `${current} ${word}`.length > 26 && lines.length < 2) lines.push(word);
    else lines[lines.length - 1] = current ? `${current} ${word}` : word;
  }
  return lines;
}

function starPoints(cx: number, cy: number): string {
  return Array.from({ length: 10 }, (_, index) => {
    const angle = -Math.PI / 2 + index * Math.PI / 5;
    const radius = index % 2 === 0 ? 17 : 7.4;
    return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
  }).join(" ");
}

export function ReviewSignCustomizer() {
  const { data: card, isLoading } = useBusinessCard();
  const [name, setName] = useState("");
  const [downloading, setDownloading] = useState(false);
  const signSvgRef = useRef<SVGSVGElement>(null);
  const qrUrl = card?.short_code ? `${CARD_BASE}${card.short_code}` : "";
  const hasReviewLink = Boolean(card?.google_review_url?.trim());

  useEffect(() => {
    if (card?.business_name) setName((current) => current || card.business_name);
  }, [card?.business_name]);

  const handleDownload = async () => {
    const cleanName = name.trim();
    if (!cleanName || !qrUrl || !signSvgRef.current) return;
    setDownloading(true);
    try {
      const sign = signSvgRef.current.cloneNode(true) as SVGSVGElement;
      sign.setAttribute("xmlns", "http://www.w3.org/2000/svg");
      sign.setAttribute("width", "500");
      sign.setAttribute("height", "700");
      const svgUrl = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(sign)], { type: "image/svg+xml;charset=utf-8" }));
      const image = new Image();
      try {
        await new Promise<void>((resolve, reject) => {
          image.onload = () => resolve();
          image.onerror = () => reject(new Error("Review sign could not be rendered"));
          image.src = svgUrl;
        });
      } finally {
        URL.revokeObjectURL(svgUrl);
      }
      const canvas = document.createElement("canvas");
      canvas.width = 3000;
      canvas.height = 4200;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Review sign canvas unavailable");
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF({ orientation: "portrait", unit: "in", format: [5, 7] });
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 5, 7);
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
      <section className="rounded-2xl border border-white/10 bg-[#101216] p-5 sm:p-7 md:p-8" aria-labelledby="review-sign-title">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <span className="rounded-full bg-gradient-to-r from-[#f6d778] to-[#c99635] px-3 py-1 text-xs font-bold tracking-[0.16em] text-black">STEP 1</span>
          <h2 id="review-sign-title" className="font-display text-2xl font-semibold text-white sm:text-3xl">Make your review sign</h2>
        </div>

        <div className="mt-6 grid items-start gap-7 sm:grid-cols-2 sm:gap-7">
          <div className="mx-auto aspect-[5/7] w-full max-w-[390px] overflow-hidden rounded-xl bg-white shadow-[0_18px_45px_rgba(0,0,0,0.4)]" aria-label="Review sign preview">
            <svg ref={signSvgRef} viewBox="0 0 500 700" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Printable review sign design" className="block h-full w-full bg-white">
              <rect width="500" height="700" fill="#fff" />
              <g fill="#101010">
                <path d="M233 49 C239 57 246 68 252 79 L248 82 C244 73 238 60 233 49Z" />
                <path d="M267 49 C261 57 254 68 248 79 L252 82 C256 73 262 60 267 49Z" />
              </g>
              <g fill="none" stroke="#101010" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M249 80 L239 93 M251 80 L261 93" />
                <circle cx="237" cy="99" r="7.5" />
                <circle cx="263" cy="99" r="7.5" />
              </g>
              <circle cx="250" cy="79" r="2.2" fill="#fff" />
              {wrapSignName(name).map((line, index, lines) => (
                <text key={`${line}-${index}`} x="250" y={lines.length === 1 ? 156 : 137 + index * 28} textAnchor="middle" fill="#111" fontFamily="Arial, Helvetica, sans-serif" fontSize={line.length > 26 ? 20 : line.length > 19 ? 24 : 30} letterSpacing="1.3" fontWeight="700">{line}</text>
              ))}
              {qrUrl ? (
                <QRCodeSVG x={137} y={197} value={qrUrl} size={226} level="M" includeMargin bgColor="#ffffff" fgColor="#000000" />
              ) : (
                <text x="250" y="314" textAnchor="middle" fill="#aaa" fontFamily="Arial, Helvetica, sans-serif" fontSize="17">Your QR code appears here</text>
              )}
              <text x="250" y="475" textAnchor="middle" fill="#111" fontFamily="Arial, Helvetica, sans-serif" fontSize="25">Scan to leave a review on</text>
              <text x="250" y="558" textAnchor="middle" fontFamily="Arial, Helvetica, sans-serif" fontSize="58" fontWeight="500" letterSpacing="-2"><tspan fill="#4285F4">G</tspan><tspan fill="#EA4335">o</tspan><tspan fill="#FBBC05">o</tspan><tspan fill="#4285F4">g</tspan><tspan fill="#34A853">l</tspan><tspan fill="#EA4335">e</tspan></text>
              {[170, 210, 250, 290, 330].map((cx) => <polygon key={cx} points={starPoints(cx, 600)} fill="#fbbc05" />)}
            </svg>
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

      <section className="rounded-2xl border border-white/10 bg-[#101216] p-5 sm:p-7 md:p-8" aria-labelledby="review-stand-title">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          <span className="rounded-full bg-gradient-to-r from-[#f6d778] to-[#c99635] px-3 py-1 text-xs font-bold tracking-[0.16em] text-black">STEP 2</span>
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

    </div>
  );
}
