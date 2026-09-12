import { reserveBudget, settleBudget } from "./budget.ts";
import type { OpsSettings } from "./settings.ts";
import type { MemoryOpsStore } from "./store.ts";
import type { Job, JobKind, RetryClass } from "./types.ts";

export function classifyError(message: string): RetryClass {
  const text = message.toLowerCase();
  if (text.includes("unauthorized") || text.includes("expired") || text.includes("reauth")) return "auth";
  if (text.includes("forbidden") || text.includes("permission")) return "permission";
  if (text.includes("policy") || text.includes("tos") || text.includes("unsupported")) return "policy";
  if (text.includes("timeout") || text.includes("429") || text.includes("retry-after") || text.includes("temporar")) {
    return "transient";
  }
  return "fatal";
}

export function canRetry(job: Job, retryClass: RetryClass): boolean {
  if (retryClass !== "transient") return false;
  return job.attempt < 3;
}

export function backoffMs(attempt: number, retryAfterMs?: number): number {
  if (retryAfterMs && retryAfterMs > 0) return retryAfterMs;
  return Math.min(30_000, 1000 * 2 ** Math.max(0, attempt - 1));
}

export async function runJob<T>(input: {
  store: MemoryOpsStore;
  settings: OpsSettings;
  kind: JobKind;
  idempotencyKey: string;
  reserveYen: number;
  now?: Date;
  step: () => Promise<{ spentYen: number; value: T }>;
}): Promise<{ job: Job; value?: T }> {
  const existing = [...input.store.jobs.values()].find((j) => j.idempotencyKey === input.idempotencyKey);
  if (existing?.state === "succeeded") return { job: existing };

  const reserved = reserveBudget(input.store, input.settings, input.reserveYen, input.now);
  if (!reserved.ok) {
    const job: Job = {
      id: input.idempotencyKey,
      kind: input.kind,
      state: "cancelled",
      idempotencyKey: input.idempotencyKey,
      inputVersion: "v1",
      attempt: existing?.attempt ?? 0,
      reservedMinor: 0,
      spentMinor: 0,
      error: reserved.reason,
      retryClass: "policy",
    };
    input.store.jobs.set(job.id, job);
    return { job };
  }

  const job: Job = {
    id: input.idempotencyKey,
    kind: input.kind,
    state: "running",
    idempotencyKey: input.idempotencyKey,
    inputVersion: "v1",
    attempt: (existing?.attempt ?? 0) + 1,
    reservedMinor: input.reserveYen,
    spentMinor: 0,
    error: null,
    retryClass: null,
  };
  input.store.jobs.set(job.id, job);

  try {
    const result = await input.step();
    settleBudget(input.store, input.reserveYen, result.spentYen, input.now);
    const done: Job = { ...job, state: "succeeded", spentMinor: result.spentYen };
    input.store.jobs.set(done.id, done);
    return { job: done, value: result.value };
  } catch (err) {
    const message = err instanceof Error ? err.message : "job failed";
    const retryClass = classifyError(message);
    settleBudget(input.store, input.reserveYen, 0, input.now);
    const failed: Job = { ...job, state: "failed", error: message, retryClass };
    input.store.jobs.set(failed.id, failed);
    return { job: failed };
  }
}
