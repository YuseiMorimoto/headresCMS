import type {
  AffiliateLink,
  ApprovalRecord,
  Article,
  ArticleVersion,
  Claim,
  Conversion,
  CostLedger,
  Job,
  ProductPlan,
  Program,
  Source,
  SyncState,
  Topic,
} from "./types.ts";

export type MemoryOpsStore = {
  programs: Map<string, Program>;
  plans: Map<string, ProductPlan>;
  sources: Map<string, Source>;
  claims: Map<string, Claim>;
  claimArticles: Map<string, string[]>;
  topics: Map<string, Topic>;
  articles: Map<string, Article>;
  versions: Map<string, ArticleVersion>;
  approvals: Map<string, ApprovalRecord>;
  links: Map<string, AffiliateLink>;
  conversions: Map<string, Conversion>;
  jobs: Map<string, Job>;
  ledger: Map<string, CostLedger>;
  sync: Map<string, SyncState>;
  ranKeys: Set<string>;
  killSwitch: boolean;
};

export function createMemoryStore(): MemoryOpsStore {
  return {
    programs: new Map(),
    plans: new Map(),
    sources: new Map(),
    claims: new Map(),
    claimArticles: new Map(),
    topics: new Map(),
    articles: new Map(),
    versions: new Map(),
    approvals: new Map(),
    links: new Map(),
    conversions: new Map(),
    jobs: new Map(),
    ledger: new Map(),
    sync: new Map(),
    ranKeys: new Set(),
    killSwitch: false,
  };
}

export function conversionKey(network: string, rawId: string): string {
  return `${network}:${rawId}`;
}
