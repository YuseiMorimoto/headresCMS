import type { OpsSettings } from "./settings.ts";
import type { Conversion } from "./types.ts";

export type EpcResult =
  | { status: "calculated"; epcMinor: number; rewardMinor: number; clicks: number; currency: string }
  | { status: "undefined"; reason: "zero_clicks" | "mixed_currency" };

export function calculateEpc(input: {
  conversions: Conversion[];
  clicks: number;
  currency: string;
}): EpcResult {
  if (input.clicks === 0) return { status: "undefined", reason: "zero_clicks" };
  const approved = input.conversions.filter((c) => c.status === "approved" || c.status === "paid");
  if (approved.some((c) => c.currency !== input.currency)) {
    return { status: "undefined", reason: "mixed_currency" };
  }
  const rewardMinor = approved.reduce((sum, c) => sum + c.rewardMinor, 0);
  return {
    status: "calculated",
    epcMinor: rewardMinor / input.clicks,
    rewardMinor,
    clicks: input.clicks,
    currency: input.currency,
  };
}

export function shouldSuppressPivot(input: {
  settings: OpsSettings;
  daysLive: number;
  clicks: number;
}): { suppress: boolean; reason: string | null } {
  if (input.daysLive < input.settings.pivotGuard.minDaysLive) {
    return { suppress: true, reason: "成約率の判断材料不足（公開後日数）" };
  }
  if (input.clicks < input.settings.pivotGuard.minClicks) {
    return { suppress: true, reason: "成約率の判断材料不足（広告クリック）" };
  }
  return { suppress: false, reason: null };
}

export function weeklyReport(input: {
  period: { start: string; end: string };
  currentRewardMinor: number;
  previousRewardMinor: number;
  completeness: string;
  issues: string[];
  nextActions: string[];
}): {
  period: { start: string; end: string };
  resultYen: number;
  deltaYen: number;
  completeness: string;
  issues: string[];
  nextActions: string[];
} {
  return {
    period: input.period,
    resultYen: input.currentRewardMinor,
    deltaYen: input.currentRewardMinor - input.previousRewardMinor,
    completeness: input.completeness,
    issues: input.issues.slice(0, 5),
    nextActions: input.nextActions.slice(0, 3),
  };
}
