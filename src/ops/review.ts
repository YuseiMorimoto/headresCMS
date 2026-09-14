import type { OpsSettings } from "./settings.ts";
import type { ArticleVersion, ReviewIssue, ReviewResult, Source, Topic } from "./types.ts";
import { hasUnsafeHtml } from "./sanitize.ts";

export const NG_PATTERNS: Array<{ pattern: RegExp; label: string; code: string }> = [
  { pattern: /必ず(治る|効く|痩せる)/, label: "薬機法: 効能の断定", code: "yakki" },
  { pattern: /100%|日本一|世界一/, label: "景表法: 根拠のない最上級", code: "keihyo" },
  { pattern: /今だけ|先着\d+名/, label: "景表法: 煽り表現", code: "hype" },
  { pattern: /口コミでは(?!ありません)|顧客事例では|専門家が推奨/, label: "創作した社会的証明", code: "fabricated_proof" },
  { pattern: /最安|No\.?\s*1|ランキング第/, label: "根拠のない最安・順位", code: "ranking" },
  { pattern: /実際に使ってみたところ|試用した感想/, label: "未試用の使用経験", code: "untried_experience" },
];

export function inspectVersion(input: {
  version: ArticleVersion;
  sources: Source[];
  settings: OpsSettings;
  now: Date;
  existingIntents: string[];
  publishedInternalHrefs: string[];
  knownOfferSlugs: string[];
  topic?: Topic;
}): ReviewResult {
  const issues: ReviewIssue[] = [];
  const { version, sources, settings, now } = input;
  const text = `${version.title}\n${version.body}\n${version.firsthand}`;

  if (version.title.length < 10 || version.description.length < 40) {
    issues.push({ code: "required", severity: "blocker", message: "title/description が不足" });
  }
  if (version.firsthand.length < 50) {
    issues.push({ code: "firsthand", severity: "blocker", message: "firsthand が50文字未満" });
  }
  if (version.sourceIds.length === 0 && version.offers.length > 0) {
    issues.push({ code: "claim_source", severity: "blocker", message: "広告付き記事に出典がない" });
  }

  for (const sourceId of version.sourceIds) {
    const source = sources.find((s) => s.id === sourceId);
    if (!source) {
      issues.push({ code: "missing_source", severity: "blocker", message: `出典 ${sourceId} がない` });
      continue;
    }
    if (source.status === "failed") {
      issues.push({ code: "source_failed", severity: "blocker", message: "出典取得失敗を本文根拠に使っている" });
    }
    const ageDays = (now.getTime() - Date.parse(source.fetchedAt)) / 86_400_000;
    const limit = source.url.includes("pricing") ? settings.freshnessDays.pricing : settings.freshnessDays.other;
    if (Number.isFinite(ageDays) && ageDays > limit) {
      issues.push({ code: "stale", severity: "blocker", message: `出典が鮮度期限（${limit}日）を超えている` });
    }
  }

  for (const { pattern, label, code } of NG_PATTERNS) {
    if (pattern.test(text)) {
      issues.push({ code, severity: "blocker", message: label });
    }
  }

  if (hasUnsafeHtml(version.body)) {
    issues.push({ code: "html", severity: "blocker", message: "script/iframe 等の不安全な HTML" });
  }

  const goSlugs = [...version.body.matchAll(/\/go\/([a-z0-9-]+)/g)].map((m) => m[1]!);
  for (const slug of goSlugs) {
    if (!input.knownOfferSlugs.includes(slug)) {
      issues.push({ code: "unknown_offer", severity: "blocker", message: `未知の offer slug: ${slug}` });
    }
  }

  const internal = [...version.body.matchAll(/\]\((\/c\/[^)]+)\)/g)].map((m) => m[1]!);
  for (const href of internal) {
    if (!input.publishedInternalHrefs.includes(href)) {
      issues.push({ code: "draft_internal_link", severity: "blocker", message: `未公開ページへの内部リンク: ${href}` });
    }
  }

  const intent = input.topic?.searchIntent ?? version.targetKeywords[0] ?? "";
  if (intent && input.existingIntents.includes(intent)) {
    issues.push({ code: "duplicate_intent", severity: "blocker", message: "同一検索意図の既存記事がある" });
  }

  const headingJump = /(?:^|\n)## .+\n+#### /m.test(version.body);
  if (headingJump) {
    issues.push({ code: "heading", severity: "warning", message: "見出し階層が飛んでいる" });
  }

  return {
    passed: issues.filter((i) => i.severity === "blocker").length === 0,
    issues,
    checkedAt: now.toISOString(),
  };
}
