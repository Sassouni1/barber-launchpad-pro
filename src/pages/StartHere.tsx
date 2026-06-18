import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Rocket,
  PackageCheck,
  Clock,
  Play,
  ClipboardCheck,
  Phone,
  GraduationCap,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  LifeBuoy,
  Bot,
  Calendar,
} from 'lucide-react';
import { NextCallCountdown } from '@/components/dashboard/NextCallCountdown';

interface Step {
  title: string;
  body: string;
  icon: any;
  cta?: { label: string; to: string };
}

const phases: { id: string; label: string; subtitle: string; accent: string; kit?: { title: string; contents: string }; steps: Step[] }[] = [
  {
    id: 'days-1-3',
    label: 'Days 1–3 · Foundations',
    subtitle: "No kit needed yet. Watch what you can, when you can — every bit counts.",
    accent: 'from-amber-500/20 to-transparent',
    steps: [
      {
        title: 'Watch: Terms of the Industry',
        body: 'Learn the vocabulary so nothing on the rest of the course sounds foreign.',
        icon: Play,
        cta: { label: 'Open Lesson', to: '/courses/hair-system' },
      },
      {
        title: 'Watch: The Color Ring',
        body: 'Understand hair color matching so you can confidently order the right system.',
        icon: Play,
        cta: { label: 'Open Lesson', to: '/courses/hair-system' },
      },
      {
        title: 'Watch: How to Make a Template',
        body: 'Understand the physical process you\u2019re about to practice when the kit lands.',
        icon: Play,
        cta: { label: 'Open Lesson', to: '/courses/hair-system' },
      },
      {
        title: 'Watch: How to Customize the Hair System',
        body: 'Learn how to tailor the system to each client before it ever touches their head.',
        icon: Play,
        cta: { label: 'Open Lesson', to: '/courses/hair-system' },
      },
    ],
  },
  {
    id: 'days-4-6',
    label: 'Days 4–6 · Application Theory',
    subtitle: 'Keep going at your own speed. When Package 1 lands, start practicing templates.',
    accent: 'from-yellow-500/20 to-transparent',
    kit: {
      title: 'Package 1 of 2 arrives this week',
      contents: 'Everything you need to create your template.',
    },
    steps: [
      {
        title: 'Tape, Adhesive & Styling',
        body: 'Three short videos. Watch one, take a break, come back — no rush.',
        icon: Play,
        cta: { label: 'Continue Course', to: '/courses/hair-system' },
      },
      {
        title: 'Watch the 4 Live Client demos',
        body: 'See the full flow from greeting to finish. You don’t have to watch them all at once — one today, one tomorrow is fine.',
        icon: Play,
        cta: { label: 'Open Live Client 1', to: '/courses/hair-system' },
      },
    ],
  },
  {
    id: 'days-7-9',
    label: 'Days 7–9 · Business Side',
    subtitle: 'Package 2 lands this week. Dip into pricing and consults whenever you feel ready.',
    accent: 'from-orange-500/20 to-transparent',
    kit: {
      title: 'Package 2 of 2 arrives this week',
      contents: 'Hair System Kit: adhesive, tape, color wheel, remover, hair pencil, install supplies, pins, canvas block.',
    },
    steps: [
      {
        title: 'Maintenance + At Home Care',
        body: 'What to tell every client so they don’t come back upset.',
        icon: Play,
        cta: { label: 'Watch Now', to: '/courses/hair-system' },
      },
      {
        title: 'Consultation + How and What to Charge',
        body: 'Pricing scripts and consult questions — practice saying them out loud.',
        icon: Play,
        cta: { label: 'Watch Now', to: '/courses/hair-system' },
      },
      {
        title: 'Book your 1-on-1 Launch Call',
        body: 'Schedule it for the week your kit arrives so we can walk through your plan live.',
        icon: Phone,
        cta: { label: 'Schedule Call', to: '/schedule-call' },
      },
    ],
  },
  {
    id: 'kit-arrives',
    label: 'Kit Arrives · Start Practicing',
    subtitle: 'Both packages in hand. You’ve been building the brain — now you put hands on hair, whenever you’re ready.',
    accent: 'from-emerald-500/20 to-transparent',
    steps: [
      {
        title: 'Submit your Template Photo',
        body: 'First hands-on assignment — required for Level 1 Certification.',
        icon: ClipboardCheck,
        cta: { label: 'Submit Template', to: '/courses/hair-system' },
      },
      {
        title: 'Practice with the Hair System Checklist',
        body: 'Use the checklist on every practice install so nothing gets skipped.',
        icon: ClipboardCheck,
        cta: { label: 'Open Checklists', to: '/checklist' },
      },
      {
        title: 'Earn Level 1 Certification',
        body: 'Complete all quizzes + the template submission and you’re officially in the directory.',
        icon: GraduationCap,
        cta: { label: 'Go to Dashboard', to: '/dashboard' },
      },
    ],
  },
];

export default function StartHere() {
  const navigate = useNavigate();
  const [supportOpen, setSupportOpen] = useState(false);

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Hero */}
        <section className="relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-8 gold-glow-subtle">
          <div className="absolute -top-10 -right-10 w-48 h-48 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              Start Here
            </div>
            <h1 className="font-display text-2xl md:text-4xl font-bold gold-text leading-tight">
              Your first 9 days, mapped out.
            </h1>
            <p className="text-muted-foreground md:text-lg max-w-2xl">
              Your hair system kit takes ~9 days to arrive. Go at your own pace — even one video a day puts you miles ahead when it lands.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3 pt-2">
              <Button
                onClick={() => navigate('/courses/hair-system')}
                className="gold-gradient text-primary-foreground font-semibold gap-2"
              >
                <Play className="w-4 h-4" />
                Start Lesson 1
              </Button>
              <Button
                variant="outline"
                onClick={() => setSupportOpen(true)}
                className="border-primary/40 gap-2"
              >
                <LifeBuoy className="w-4 h-4" />
                Need Support?
              </Button>
              <NextCallCountdown compact />
            </div>
          </div>
        </section>

        {/* Support choice dialog */}
        <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>What do you need help with?</DialogTitle>
              <DialogDescription>
                Choose how you want to get support right now.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 pt-2">
              <Button
                variant="outline"
                onClick={() => {
                  setSupportOpen(false);
                  navigate('/aion');
                }}
                className="justify-start h-auto py-4 px-4 gap-3 border-primary/40 hover:bg-primary/10 whitespace-normal text-left w-full"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <p className="font-semibold text-sm">Ask Aion AI</p>
                  <p className="text-xs text-muted-foreground whitespace-normal break-words leading-snug">Hair system install questions, technique, marketing ideas — instant answers anytime.</p>
                </div>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setSupportOpen(false);
                  navigate('/schedule-call');
                }}
                className="justify-start h-auto py-4 px-4 gap-3 border-primary/40 hover:bg-primary/10 whitespace-normal text-left w-full"
              >
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-5 h-5 text-primary" />
                </div>
                <div className="text-left min-w-0 flex-1">
                  <p className="font-semibold text-sm">Book 1-on-1 Call</p>
                  <p className="text-xs text-muted-foreground whitespace-normal break-words leading-snug">Feeling stuck, running into issues, marketing set up, deep dive into hair systems, or when you want to <strong>talk it through with someone</strong>.</p>
                </div>
              </Button>
            </div>

          </DialogContent>
        </Dialog>

        {/* Quick stats row */}
        <section className="grid grid-cols-3 gap-3">
          {[
            { icon: Clock, label: '~9 days', sub: 'Until your kit arrives' },
            { icon: PackageCheck, label: 'Day 10+', sub: 'Hands-on practice' },
            { icon: GraduationCap, label: 'Level 1', sub: 'Certification goal' },
          ].map((s, i) => (
            <div
              key={i}
              className="glass-card rounded-xl p-3 md:p-4 border border-border/50 text-center"
            >
              <s.icon className="w-5 h-5 md:w-6 md:h-6 text-primary mx-auto mb-1.5" />
              <div className="font-bold text-sm md:text-lg gold-text">{s.label}</div>
              <div className="text-[10px] md:text-xs text-muted-foreground leading-tight">{s.sub}</div>
            </div>
          ))}
        </section>

        {/* Phases */}
        <section className="space-y-6">
          {phases.map((phase, phaseIdx) => (
            <div key={phase.id} className="relative">
              {/* Connector line */}
              {phaseIdx < phases.length - 1 && (
                <div className="absolute left-5 top-14 bottom-[-1.5rem] w-px bg-gradient-to-b from-primary/40 to-transparent hidden md:block" />
              )}

              <div className={`relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br ${phase.accent} bg-card/40 p-5 md:p-6`}>
                <div className="flex items-start gap-3 mb-4">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full gold-gradient flex items-center justify-center font-bold text-primary-foreground">
                    {phaseIdx + 1}
                  </div>
                  <div>
                    <h2 className="font-display text-lg md:text-xl font-bold gold-text">{phase.label}</h2>
                    <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{phase.subtitle}</p>
                  </div>
                </div>

                {phase.kit && (
                  <div className="mb-4 flex items-start gap-3 rounded-xl border border-primary/40 bg-primary/10 p-3 md:p-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center">
                      <PackageCheck className="w-4 h-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm md:text-base font-semibold gold-text leading-tight">
                        📦 {phase.kit.title}
                      </p>
                      <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
                        {phase.kit.contents}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3 md:pl-13">

                  {phase.steps.map((step, stepIdx) => (
                    <div
                      key={stepIdx}
                      className="flex flex-col sm:flex-row sm:items-center gap-3 p-3 md:p-4 rounded-xl bg-background/40 border border-border/50 hover:border-primary/40 transition-colors"
                    >
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center">
                        <step.icon className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm md:text-base text-foreground">{step.title}</h3>
                        <p className="text-xs md:text-sm text-muted-foreground mt-0.5">{step.body}</p>
                      </div>
                      {step.cta && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => navigate(step.cta!.to)}
                          className="self-start sm:self-center text-primary hover:bg-primary/10 gap-1.5 flex-shrink-0"
                        >
                          {step.cta.label}
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>

        {/* Stuck callout */}
        <section className="rounded-2xl border border-primary/40 bg-primary/5 p-5 md:p-6 text-center space-y-3">
          <CheckCircle2 className="w-8 h-8 text-primary mx-auto" />
          <h3 className="font-display text-lg md:text-xl font-bold gold-text">No such thing as behind.</h3>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
            Life happens. Come back to this page anytime and pick up wherever you left off — this is your home base until you finish Level 1.
          </p>
          <Button
            onClick={() => navigate('/aion')}
            variant="outline"
            className="border-primary/40 gap-2"
          >
            <Rocket className="w-4 h-4" />
            Ask Aion AI
          </Button>
        </section>
      </div>
    </DashboardLayout>
  );
}
