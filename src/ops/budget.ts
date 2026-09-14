import { jstMonthKey, type OpsSettings } from "./settings.ts";
import type { MemoryOpsStore } from "./store.ts";
import type { CostLedger } from "./types.ts";

export function emptyLedger(month: string, settings: OpsSettings): CostLedger {
  const fixedMinor = settings.fixedCosts.reduce((sum, row) => sum + row.yenPerMonth, 0);
  return {
    month,
    capMinor: settings.monthlyCapYen,
    fixedMinor,
    spentMinor: 0,
    reservedMinor: 0,
    bufferMinor: settings.reserveBufferYen,
  };
}

export function usageMinor(ledger: CostLedger): number {
  return ledger.fixedMinor + ledger.spentMinor + ledger.reservedMinor + ledger.bufferMinor;
}

export function estimateAiYen(input: {
  settings: OpsSettings;
  model: string;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxRetries: number;
  searchCalls?: number;
  searchYenEach?: number;
}): number {
  const book = input.settings.priceBook.find((row) => row.model === input.model);
  if (!book) throw new Error(`price book missing for ${input.model}`);
  const attempts = 1 + input.maxRetries;
  const inputCost = (input.maxInputTokens / 1_000_000) * book.inputYenPerMTok;
  const outputCost = (input.maxOutputTokens / 1_000_000) * book.outputYenPerMTok;
  const search = (input.searchCalls ?? 0) * (input.searchYenEach ?? 0);
  return Math.ceil((inputCost + outputCost + search) * book.safetyFactor * attempts);
}

export type ReserveResult =
  | { ok: true; ledger: CostLedger }
  | { ok: false; reason: "over_cap" | "article_cap" | "stop_threshold" | "missing_fixed" };

export function reserveBudget(
  store: MemoryOpsStore,
  settings: OpsSettings,
  amountYen: number,
  now = new Date(),
): ReserveResult {
  if (settings.fixedCosts.length === 0) {
    return { ok: false, reason: "missing_fixed" };
  }
  if (amountYen > settings.articleReserveCapYen) {
    return { ok: false, reason: "article_cap" };
  }
  const month = jstMonthKey(now);
  const current = store.ledger.get(month) ?? emptyLedger(month, settings);
  const projected = usageMinor(current) + amountYen;
  if (projected > current.capMinor) {
    return { ok: false, reason: "over_cap" };
  }
  const stopLine = Math.floor((current.capMinor * settings.budgetStopPercent) / 100);
  if (projected > stopLine) {
    return { ok: false, reason: "stop_threshold" };
  }
  const next: CostLedger = { ...current, reservedMinor: current.reservedMinor + amountYen };
  store.ledger.set(month, next);
  return { ok: true, ledger: next };
}

export function settleBudget(
  store: MemoryOpsStore,
  reservedYen: number,
  spentYen: number,
  now = new Date(),
): CostLedger {
  const month = jstMonthKey(now);
  const current = store.ledger.get(month);
  if (!current) throw new Error(`ledger missing for ${month}`);
  const next: CostLedger = {
    ...current,
    reservedMinor: Math.max(0, current.reservedMinor - reservedYen),
    spentMinor: current.spentMinor + spentYen,
  };
  store.ledger.set(month, next);
  return next;
}

export function budgetAlerts(ledger: CostLedger, settings: OpsSettings): Array<"notify" | "stop"> {
  const used = usageMinor(ledger);
  const alerts: Array<"notify" | "stop"> = [];
  if (used >= Math.floor((ledger.capMinor * settings.budgetStopPercent) / 100)) alerts.push("stop");
  else if (used >= Math.floor((ledger.capMinor * settings.budgetNotifyPercent) / 100)) alerts.push("notify");
  return alerts;
}
