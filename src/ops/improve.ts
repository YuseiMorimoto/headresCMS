import type { ArticleVersion, Program } from "./types.ts";

export type Improvement = {
  kind: "title" | "compare_table" | "pricing" | "explanation" | "related";
  hypothesis: string;
  costYen: number;
  reason: string;
};

export function proposeImprovements(input: {
  version: ArticleVersion;
  stalePricing: boolean;
  clicks: number;
  conversions: number;
}): Improvement[] {
  const items: Improvement[] = [];
  if (input.stalePricing) {
    items.push({
      kind: "pricing",
      hypothesis: "料金出典が古いため比較表の更新が必要",
      costYen: 40,
      reason: "鮮度期限切れ",
    });
  }
  if (input.clicks >= 50 && input.conversions === 0) {
    items.push({
      kind: "title",
      hypothesis: "検索意図とタイトルのずれがCTRを下げている可能性",
      costYen: 30,
      reason: "クリックはあるが成果なし（仮説）",
    });
  }
  if (!input.version.body.includes("|")) {
    items.push({
      kind: "compare_table",
      hypothesis: "比較表がないため判断材料が弱い",
      costYen: 50,
      reason: "構造不足",
    });
  }
  return items.sort((a, b) => a.costYen - b.costYen);
}

export function emergencyLinkDisable(program: Program, linksActive: boolean): {
  notify: boolean;
  rewritePublished: boolean;
  action: "prepare_takedown" | "none";
} {
  if (program.status === "ended" && linksActive) {
    return { notify: true, rewritePublished: false, action: "prepare_takedown" };
  }
  return { notify: false, rewritePublished: false, action: "none" };
}
