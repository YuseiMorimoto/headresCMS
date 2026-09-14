import { z } from "zod";
import { buildFirsthand, type PricingQuote } from "./pricing.ts";
import { sha256Hex, normalizeBody } from "./hash.ts";
import type { ArticleType, ArticleVersion, Topic } from "./types.ts";

export const generatedArticleSchema = z.object({
  title: z.string().min(10).max(60),
  description: z.string().min(40).max(120),
  headings: z.array(z.string()).min(3),
  body: z.string().min(80),
  suitedFor: z.array(z.string()).min(1),
  notSuitedFor: z.array(z.string()).min(1),
  cautions: z.array(z.string()).min(1),
  offerPlacements: z.array(
    z.object({
      productId: z.string(),
      position: z.enum(["after_conclusion", "in_table", "before_summary"]),
    }),
  ),
});

export type GeneratedArticle = z.infer<typeof generatedArticleSchema>;

export function topicToArticleType(template: Topic["template"]): ArticleType {
  if (template === "conditional_compare" || template === "pricing_sim") return "comparison";
  if (template === "use_case_pick" || template === "free_plan_limits" || template === "switch_checklist") {
    return "guide";
  }
  return "guide";
}

export async function materializeVersion(input: {
  articleId: string;
  versionId: string;
  topic: Topic;
  generated: GeneratedArticle;
  quotes: PricingQuote[];
  offerSlugs: Array<{ slug: string; label: string }>;
  sourceIds: string[];
  infoVersionSet: string;
  linkVersion: string;
  now: Date;
}): Promise<ArticleVersion> {
  const parsed = generatedArticleSchema.parse(input.generated);
  const firsthand = buildFirsthand(input.quotes);
  const body = [
    parsed.body,
    "",
    "## 向いている人・向かない人",
    ...parsed.suitedFor.map((s) => `- 向く: ${s}`),
    ...parsed.notSuitedFor.map((s) => `- 向かない: ${s}`),
    "",
    "## 注意点",
    ...parsed.cautions.map((c) => `- ${c}`),
    "",
    ...input.offerSlugs.map((o) => `[${o.label}](/go/${o.slug})`),
  ].join("\n");
  return {
    id: input.versionId,
    articleId: input.articleId,
    title: parsed.title,
    description: parsed.description,
    body,
    firsthand,
    bodyHash: await sha256Hex(normalizeBody(body)),
    infoVersionSet: input.infoVersionSet,
    linkVersion: input.linkVersion,
    targetKeywords: [input.topic.searchIntent],
    articleType: topicToArticleType(input.topic.template),
    cluster: input.topic.cluster,
    offers: input.topic.template === "problem_no_ad" ? [] : input.offerSlugs,
    sourceIds: input.sourceIds,
    generationRunId: null,
    review: null,
    createdAt: input.now.toISOString(),
  };
}
