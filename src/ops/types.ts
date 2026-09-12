export type ProgramStatus =
  | "candidate"
  | "researching"
  | "applying"
  | "applied"
  | "approved"
  | "operable"
  | "held"
  | "ended";

export type CapabilityStatus = "confirmed" | "unconfirmed" | "unsupported";

export type CapabilityKey =
  | "productInfo"
  | "createLink"
  | "reuseLink"
  | "articleSubId"
  | "conversions"
  | "statusUpdate"
  | "notifications"
  | "partnershipStatus";

export type ArticleStatus =
  | "draft"
  | "collecting"
  | "generating"
  | "reviewing"
  | "needs_fix"
  | "awaiting_approval"
  | "approved"
  | "publishing"
  | "published"
  | "held"
  | "rejected"
  | "failed";

export type TopicTemplate =
  | "conditional_compare"
  | "pricing_sim"
  | "use_case_pick"
  | "free_plan_limits"
  | "switch_checklist"
  | "problem_no_ad";

export type ArticleType = "comparison" | "review" | "guide";

export type ConversionStatus = "pending" | "approved" | "rejected" | "reversed" | "paid";

export type JobKind = "sync" | "plan" | "analyze" | "generate" | "review" | "publish" | "improve" | "detect";

export type JobState = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type RetryClass = "transient" | "auth" | "permission" | "policy" | "fatal";

export type SyncHealth = "ok" | "error" | "delayed" | "disconnected" | "empty" | "zero";

export type Money = {
  minor: number;
  currency: string;
};

export type Program = {
  id: string;
  network: string;
  externalId: string;
  name: string;
  status: ProgramStatus;
  region: string;
  languageJa: boolean;
  adopted: boolean;
  rewardFixedMinor: number | null;
  rewardRateBps: number | null;
  rewardCurrency: string;
  recurringMonths: number | null;
  verifyBy: string | null;
  capabilities: Record<CapabilityKey, CapabilityStatus>;
  notes: string;
};

export type ProductPlan = {
  id: string;
  productId: string;
  name: string;
  seats: number;
  interval: "month" | "year";
  amountMinor: number;
  currency: string;
  taxIncluded: boolean;
  requiredOptionsMinor: number;
  minTermMonths: number;
  infoVersion: string;
  sourceId: string;
};

export type Source = {
  id: string;
  url: string;
  fetchedAt: string;
  excerpt: string;
  contentHash: string;
  status: "ok" | "failed" | "stale";
  r2Key: string | null;
};

export type Claim = {
  id: string;
  productId: string;
  sourceId: string;
  kind: "price" | "feature" | "region" | "other";
  text: string;
  infoVersion: string;
};

export type Topic = {
  id: string;
  searchIntent: string;
  template: TopicTemplate;
  cluster: string;
  articleType: ArticleType;
  audience: string;
  selected: boolean;
};

export type Article = {
  id: string;
  slug: string;
  cluster: string;
  topicId: string | null;
  status: ArticleStatus;
  publishedVersionId: string | null;
  draftVersionId: string | null;
  publishedUrl: string | null;
};

export type ArticleVersion = {
  id: string;
  articleId: string;
  title: string;
  description: string;
  body: string;
  firsthand: string;
  bodyHash: string;
  infoVersionSet: string;
  linkVersion: string;
  targetKeywords: string[];
  articleType: ArticleType;
  cluster: string;
  offers: Array<{ slug: string; label: string }>;
  sourceIds: string[];
  generationRunId: string | null;
  review: ReviewResult | null;
  createdAt: string;
};

export type ReviewIssue = {
  code: string;
  severity: "blocker" | "warning";
  message: string;
};

export type ReviewResult = {
  passed: boolean;
  issues: ReviewIssue[];
  checkedAt: string;
};

export type ApprovalRecord = {
  articleId: string;
  versionId: string;
  bodyHash: string;
  infoVersionSet: string;
  linkVersion: string;
  reviewPassed: boolean;
  approvedBy: string | null;
  approvedAt: string | null;
  invalidatedAt: string | null;
};

export type AffiliateLink = {
  slug: string;
  programId: string;
  url: string;
  asp: string;
  subIdParam: string | null;
  label: string;
  active: boolean;
  fallbackPath: string;
  version: string;
};

export type Conversion = {
  network: string;
  rawId: string;
  programId: string;
  articleId: string | null;
  occurredAt: string;
  approvedAt: string | null;
  currency: string;
  saleMinor: number | null;
  rewardMinor: number;
  rawStatus: string;
  status: ConversionStatus;
};

export type Job = {
  id: string;
  kind: JobKind;
  state: JobState;
  idempotencyKey: string;
  inputVersion: string;
  attempt: number;
  reservedMinor: number;
  spentMinor: number;
  error: string | null;
  retryClass: RetryClass | null;
};

export type CostLedger = {
  month: string;
  capMinor: number;
  fixedMinor: number;
  spentMinor: number;
  reservedMinor: number;
  bufferMinor: number;
};

export type SyncState = {
  source: string;
  health: SyncHealth;
  lastSuccessAt: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  importedCount: number;
  message: string;
};
