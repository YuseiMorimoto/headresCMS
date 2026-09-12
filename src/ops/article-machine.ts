import type { ArticleStatus } from "./types.ts";

const FORWARD: Record<ArticleStatus, ArticleStatus[]> = {
  draft: ["collecting", "held", "rejected", "failed"],
  collecting: ["generating", "held", "failed"],
  generating: ["reviewing", "failed"],
  reviewing: ["needs_fix", "awaiting_approval", "failed"],
  needs_fix: ["generating", "held", "rejected"],
  awaiting_approval: ["approved", "needs_fix", "held", "rejected"],
  approved: ["publishing", "held"],
  publishing: ["published", "failed"],
  published: ["draft"],
  held: ["draft", "rejected"],
  rejected: [],
  failed: ["draft", "collecting", "generating", "publishing"],
};

export function transitionArticle(current: ArticleStatus, next: ArticleStatus): ArticleStatus {
  if (current === next) return current;
  if (!FORWARD[current].includes(next)) {
    throw new Error(`illegal article transition ${current} → ${next}`);
  }
  return next;
}

export function shouldPauseGeneration(awaitingCount: number, maxAwaiting: number): boolean {
  return awaitingCount >= maxAwaiting;
}
