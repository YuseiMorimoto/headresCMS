import { z } from "zod";

const weekday = z.number().int().min(0).max(6);

export const opsSettingsSchema = z.object({
  timezone: z.literal("Asia/Tokyo"),
  automationEnabled: z.boolean(),
  weeklyNewArticles: z.number().int().min(0).max(14),
  weeklyRevisions: z.number().int().min(0).max(14),
  maxAwaitingApproval: z.number().int().min(0).max(50),
  monthlyCapYen: z.number().int().positive(),
  reserveBufferYen: z.number().int().min(0),
  articleReserveCapYen: z.number().int().positive(),
  budgetNotifyPercent: z.number().int().min(1).max(100),
  budgetStopPercent: z.number().int().min(1).max(100),
  freshnessDays: z.object({
    pricing: z.number().int().positive(),
    other: z.number().int().positive(),
  }),
  pivotGuard: z.object({
    minDaysLive: z.number().int().min(0),
    minClicks: z.number().int().min(0),
  }),
  retentionDays: z.object({
    jobLogs: z.number().int().positive(),
    aggregatesMonths: z.number().int().positive(),
  }),
  schedules: z.object({
    sync: z.object({ hour: z.number().int().min(0).max(23), weekdays: z.array(weekday).min(1) }),
    plan: z.object({ hour: z.number().int().min(0).max(23), weekdays: z.array(weekday).min(1) }),
    analyze: z.object({ hour: z.number().int().min(0).max(23), weekdays: z.array(weekday).min(1) }),
    generate: z.object({ hour: z.number().int().min(0).max(23), weekdays: z.array(weekday).min(1) }),
  }),
  allowedFetchHosts: z.array(z.string().min(1)),
  fixedCosts: z.array(
    z.object({
      name: z.string(),
      yenPerMonth: z.number().int().min(0),
    }),
  ),
  priceBook: z.array(
    z.object({
      provider: z.string(),
      model: z.string(),
      inputYenPerMTok: z.number().nonnegative(),
      outputYenPerMTok: z.number().nonnegative(),
      safetyFactor: z.number().positive(),
      confirmedAt: z.string(),
      fx: z.object({
        usdJpy: z.number().positive(),
        asOf: z.string(),
        source: z.string(),
      }),
    }),
  ),
});

export type OpsSettings = z.infer<typeof opsSettingsSchema>;

export function parseOpsSettings(raw: unknown): OpsSettings {
  return opsSettingsSchema.parse(raw);
}

/** JST の暦月から台帳キーを作る。UTC 日付にしない。 */
export function jstMonthKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  if (!year || !month) throw new Error("JST month formatting failed");
  return `${year}-${month}`;
}

export function jstParts(now: Date = new Date()): { weekday: number; hour: number; date: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tokyo",
    weekday: "short",
    hour: "2-digit",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const weekdayName = parts.find((p) => p.type === "weekday")?.value;
  const hourRaw = parts.find((p) => p.type === "hour")?.value;
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  const weekMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekday = weekdayName ? weekMap[weekdayName] : undefined;
  if (weekday === undefined || hourRaw === undefined || !year || !month || !day) {
    throw new Error("JST parts formatting failed");
  }
  return { weekday, hour: Number(hourRaw), date: `${year}-${month}-${day}` };
}

export function dueJobKinds(
  settings: OpsSettings,
  now: Date,
  alreadyRan: ReadonlySet<string>,
): Array<"sync" | "plan" | "analyze" | "generate"> {
  if (!settings.automationEnabled) return [];
  const { weekday, hour, date } = jstParts(now);
  const kinds = ["sync", "plan", "analyze", "generate"] as const;
  return kinds.filter((kind) => {
    const rule = settings.schedules[kind];
    if (!rule.weekdays.includes(weekday) || rule.hour !== hour) return false;
    return !alreadyRan.has(`${kind}:${date}`);
  });
}
