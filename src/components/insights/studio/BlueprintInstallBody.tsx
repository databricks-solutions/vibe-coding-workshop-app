import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowUpRight, Check, Circle, Loader2, MessageSquarePlus, Sparkles, Wand2 } from 'lucide-react';
import { blueprintApi, useBlueprintDigest, useInstallStatus } from '../blueprint/blueprintApi';
import { sourceFromChoice } from '../blueprint/links';
import { composeGenieInstall, composeHandoff } from '../blueprint/messages';
import { SourcePill } from '../blueprint/SourcePill';
import type { BlueprintChoice, Capabilities } from '../blueprint/types';
import type { WorkspaceLinks } from '../types';
import { PrimaryButton } from '../../journeykit';
import { CopyRow } from './SetupBody';

interface BlueprintInstallBodyProps {
  blueprint: BlueprintChoice;
  questions: string[];
  currentUser: string;
  links: WorkspaceLinks;
  readOnly: boolean;
  onPromptReady: (text: string) => void;
}

function catalogLink(links: WorkspaceLinks, catalog: string): string | undefined {
  if (!links.home) return undefined;
  const [base, query] = links.home.split('?');
  return `${base}explore/data/${catalog}${query ? `?${query}` : ''}`;
}

function formatElapsed(startedAt?: number | null): string {
  if (!startedAt) return '';
  const min = Math.max(0, Math.round((Date.now() / 1000 - startedAt) / 60));
  return min < 1 ? 'just started' : `${min} min in`;
}

export function BlueprintInstallBody({ blueprint, questions, currentUser, links, readOnly, onPromptReady }: BlueprintInstallBodyProps) {
  const digest = useBlueprintDigest(blueprint.slug);
  const { status, update, refresh } = useInstallStatus(blueprint.slug);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string | null>(null);

  useEffect(() => { blueprintApi.capabilities().then(setCaps).catch(() => setCaps({ canInstall: false, reason: '', installEnabled: false })); }, []);

  const email = currentUser && currentUser.includes('@') && currentUser !== 'user@databricks.com' ? currentUser : '<your_email>';
  const projectPath = `/Workspace/Users/${email}/vibe-coding-workshop`;
  const handoff = useMemo(
    () => composeHandoff(blueprint, digest.data, questions, projectPath),
    [blueprint, digest.data, questions, projectPath],
  );
  const genieInstall = useMemo(() => composeGenieInstall(blueprint, projectPath), [blueprint, projectPath]);

  const start = async () => {
    setStarting(true);
    setStartError(null);
    try {
      update(await blueprintApi.install(blueprint.slug));
    } catch (err) {
      setStartError(String((err as Error)?.message || err));
      refresh();
    }
    setStarting(false);
  };

  const state = status?.state;
  const appCanInstall = !!caps?.canInstall && !!caps?.installEnabled;
  const useGenieCode = state === 'needs_genie_code' || (caps !== null && !appCanInstall && state !== 'installed' && state !== 'installing' && state !== 'exists');
  const phases = status?.phases ?? [];
  const phaseIdx = phases.findIndex(p => p.id === status?.phase);
  const lastLine = status?.recent?.[status.recent.length - 1];
  const explore = catalogLink(links, blueprint.catalog);

  let installCard: React.ReactNode;
  if (!status || caps === null) {
    installCard = (
      <div className="flex items-center gap-3 rounded-2xl border border-border p-5 text-ui-md text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" /> Checking whether {blueprint.catalog} is already in your workspace…
      </div>
    );
  } else if (state === 'installed') {
    installCard = (
      <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-5 space-y-2">
        <p className="flex items-center gap-2 text-ui-md font-semibold text-emerald-500">
          <Check className="w-4 h-4" strokeWidth={3} /> Your {blueprint.label} model is ready
        </p>
        <p className="text-ui-sm text-foreground/85">
          Installed as <span className="font-mono">{blueprint.catalog}</span> with sample data, shared read-only with everyone in the workspace.
        </p>
        {explore && (
          <a href={explore} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-ui-sm font-medium text-primary hover:underline underline-offset-2">
            Open it in Catalog Explorer <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    );
  } else if (state === 'installing') {
    installCard = (
      <div className="rounded-2xl border border-primary/25 bg-primary/[0.04] p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-ui-md font-semibold text-foreground">
            <Loader2 className="w-4 h-4 animate-spin text-primary" /> Setting up {blueprint.catalog}
          </p>
          <span className="text-ui-sm tabular-nums text-muted-foreground">{status.percent}% · {formatElapsed(status.startedAt)}</span>
        </div>
        <div className="h-1.5 rounded-full bg-border overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full" initial={false} animate={{ width: `${Math.max(3, status.percent)}%` }} transition={{ duration: 0.8 }} />
        </div>
        <ol className="grid sm:grid-cols-3 gap-x-4 gap-y-1.5">
          {phases.map((p, i) => (
            <li key={p.id} className={`flex items-center gap-2 text-ui-sm ${i < phaseIdx ? 'text-foreground/80' : i === phaseIdx ? 'text-foreground font-medium' : 'text-muted-foreground/70'}`}>
              {i < phaseIdx ? <Check className="w-3.5 h-3.5 text-emerald-500" strokeWidth={3} /> : i === phaseIdx ? <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" /> : <Circle className="w-3.5 h-3.5" />}
              {p.label}
            </li>
          ))}
        </ol>
        {lastLine && <p className="font-mono text-[11px] text-muted-foreground truncate" title={lastLine}>{lastLine}</p>}
        <p className="text-ui-xs text-muted-foreground">
          Runs in the background{status.startedBy ? `, started by ${status.startedBy}` : ''}. You can copy the message below now and keep going.
          {status.runUrl && <> <a href={status.runUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">Watch the run</a></>}
        </p>
      </div>
    );
  } else if (state === 'exists') {
    installCard = (
      <div className="rounded-2xl border border-border p-5 space-y-1.5">
        <p className="flex items-center gap-2 text-ui-md font-semibold text-foreground">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> {blueprint.catalog} is already in your workspace
        </p>
        <p className="text-ui-sm text-muted-foreground">
          Someone else set it up, and it is either still installing or not shared with everyone yet. Nothing to do here: this updates on its own once it is readable.
        </p>
      </div>
    );
  } else if (useGenieCode) {
    installCard = (
      <div className="space-y-3">
        <p className="text-ui-sm text-muted-foreground">
          This app cannot create catalogs in your workspace, so Genie Code will run the model's official installer with your permissions.
        </p>
        <ol className="space-y-3">
          <CopyRow
            n={1}
            icon={Wand2}
            title={`Ask Genie Code to install ${blueprint.catalog}`}
            body="Paste into a new Agent chat. It checks first, never overwrites, and reports progress as it goes."
            text={genieInstall}
          />
        </ol>
      </div>
    );
  } else {
    installCard = (
      <div className="rounded-2xl border border-border p-5 space-y-3">
        {state === 'failed' && (
          <p className="flex items-start gap-2 text-ui-sm text-red-400">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> The last setup did not finish{status.error ? `: ${status.error}` : ''}. Starting again is safe.
          </p>
        )}
        <p className="text-ui-md text-foreground/90">
          We'll create <span className="font-mono font-medium">{blueprint.catalog}</span>: {digest.data ? `${digest.data.stats.tables} tables, ${digest.data.stats.links.toLocaleString()} connections, ` : ''}sensitive-field labels, ready-made KPI views and realistic sample rows. Everyone in the workspace gets read access.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton size="lg" onClick={start} disabled={starting || readOnly}>
            {starting ? <><Loader2 className="w-4 h-4 animate-spin" /> Starting</> : <><Sparkles className="w-4 h-4" /> Set it up for me</>}
          </PrimaryButton>
          <span className="text-ui-sm text-muted-foreground">About 15 to 25 minutes, in the background.</span>
        </div>
        {startError && <p className="text-ui-sm text-red-400">{startError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SourcePill source={sourceFromChoice(blueprint)} label={blueprint.label} />
      {installCard}
      <ol className="space-y-3">
        <CopyRow
          n={useGenieCode ? 2 : 1}
          icon={MessageSquarePlus}
          title="Tell Genie Code where your data lives"
          body={state === 'installed'
            ? 'Paste into Genie Code. It maps your questions to the model and saves a one-page data map.'
            : 'Copy it now, paste it once the setup above shows ready.'}
          text={handoff}
          onCopied={() => onPromptReady(handoff)}
        />
      </ol>
    </div>
  );
}
