import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
} from 'lucide-react';

interface Step {
  title: string;
  body: string;
  icon: any;
  cta?: { label: string; to: string };
}

const phases: { id: string; label: string; subtitle: string; accent: string; steps: Step[] }[] = [
  {
    id: 'days-1-3',
    label: 'Days 1–3 · Foundations',
    subtitle: "While you wait for your kit, build the brain first.",
    accent: 'from-amber-500/20 to-transparent',
    steps: [
      {
        title: 'Watch: Terms of the Industry → The Color Ring',
        body: 'Learn the vocabulary so nothing on the rest of the course sounds foreign.',
        icon: Play,
        cta: { label: 'Open Lesson 1', to: '/courses/hair-system' },
      },
      {
        title: 'Watch: How to Make a Template → How to Customize',
        body: 'Understand the physical process you’re about to practice when the kit lands.',
        icon: Play,
        cta: { label: 'Go to Courses', to: '/courses/hair-system' },
      },
    ],
  },
  {
    id: 'days-4-6',
    label: 'Days 4–6 · Application Theory',
    subtitle: 'Get every application method into your head before the hair arrives.',
    accent: 'from-yellow-500/20 to-transparent',
    steps: [
      {
        title: 'Tape, Adhesive & Styling',
        body: 'Three short videos. Take notes — these are the moves you’ll repeat on real clients.',
        icon: Play,
        cta: { label: 'Continue Course', to: '/courses/hair-system' },
      },
      {
        title: 'Watch all 4 Live Client demos',
        body: 'See the full flow from greeting to finish. Pause when you don’t understand — rewatch.',
        icon: Play,
        cta: { label: 'Open Live Client 1', to: '/courses/hair-system' },
      },
    ],
  },
  {
    id: 'days-7-9',
    label: 'Days 7–9 · Business Side',
    subtitle: 'By now your kit is shipping. Lock in pricing, maintenance, and consults.',
    accent: 'from-orange-500/20 to-transparent',
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
    subtitle: 'You’ve done the theory. Now you put hands on hair.',
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
              Your hair system kit takes ~9 days to arrive. Don’t sit there waiting — follow this plan and you’ll be ready to practice the day it lands on your doorstep.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <Button
                onClick={() => navigate('/courses/hair-system')}
                className="gold-gradient text-primary-foreground font-semibold gap-2"
              >
                <Play className="w-4 h-4" />
                Start Lesson 1
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/schedule-call')}
                className="border-primary/40 gap-2"
              >
                <Phone className="w-4 h-4" />
                Book 1-on-1 Call
              </Button>
            </div>
          </div>
        </section>

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
          <h3 className="font-display text-lg md:text-xl font-bold gold-text">Feeling lost? Don’t be.</h3>
          <p className="text-sm md:text-base text-muted-foreground max-w-xl mx-auto">
            Follow this page top to bottom. If you’re ever unsure where to pick back up, come back here — this is your home base until you finish Level 1.
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
