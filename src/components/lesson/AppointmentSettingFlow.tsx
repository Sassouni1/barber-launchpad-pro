import { useState, type ReactNode } from "react";
import { ArrowRight, CalendarDays, Check, Clipboard, MessageSquare, Phone } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { APPOINTMENT_SETTING_PRACTICE_PATH } from "@/data/appointmentSettingPractice";

const sections = [
  ["call-flow", "Call Flow"],
  ["call-script", "Call Script"],
  ["scenarios", "Scenarios"],
  ["text-follow-ups", "Text Follow-Ups"],
  ["goal", "Goal"],
  ["objections", "Quick Objection Handling"],
] as const;

function ScriptCard({ label, children, tone = "neutral" }: {
  label?: string;
  children: string;
  tone?: "neutral" | "yes" | "no";
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Could not copy this script");
    }
  };

  const toneClasses = {
    neutral: "border-white/15 bg-white/[0.045]",
    yes: "border-emerald-500/45 bg-emerald-500/[0.075]",
    no: "border-rose-500/50 bg-rose-500/[0.075]",
  }[tone];

  return (
    <div className={`relative rounded-2xl border p-4 pr-14 sm:p-5 sm:pr-16 ${toneClasses}`}>
      {label && (
        <div className={`mb-2 text-xs font-extrabold uppercase tracking-[0.14em] ${
          tone === "yes" ? "text-emerald-300" : tone === "no" ? "text-rose-300" : "text-[#f3cc73]"
        }`}>{label}</div>
      )}
      <p className="whitespace-pre-line text-[16px] leading-[1.6] text-[#f7f2e9] sm:text-lg">{children}</p>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : "Copy script"}
        className="absolute right-3 top-3 rounded-lg border border-[#d4a944]/45 bg-[#191817] p-2 text-[#f0c869] transition-colors hover:bg-[#3c301e]"
      >
        {copied ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Section({ number, title, id, children }: {
  number: string;
  title: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4 border-t border-[#d4a944]/45 pt-7 sm:pt-9">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#f6d484] to-[#c79335] font-display text-2xl font-bold text-[#17110a]">
          {number}
        </span>
        <h2 className="font-display text-[clamp(1.7rem,5vw,2.55rem)] font-bold leading-tight text-[#f8f2e9]">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Objection({ title, children }: { title: string; children: string }) {
  return (
    <details className="group overflow-hidden rounded-2xl border border-white/15 bg-[#17191d] open:border-[#d4a944]/45">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 text-base font-bold text-[#f8f2e9] marker:hidden sm:px-5 sm:text-lg">
        <span>{title}</span>
        <span className="text-2xl font-light leading-none text-[#edc465] group-open:hidden">+</span>
        <span className="hidden text-2xl font-light leading-none text-[#edc465] group-open:inline">−</span>
      </summary>
      <div className="border-t border-white/10 p-3 sm:p-4">
        <ScriptCard>{children}</ScriptCard>
      </div>
    </details>
  );
}

export function AppointmentSettingFlow() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-12 text-[#f8f2e9]">
      <div className="rounded-3xl border border-[#d4a944]/55 bg-gradient-to-br from-[#221b12] via-[#111317] to-[#0c0d10] p-5 shadow-xl shadow-black/25 sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-[#edc465]">A live call playbook</p>
        <h2 className="mt-2 font-display text-3xl font-bold leading-tight sm:text-5xl">Appointment Setting Flow</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#d6d0c6]">
          <strong className="text-[#f3cc73]">Use when:</strong> Someone entered their info but didn’t schedule a call.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#bcb6ab]">
          Remember: You may ask yourself, is this worth your time? What else could you do that would make you $1,000 in an hour? Many fall back into cutting hair instead of going after the most important and profitable aspects.
        </p>
      </div>

      <Link to={APPOINTMENT_SETTING_PRACTICE_PATH} className="flex items-center justify-between gap-4 rounded-2xl border border-[#d4a944]/55 bg-[#17191d] p-5 transition hover:bg-[#24221e] sm:p-6">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#edc465]">Voice practice</p>
          <h3 className="mt-1 font-display text-xl font-bold sm:text-2xl">Practicing Appointment Settings</h3>
          <p className="mt-1 text-sm text-[#c9c3b9]">Practice the conversation with Mark on its own page.</p>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 text-[#edc465]" />
      </Link>

      <nav aria-label="Lesson sections" className="rounded-2xl border border-white/15 bg-[#111317] p-4 sm:p-5">
        <p className="mb-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[#edc465]">Follow the flow</p>
        <div className="relative ml-3 border-l border-[#d4a944]/55 pl-5">
          {sections.map(([id, title], index) => (
            <a key={id} href={`#${id}`} className="relative flex min-h-10 items-center gap-3 rounded-lg px-1 text-sm font-semibold text-[#ece4d5] hover:text-[#f5d17c] sm:text-base">
              <span className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border border-[#e0b354] bg-[#121315] text-[11px] font-bold text-[#f3cc73]">
                {index + 1}
              </span>
              {title}
            </a>
          ))}
        </div>
      </nav>

      <Section number="01" title="Call Flow" id="call-flow">
        <div className="space-y-2 rounded-2xl border border-white/15 bg-[#111317] p-4 sm:p-5">
          {[
            [Phone, "Call from your cell or through Pipeline."],
            [Phone, "No answer: Call again immediately."],
            [MessageSquare, "No answer again: Send text → “Name?”"],
            [CalendarDays, "If they reply, go straight into the conversation and set the appointment."],
          ].map(([Icon, line], index) => {
            const StepIcon = Icon as typeof Phone;
            return (
              <div key={index} className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.035] px-4 py-3">
                <StepIcon className="h-5 w-5 shrink-0 text-[#edc465]" />
                <p className="text-sm leading-relaxed sm:text-base">{line as string}</p>
              </div>
            );
          })}
        </div>
      </Section>

      <Section number="02" title="Call Script" id="call-script">
        <div className="space-y-3">
          <div className="space-y-3 rounded-2xl border border-[#d4a944]/45 bg-[#121416] p-3 sm:p-4">
            <ScriptCard label="Start call">
              Hey [Name], this is [Your Name] from [Company]. I saw you were interested in our hair replacement service — does that ring a bell?
            </ScriptCard>
            <div className="space-y-3 pl-3 sm:pl-6">
              <div className="relative"><span className="absolute -left-3 top-6 h-[calc(100%+12px)] border-l border-[#d4a944]/45" /><ScriptCard label="✓ Yes" tone="yes">Got it! Great. How long have you been interested in hair systems?</ScriptCard></div>
              <div className="relative"><ScriptCard label="✕ No" tone="no">No worries — I saw you signed up to learn more about our hair loss solutions. How long have you been interested in something like this?</ScriptCard></div>
            </div>
          </div>
          <div className="space-y-3 rounded-2xl border border-dashed border-[#d4a944]/45 bg-[#171716] p-3 sm:p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[#f3cc73]">Optional · for short answers</p>
            <ScriptCard>Okay got it, how long have you actually been struggling with hair loss for?</ScriptCard>
            <ScriptCard>What made you start looking into hair systems now?</ScriptCard>
          </div>
          <ScriptCard label="After they respond">
            Awesome. We would love to have you come in for a free consultation this week — Do mornings or afternoons work better for you? Would [nearby day/time] or [alt day/time] work better for you?
          </ScriptCard>
        </div>
      </Section>

      <Section number="03" title="Scenarios" id="scenarios">
        <div className="space-y-3">
          <ScriptCard label="1 · They say yes" tone="yes">Perfect. I’ll lock you in for [Day/Time]. You’ll get a confirmation text right now — can you check that it came through?</ScriptCard>
          <ScriptCard label="2 · That time doesn’t work" tone="no">No problem. How about [Alt Day/Time]?</ScriptCard>
          <ScriptCard label="3 · Still no">What’s usually the best time for you this week — mornings or afternoons?</ScriptCard>
          <ScriptCard label="4 · I’m just really busy">Totally get it. It’s a quick, free consult — just 15–20 minutes to go over your best options. Is there any day this or next week that could work?</ScriptCard>
          <ScriptCard label="5 · Still no">I get it, but can I just ask what your biggest concern might be?</ScriptCard>
          <div className="rounded-2xl border border-white/15 bg-[#15171a] p-4 sm:p-5">
            <p className="font-bold text-[#f3cc73]">Handle the concern they raise</p>
            <ul className="mt-2 space-y-1 text-sm leading-relaxed text-[#d6d0c6] sm:text-base">
              <li>Will it come off? <strong className="text-[#f8f2e9]">No.</strong></li>
              <li>Will people notice? <strong className="text-[#f8f2e9]">No.</strong></li>
              <li>Is it hard to maintain? <strong className="text-[#f8f2e9]">No.</strong></li>
            </ul>
            <p className="mt-3 text-sm text-[#d6d0c6] sm:text-base">The only way to find out your best option is to come in for a free consultation.</p>
          </div>
        </div>
      </Section>

      <Section number="04" title="Text Follow-Ups" id="text-follow-ups">
        <div className="space-y-3">
          <ScriptCard label="Text #1 · After missed call">Name?</ScriptCard>
          <ScriptCard label="If they reply">Hey [Name], this is [Your Name] from [Company]. Saw you were interested in our hair replacement service in [City]. Want me to get you in for a quick free consultation this week?</ScriptCard>
          <ScriptCard label="If no reply after a few hours">Hey [Name], I’ve got just a couple free consult openings left this week — [Today Time] or [Tomorrow Time]. Which works better for you?</ScriptCard>
          <ScriptCard label="If no reply next day">Hey [Name], quick reminder — free consultations are filling fast this week. Want me to hold a time for you tomorrow?</ScriptCard>
        </div>
      </Section>

      <Section number="05" title="Goal" id="goal">
        <div className="rounded-2xl border border-[#d4a944]/45 bg-[#1a1711] p-5 text-base leading-relaxed sm:p-6 sm:text-lg">
          <p>Book them <strong className="text-[#f3cc73]">as soon as possible</strong> — same day or next day always converts best.</p>
          <p className="mt-2 text-[#d6d0c6]">The further away the appointment, the less chance they’ll show.</p>
        </div>
      </Section>

      <Section number="06" title="Quick Objection Handling" id="objections">
        <p className="-mt-1 text-sm italic text-[#d6d0c6] sm:text-base">One-liners → then book. Tap a concern to see the response.</p>
        <div className="space-y-3">
          <Objection title="How much is it?">Consult is free. Pricing depends on style, density, color. Which is mainly what our consults are for, to figure out what’s best for you.</Objection>
          <Objection title="Need to talk to spouse.">Smart. Grab a no-cost consult so you both have real numbers and photos. I can hold tomorrow 5:30. If spouse can’t come, we’ll send pics after.</Objection>
          <Objection title="I had a bad experience.">Sorry you dealt with that. Our process is different—fit test, color-match, lifestyle plan. Free to see it. Today 6:10 or tomorrow 12:40?</Objection>
          <Objection title="How long does it take?">Consult is about 20-30 min. Enough to answer everything. Sooner you come, sooner we can figure out what would be best for you. Today or tomorrow?</Objection>
          <Objection title="Can you just text me info?">Absolutely. Best info is personalized at the consult. I’ll text details and hold [near slot]. If that time’s bad, you can reschedule with one tap.</Objection>
          <Objection title="I’m thinking about getting a transplant.">{"Totally get that — a lot of people explore that option first. The main difference is that transplants can be really expensive, take months to heal, and you still might not get the density you’re hoping for.\n\nWhat we do is completely non-surgical, instant, and fully reversible. Most guys actually come in for a free consultation just to compare both options side by side — it helps you make the smartest choice.\n\nIt would be great to have you just come in for a free consultation, hows…."}</Objection>
        </div>
      </Section>
    </div>
  );
}
