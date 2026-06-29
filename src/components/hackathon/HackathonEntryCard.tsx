/**
 * HackathonEntryCard — the "Hackathons" entry point shown at the bottom of the
 * front page (WorkflowDiagram). Styled to match the WorkshopIntro / workflow-area
 * cards: `bg-card rounded-lg border border-border`, primary-tinted icon box,
 * title + subtitle, and a CTA into /hackathons.
 */

import { Link } from 'react-router-dom';
import { Trophy, ArrowRight, Users, Gavel, Heart } from 'lucide-react';

export function HackathonEntryCard() {
  return (
    <div className="bg-card rounded-lg border border-border overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          {/* Icon + copy */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-md bg-gradient-to-br from-amber-400/20 to-orange-500/20">
              <Trophy className="w-5 h-5 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-ui-md2 font-semibold text-foreground">Hackathons</h2>
              <p className="text-muted-foreground text-ui-base">
                Turn the skills from this workshop into a friendly competition — organize
                an event, form teams, submit projects, judge, and crown a winner.
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-ui-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-emerald-400" /> Form teams
                </span>
                <span className="flex items-center gap-1.5">
                  <Gavel className="w-3.5 h-3.5 text-violet-400" /> Judge submissions
                </span>
                <span className="flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-rose-400" /> Community voting
                </span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <Link
            to="/hackathons"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-ui-md font-semibold bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/20 hover:opacity-90 transition-all whitespace-nowrap flex-shrink-0"
          >
            <span>Explore Hackathons</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
