/**
 * HackathonPlaybook — the "Playbook" destination under the Hackathons accordion.
 *
 * A how-to guide for running and participating in a hackathon, organized by
 * persona. Illustrated with screenshots + a walkthrough video captured by the
 * Playwright e2e suite (saved under public/hackathon-docs/). Pure presentational
 * page in the V2V theme.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen,
  ArrowLeft,
  Trophy,
  Users,
  Gavel,
  Heart,
  PlayCircle,
  ChevronDown,
} from 'lucide-react';
import { ThemeToggle } from '../ThemeToggle';

const MEDIA = '/hackathon-docs';

type Step = { text: string; shot?: string };
type Section = {
  id: string;
  title: string;
  icon: typeof Users;
  accent: string; // text color
  blurb: string;
  steps: Step[];
};

const SECTIONS: Section[] = [
  {
    id: 'organizer',
    title: 'Organizer',
    icon: Trophy,
    accent: 'text-rose-400',
    blurb: 'Create a hackathon, configure it, assign judges, and drive it through its lifecycle.',
    steps: [
      { text: 'From the front page (or sidebar), open Hackathons and click "Create Hackathon".', shot: '02-hackathons-list' },
      { text: 'Fill in the details — title, description (AI can draft it), format, team sizes, schedule, prize, topics, judging criteria, and feature toggles.', shot: '04-create-form' },
      { text: 'You become the organizer. The detail page shows everything you entered.', shot: '05-detail-overview' },
      { text: 'Open the Manage tab to advance the lifecycle (draft → registration open → in progress → judging → completed).', shot: '06-manage-tab' },
      { text: 'Assign judges: search workshop users or invite anyone by email, select several, and assign in one click.', shot: '07-judge-selector' },
      { text: 'Assigned judges appear as removable chips under "Current judges".', shot: '08-judge-assigned' },
    ],
  },
  {
    id: 'participant',
    title: 'Participant',
    icon: Users,
    accent: 'text-emerald-400',
    blurb: 'Form or join a team, then submit your project before the deadline.',
    steps: [
      { text: 'Open the hackathon and go to the Teams tab. Create a team (you become leader) or join an open one.', shot: '09-team-created' },
      { text: 'On the Submissions tab, the team leader submits the project — title, description (AI-assisted), and repo / demo / video / slides links.', shot: '10-submission' },
    ],
  },
  {
    id: 'judge',
    title: 'Judge',
    icon: Gavel,
    accent: 'text-violet-400',
    blurb: 'Score each submission against the hackathon’s criteria and leave feedback.',
    steps: [
      { text: 'Once an organizer assigns you, the Judging tab appears. Score each submission 0–10 per criterion; the overall is the average.', shot: '11-judging' },
      { text: 'AI can draft constructive feedback from your scores — edit and submit.', shot: '11-judging' },
    ],
  },
  {
    id: 'voter',
    title: 'Voter & Results',
    icon: Heart,
    accent: 'text-amber-400',
    blurb: 'Cast community (people’s-choice) votes and watch the live leaderboard.',
    steps: [
      { text: 'Anyone can vote on submissions (if community voting is enabled). Tap the heart on a submission card.' },
      { text: 'The Results tab ranks submissions by average judge score, tie-broken by votes. The winner gets a spotlight.', shot: '12-results' },
    ],
  },
];

export function HackathonPlaybook() {
  return (
    <div className="flex-1 overflow-auto gradient-mesh">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-card/90 backdrop-blur-md border-b border-border px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between">
            <Link
              to="/hackathons"
              className="flex items-center gap-1.5 text-ui-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              All hackathons
            </Link>
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 mt-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-emerald-500 flex items-center justify-center shadow-lg shadow-primary/30">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight flex items-center gap-2">
                Hackathon Playbook
                <span className="text-ui-2xs font-semibold uppercase tracking-wide text-amber-400 bg-amber-500/15 border border-amber-500/30 rounded px-1.5 py-0.5 leading-none">Beta</span>
              </h1>
              <p className="text-ui-xs text-muted-foreground">
                How to run and take part in a hackathon, end to end
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
        {/* Walkthrough video */}
        <WalkthroughVideo />

        {/* Persona sections */}
        {SECTIONS.map((s, i) => (
          <PlaybookSection key={s.id} section={s} defaultOpen={i === 0} />
        ))}

        <p className="text-ui-2xs text-muted-foreground/60 text-center pt-2">
          Screenshots and the walkthrough video are generated automatically by the
          Playwright end-to-end test suite — so this guide always matches the live app.
        </p>
      </div>
    </div>
  );
}

function WalkthroughVideo() {
  const [failed, setFailed] = useState(false);
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 to-emerald-500/5 overflow-hidden"
    >
      <div className="px-5 py-3 border-b border-border flex items-center gap-2">
        <PlayCircle className="w-4 h-4 text-primary" />
        <span className="text-ui-sm font-semibold text-foreground">Organizer walkthrough</span>
        <span className="text-ui-2xs text-muted-foreground">create → manage → assign judge</span>
      </div>
      {failed ? (
        <div className="px-5 py-8 text-center text-ui-xs text-muted-foreground">
          Walkthrough video not found. Generate it by running the e2e suite:
          <code className="block mt-2 text-primary">npx playwright test</code>
        </div>
      ) : (
        <video
          className="w-full max-h-[28rem] bg-black"
          src={`${MEDIA}/video/organizer-walkthrough.webm`}
          controls
          muted
          playsInline
          onError={() => setFailed(true)}
        />
      )}
    </motion.div>
  );
}

function PlaybookSection({ section, defaultOpen }: { section: Section; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const Icon = section.icon;
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-secondary/30 transition-colors"
      >
        <div className={`p-2 rounded-md bg-secondary/60 ${section.accent}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-ui-md font-semibold text-foreground">{section.title}</h2>
          <p className="text-ui-xs text-muted-foreground">{section.blurb}</p>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1 border-t border-border/60 space-y-5">
          {section.steps.map((step, i) => (
            <div key={i} className="flex flex-col gap-2">
              <div className="flex items-start gap-2.5">
                <span
                  className={`flex-shrink-0 w-5 h-5 rounded-full bg-secondary flex items-center justify-center text-ui-2xs font-bold ${section.accent}`}
                >
                  {i + 1}
                </span>
                <p className="text-ui-sm text-foreground leading-relaxed">{step.text}</p>
              </div>
              {step.shot && (
                <img
                  src={`${MEDIA}/${step.shot}.png`}
                  alt={`${section.title} step ${i + 1}`}
                  loading="lazy"
                  className="rounded-lg border border-border ml-7 max-w-full shadow-sm"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
