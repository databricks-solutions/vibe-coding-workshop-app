/**
 * Verification panel for steps that produce a real workspace artifact.
 *
 * "Done" used to mean only that someone clicked a button. Here the app goes and
 * looks: is the app RUNNING, do the Gold tables exist, did the pipeline succeed.
 *
 * Three outcomes, and the third one matters most. `unknown` — no permission, a
 * timeout, a missing parameter — is shown honestly and never blocks progress. A
 * workshop with thirty attendees cannot stall because a service principal is
 * missing a grant, so this panel is advisory: it tells the attendee what to fix and
 * always leaves them a way forward, including an explicit "I checked myself" button.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Loader2,
  RefreshCw,
  UserCheck,
} from 'lucide-react';
import { apiClient, type StepVerification } from '../../api/client';

interface VerifyPanelProps {
  sectionTag: string;
  sessionId?: string | null;
  /** Fires when verification passes or the attendee self-attests. */
  onVerified?: (method: StepVerification['method']) => void;
  readOnly?: boolean;
}

export function VerifyPanel({
  sectionTag,
  sessionId,
  onVerified,
  readOnly = false,
}: VerifyPanelProps) {
  const [result, setResult] = useState<StepVerification | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [selfAttested, setSelfAttested] = useState(false);

  const runCheck = useCallback(
    async (force: boolean) => {
      setIsChecking(true);
      try {
        const verification = await apiClient.verifyStep(sectionTag, sessionId, force);
        setResult(verification);
        if (verification.status === 'pass') onVerified?.(verification.method);
      } catch {
        // A verification outage is not the attendee's problem: present it as
        // "couldn't check" and let them carry on.
        setResult({
          status: 'unknown',
          method: 'none',
          checks: [],
          hint: 'Could not reach the verification service. Check manually using the links above.',
        });
      } finally {
        setIsChecking(false);
      }
    },
    [sectionTag, sessionId, onVerified]
  );

  // Check once when the panel mounts; the result is server-side cached, so this is
  // cheap and means the attendee usually sees a status without asking for one.
  useEffect(() => {
    void runCheck(false);
  }, [runCheck]);

  const handleSelfAttest = () => {
    setSelfAttested(true);
    onVerified?.('self_attested');
  };

  const status = selfAttested ? 'self' : result?.status ?? 'checking';

  const tone = {
    pass: 'border-emerald-500/40 bg-emerald-500/5',
    fail: 'border-amber-500/40 bg-amber-500/5',
    unknown: 'border-border bg-muted/30',
    self: 'border-sky-500/40 bg-sky-500/5',
    checking: 'border-border bg-muted/30',
  }[status];

  return (
    <div className={`rounded-md border p-3 space-y-2.5 ${tone}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isChecking && !result ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="text-ui-sm text-muted-foreground">
                Checking your workspace…
              </span>
            </>
          ) : selfAttested ? (
            <>
              <UserCheck className="w-4 h-4 text-sky-400" />
              <span className="text-ui-sm font-medium text-sky-400">
                You confirmed this yourself
              </span>
            </>
          ) : result?.status === 'pass' ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span className="text-ui-sm font-medium text-emerald-400">
                Verified in your workspace
              </span>
            </>
          ) : result?.status === 'fail' ? (
            <>
              <XCircle className="w-4 h-4 text-amber-400" />
              <span className="text-ui-sm font-medium text-amber-400">
                Not there yet
              </span>
            </>
          ) : (
            <>
              <HelpCircle className="w-4 h-4 text-muted-foreground" />
              <span className="text-ui-sm font-medium text-muted-foreground">
                Couldn't check automatically
              </span>
            </>
          )}
        </div>

        {!readOnly && (
          <button
            onClick={() => void runCheck(true)}
            disabled={isChecking}
            className="inline-flex items-center gap-1 text-ui-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
            title="Run the check again"
          >
            <RefreshCw className={`w-3 h-3 ${isChecking ? 'animate-spin' : ''}`} />
            Re-check
          </button>
        )}
      </div>

      {/* The hint says what to fix, which is the only part worth reading on a failure. */}
      {!selfAttested && result?.hint && result.status !== 'pass' && (
        <p className="text-ui-xs text-muted-foreground">{result.hint}</p>
      )}

      {!selfAttested && result?.checks && result.checks.length > 1 && (
        <ul className="space-y-1">
          {result.checks.map(check => (
            <li key={check.name} className="flex items-start gap-1.5 text-ui-xs">
              {check.ok === true ? (
                <CheckCircle2 className="w-3 h-3 mt-0.5 text-emerald-400 flex-shrink-0" />
              ) : check.ok === false ? (
                <XCircle className="w-3 h-3 mt-0.5 text-amber-400 flex-shrink-0" />
              ) : (
                <HelpCircle className="w-3 h-3 mt-0.5 text-muted-foreground flex-shrink-0" />
              )}
              <span className="text-muted-foreground">{check.detail || check.name}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Always available, never behind a confirmation. Facilitators need this when a
          grant is missing or the control plane is slow. */}
      {!selfAttested && result?.status !== 'pass' && !readOnly && (
        <button
          onClick={handleSelfAttest}
          className="text-ui-xs text-muted-foreground underline hover:text-foreground"
        >
          I verified this myself
        </button>
      )}
    </div>
  );
}
