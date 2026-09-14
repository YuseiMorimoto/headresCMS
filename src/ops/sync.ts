import type { AspConnector } from "./connectors/asp.ts";
import { conversionKey } from "./store.ts";
import type { MemoryOpsStore } from "./store.ts";
import type { Conversion, ConversionStatus, SyncState } from "./types.ts";

const STATUS_MAP: Record<string, ConversionStatus> = {
  pending: "pending",
  approved: "approved",
  confirmed: "approved",
  rejected: "rejected",
  denied: "rejected",
  reversed: "reversed",
  cancelled: "reversed",
  canceled: "reversed",
  paid: "paid",
};

export function normalizeStatus(raw: string): ConversionStatus {
  return STATUS_MAP[raw.toLowerCase()] ?? "pending";
}

export function upsertConversion(store: MemoryOpsStore, incoming: Conversion): Conversion {
  const key = conversionKey(incoming.network, incoming.rawId);
  const existing = store.conversions.get(key);
  const merged: Conversion = existing
    ? {
        ...existing,
        ...incoming,
        articleId: incoming.articleId ?? existing.articleId,
        rewardMinor: incoming.rewardMinor,
        status: incoming.status,
      }
    : incoming;
  if (!merged.articleId) merged.articleId = null;
  store.conversions.set(key, merged);
  return merged;
}

export async function syncConversions(
  store: MemoryOpsStore,
  connector: AspConnector,
  since: string,
): Promise<SyncState> {
  if (!connector.implemented) {
    const state: SyncState = {
      source: connector.network,
      health: "disconnected",
      lastSuccessAt: null,
      periodStart: since,
      periodEnd: null,
      importedCount: 0,
      message: connector.unimplementedReason ?? "not implemented",
    };
    store.sync.set(connector.network, state);
    return state;
  }
  try {
    let cursor: string | null = null;
    let imported = 0;
    do {
      const page = await connector.listConversions({ cursor, since });
      for (const item of page.items) {
        upsertConversion(store, { ...item, status: normalizeStatus(item.rawStatus) });
        imported += 1;
      }
      cursor = page.cursor;
    } while (cursor);
    const health = imported === 0 ? "empty" : "ok";
    const state: SyncState = {
      source: connector.network,
      health,
      lastSuccessAt: new Date().toISOString(),
      periodStart: since,
      periodEnd: new Date().toISOString(),
      importedCount: imported,
      message: imported === 0 ? "no rows" : "ok",
    };
    store.sync.set(connector.network, state);
    return state;
  } catch (err) {
    const state: SyncState = {
      source: connector.network,
      health: "error",
      lastSuccessAt: store.sync.get(connector.network)?.lastSuccessAt ?? null,
      periodStart: since,
      periodEnd: null,
      importedCount: 0,
      message: err instanceof Error ? err.message : "sync error",
    };
    store.sync.set(connector.network, state);
    return state;
  }
}

export function attributedReward(store: MemoryOpsStore, articleId: string): { known: number; unknown: number } {
  let known = 0;
  let unknown = 0;
  for (const row of store.conversions.values()) {
    if (row.status !== "approved" && row.status !== "paid") continue;
    if (row.articleId === articleId) known += row.rewardMinor;
    if (row.articleId === null) unknown += row.rewardMinor;
  }
  return { known, unknown };
}
