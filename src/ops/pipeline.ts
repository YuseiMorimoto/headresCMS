import { grantApproval, invalidateIfChanged } from "./approval.ts";
import { transitionArticle } from "./article-machine.ts";
import type { AspConnector } from "./connectors/asp.ts";
import type { PublisherAdapter } from "./connectors/publisher.ts";
import { materializeVersion, type GeneratedArticle } from "./generate.ts";
import { proposeImprovements } from "./improve.ts";
import { proposeTopics } from "./plan.ts";
import { buildFirsthand, quotePlan, type PricingQuote } from "./pricing.ts";
import { inspectVersion } from "./review.ts";
import type { OpsSettings } from "./settings.ts";
import type { MemoryOpsStore } from "./store.ts";
import { syncConversions } from "./sync.ts";
import type { AffiliateLink, Article, ApprovalRecord, ProductPlan, Source, Topic } from "./types.ts";

export async function runPlanWorkflow(input: {
  store: MemoryOpsStore;
  cluster: string;
  audience: string;
  problems: string[];
  weeklyNewArticles: number;
}): Promise<Topic[]> {
  const existing = [...input.store.topics.values()].map((t) => t.searchIntent);
  const topics = proposeTopics({
    cluster: input.cluster,
    audience: input.audience,
    problems: input.problems,
    existingIntents: existing,
    select: input.weeklyNewArticles,
  });
  for (const topic of topics) input.store.topics.set(topic.id, topic);
  return topics;
}

export async function runGenerateWorkflow(input: {
  store: MemoryOpsStore;
  settings: OpsSettings;
  topic: Topic;
  generated: GeneratedArticle;
  quotes: PricingQuote[];
  plans: ProductPlan[];
  sources: Source[];
  offerSlugs: Array<{ slug: string; label: string }>;
  knownOfferSlugs: string[];
  publishedInternalHrefs: string[];
  existingIntents: string[];
  now: Date;
}): Promise<{ article: Article; approval: ApprovalRecord }> {
  const articleId = input.topic.id.replace("topic-", "article-");
  const versionId = `${articleId}-v1`;
  const version = await materializeVersion({
    articleId,
    versionId,
    topic: input.topic,
    generated: input.generated,
    quotes: input.quotes,
    offerSlugs: input.topic.template === "problem_no_ad" ? [] : input.offerSlugs,
    sourceIds: input.sources.map((s) => s.id),
    infoVersionSet: input.plans.map((p) => p.infoVersion).sort().join(","),
    linkVersion: "lv_1",
    now: input.now,
  });
  const review = inspectVersion({
    version,
    sources: input.sources,
    settings: input.settings,
    now: input.now,
    existingIntents: input.existingIntents,
    publishedInternalHrefs: input.publishedInternalHrefs,
    knownOfferSlugs: input.knownOfferSlugs,
    topic: input.topic,
  });
  version.review = review;
  input.store.versions.set(version.id, version);

  const article: Article = {
    id: articleId,
    slug: articleId,
    cluster: input.topic.cluster,
    topicId: input.topic.id,
    status: review.passed ? "awaiting_approval" : "needs_fix",
    publishedVersionId: null,
    draftVersionId: version.id,
    publishedUrl: null,
  };
  article.status = transitionArticle("draft", "collecting");
  article.status = transitionArticle(article.status, "generating");
  article.status = transitionArticle(article.status, "reviewing");
  article.status = transitionArticle(article.status, review.passed ? "awaiting_approval" : "needs_fix");
  input.store.articles.set(article.id, article);

  const approval: ApprovalRecord = {
    articleId: article.id,
    versionId: version.id,
    bodyHash: version.bodyHash,
    infoVersionSet: version.infoVersionSet,
    linkVersion: version.linkVersion,
    reviewPassed: review.passed,
    approvedBy: null,
    approvedAt: null,
    invalidatedAt: null,
  };
  input.store.approvals.set(article.id, approval);
  return { article, approval };
}

export async function runPublishWorkflow(input: {
  store: MemoryOpsStore;
  publisher: PublisherAdapter;
  articleId: string;
  operator: string;
  now: Date;
}): Promise<{ result: "published" | "already_published" | "refused"; reason?: string }> {
  const article = input.store.articles.get(input.articleId);
  const version = article?.draftVersionId ? input.store.versions.get(article.draftVersionId) : undefined;
  const approval = input.store.approvals.get(input.articleId);
  if (!article || !version || !approval) return { result: "refused", reason: "missing" };
  const current = invalidateIfChanged(approval, version, input.now);
  input.store.approvals.set(input.articleId, current);
  if (!current.reviewPassed) return { result: "refused", reason: "review" };
  let granted = current;
  try {
    granted = grantApproval(current, input.operator, input.now);
  } catch (err) {
    return { result: "refused", reason: err instanceof Error ? err.message : "approval" };
  }
  input.store.approvals.set(input.articleId, granted);
  article.status = transitionArticle(article.status, "approved");
  article.status = transitionArticle(article.status, "publishing");
  const published = await input.publisher.publish({
    version,
    approval: granted,
    idempotencyKey: `${article.id}:${version.id}`,
  });
  article.status = transitionArticle(article.status, "published");
  article.publishedVersionId = version.id;
  article.publishedUrl = published.state.url;
  input.store.articles.set(article.id, article);
  return { result: published.result };
}

export function quotesFromStore(store: MemoryOpsStore, productId: string): PricingQuote[] {
  const quotes: PricingQuote[] = [];
  for (const plan of store.plans.values()) {
    if (plan.productId !== productId) continue;
    const source = store.sources.get(plan.sourceId);
    if (!source) continue;
    quotes.push(quotePlan(plan, source, plan.seats));
  }
  return quotes;
}

export function computedFirsthand(store: MemoryOpsStore, productId: string): string {
  return buildFirsthand(quotesFromStore(store, productId));
}

export async function runImproveWorkflow(input: {
  store: MemoryOpsStore;
  articleId: string;
  now: Date;
}): Promise<Article | null> {
  const article = input.store.articles.get(input.articleId);
  const published = article?.publishedVersionId
    ? input.store.versions.get(article.publishedVersionId)
    : undefined;
  if (!article || !published) return null;
  const ideas = proposeImprovements({
    version: published,
    stalePricing: false,
    clicks: 0,
    conversions: 0,
  });
  if (ideas.length === 0) return article;
  const draft: typeof published = {
    ...published,
    id: `${published.id}-rev`,
    createdAt: input.now.toISOString(),
  };
  input.store.versions.set(draft.id, draft);
  article.draftVersionId = draft.id;
  article.status = "awaiting_approval";
  input.store.articles.set(article.id, article);
  return article;
}

export async function runSyncWorkflow(
  store: MemoryOpsStore,
  connector: AspConnector,
  since: string,
) {
  return syncConversions(store, connector, since);
}

export function exportLinks(store: MemoryOpsStore): AffiliateLink[] {
  return [...store.links.values()];
}
