// Merge-base bookkeeping for the App gate writes (app-save-drops-unseen-mcp-gates, D-12).
//
// NO React / DOM / workflowSections imports, so it is unit-testable in isolation
// via `node --experimental-strip-types`.
//
// The SPA writes its FULL completed/skipped gate sets. Without more context the
// server can't tell "the learner un-completed this step" from "the App never
// saw this step completed (an MCP vibe_complete_step did it)". So every gate
// write also carries the gate sets the SPA last received from or successfully
// wrote to the server (`base_completed_gates` / `base_skipped_gates`), and the
// server removes only gates that are in the base and missing from the write.
//
// The base is keyed by session id: a write for a session the base was not
// hydrated for sends no base (the server falls back to App-authoritative), and a
// late write result for another session does not touch the base.

export interface GateBase {
  sessionId: string | null;
  completed: Set<string>;
  skipped: Set<string>;
}

export interface GateBaseFields {
  base_completed_gates?: string[];
  base_skipped_gates?: string[];
}

export interface GateWrite {
  completed_gates?: string[];
  skipped_gates?: string[];
}

export function emptyGateBase(sessionId: string | null = null): GateBase {
  return { sessionId, completed: new Set(), skipped: new Set() };
}

/** The base after hydrating `sessionId` from the server's stored gates. */
export function hydrateGateBase(
  sessionId: string,
  completedGates: string[] | null | undefined,
  skippedGates: string[] | null | undefined,
): GateBase {
  return {
    sessionId,
    completed: new Set(completedGates ?? []),
    skipped: new Set(skippedGates ?? []),
  };
}

/** The base_* fields for a write to `sessionId`: one per gate set the write
 *  carries, as sorted arrays. Empty when the base belongs to another session. */
export function gateBaseFields(base: GateBase, sessionId: string, write: GateWrite): GateBaseFields {
  if (base.sessionId !== sessionId) return {};
  const fields: GateBaseFields = {};
  if (write.completed_gates !== undefined) fields.base_completed_gates = [...base.completed].sort();
  if (write.skipped_gates !== undefined) fields.base_skipped_gates = [...base.skipped].sort();
  return fields;
}

/** The base after a gate write to `sessionId` settled. On success the sets the
 *  write carried become the base; a failed write, or one for another session,
 *  leaves it unchanged. */
export function applyGateWriteResult(
  base: GateBase,
  sessionId: string,
  write: GateWrite,
  succeeded: boolean,
): GateBase {
  if (!succeeded || base.sessionId !== sessionId) return base;
  return {
    sessionId,
    completed: write.completed_gates !== undefined ? new Set(write.completed_gates) : base.completed,
    skipped: write.skipped_gates !== undefined ? new Set(write.skipped_gates) : base.skipped,
  };
}
