import type { ProductPlan, Source } from "./types.ts";

export type PricingQuote = {
  planId: string;
  seats: number;
  monthlyMinor: number;
  annualTotalMinor: number;
  currency: string;
  taxIncluded: boolean;
  asOf: string;
  sourceUrl: string;
  fx?: { usdJpy: number; asOf: string; source: string };
  jpyReferenceMinor?: number;
};

export function quotePlan(
  plan: ProductPlan,
  source: Source,
  seats = plan.seats,
): PricingQuote {
  if (source.status === "failed") {
    throw new Error("source fetch failed; refuse to rewrite price");
  }
  const unit = plan.amountMinor + plan.requiredOptionsMinor;
  const monthlyMinor = plan.interval === "month" ? unit * seats : Math.round((unit * seats) / 12);
  const annualTotalMinor = plan.interval === "year" ? unit * seats : unit * seats * 12;
  return {
    planId: plan.id,
    seats,
    monthlyMinor,
    annualTotalMinor,
    currency: plan.currency,
    taxIncluded: plan.taxIncluded,
    asOf: source.fetchedAt,
    sourceUrl: source.url,
  };
}

export function withFx(
  quote: PricingQuote,
  fx: { usdJpy: number; asOf: string; source: string },
): PricingQuote {
  if (quote.currency === "JPY") return { ...quote, fx };
  if (quote.currency !== "USD") return { ...quote, fx };
  return {
    ...quote,
    fx,
    jpyReferenceMinor: Math.round(quote.annualTotalMinor * fx.usdJpy),
  };
}

export function buildFirsthand(quotes: PricingQuote[]): string {
  if (quotes.length === 0) {
    throw new Error("firsthand requires at least one official quote");
  }
  const lines = [
    "公式資料からプログラムが計算した料金比較です。使用経験や口コミではありません。",
    ...quotes.map((q) => {
      const tax = q.taxIncluded ? "税込" : "税抜";
      const yen =
        q.currency === "JPY"
          ? `年払総額 ${q.annualTotalMinor.toLocaleString("ja-JP")}円 / 月換算 ${q.monthlyMinor.toLocaleString("ja-JP")}円`
          : `年払総額 ${q.annualTotalMinor.toLocaleString("en-US")} ${q.currency}（円換算は参考値）`;
      const fx =
        q.fx && q.jpyReferenceMinor !== undefined
          ? ` 換算日 ${q.fx.asOf} レート ${q.fx.usdJpy}（出典: ${q.fx.source}）参考 ${q.jpyReferenceMinor.toLocaleString("ja-JP")}円。`
          : "";
      return `${q.seats}席・${tax}: ${yen}。確認日 ${q.asOf.slice(0, 10)}。出典 ${q.sourceUrl}。${fx}`;
    }),
  ];
  const text = lines.join("\n");
  if (text.length < 50) throw new Error("computed firsthand shorter than 50 characters");
  return text;
}
