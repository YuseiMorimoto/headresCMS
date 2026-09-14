import type { AffiliateLink, ApprovalRecord, ArticleVersion } from "../types.ts";

export type PublishState = {
  url: string | null;
  versionId: string | null;
  commitSha: string | null;
  status: "absent" | "draft" | "publishing" | "published";
};

export type GitFileChange = {
  path: string;
  content: string;
};

export type PublisherAdapter = {
  name: string;
  saveDraft(input: {
    version: ArticleVersion;
    approval: ApprovalRecord;
    links: AffiliateLink[];
  }): Promise<{ draftRef: string; files: GitFileChange[] }>;
  publish(input: {
    version: ArticleVersion;
    approval: ApprovalRecord;
    idempotencyKey: string;
  }): Promise<{ result: "published" | "already_published"; state: PublishState }>;
  inspect(articleId: string): Promise<PublishState>;
  restore(input: { articleId: string; versionId: string; operator: string }): Promise<PublishState>;
};

export function createGitPublisher(deps: {
  inspectRemote: (articleId: string) => Promise<PublishState>;
  apply: (files: GitFileChange[], message: string) => Promise<{ sha: string }>;
}): PublisherAdapter {
  const published = new Map<string, PublishState>();

  return {
    name: "git",
    async saveDraft({ version, approval, links }) {
      const files = [
        {
          path: `content/posts/${version.cluster}/${version.articleId}.md`,
          content: renderMarkdown(version),
        },
        {
          path: `data/approvals/${version.articleId}.json`,
          content: `${JSON.stringify(approval, null, 2)}\n`,
        },
        {
          path: "data/links.json",
          content: `${JSON.stringify(
            links.map((l) => ({
              slug: l.slug,
              url: l.url,
              asp: l.asp,
              subIdParam: l.subIdParam,
              label: l.label,
              active: l.active,
              fallbackPath: l.fallbackPath,
              note: l.programId,
              updatedAt: new Date().toISOString(),
            })),
            null,
            2,
          )}\n`,
        },
      ];
      return { draftRef: `draft/${version.articleId}`, files };
    },
    async publish({ version, approval, idempotencyKey }) {
      if (!approval.reviewPassed || !approval.approvedBy || !approval.approvedAt || approval.invalidatedAt) {
        throw new Error("publish refused: approval missing or invalidated");
      }
      if (
        approval.bodyHash !== version.bodyHash ||
        approval.infoVersionSet !== version.infoVersionSet ||
        approval.linkVersion !== version.linkVersion
      ) {
        throw new Error("publish refused: version mismatch; re-approval required");
      }
      const existing = published.get(idempotencyKey);
      if (existing?.status === "published") {
        return { result: "already_published" as const, state: existing };
      }
      const remote = await deps.inspectRemote(version.articleId);
      if (remote.status === "published" && remote.versionId === version.id) {
        published.set(idempotencyKey, remote);
        return { result: "already_published" as const, state: remote };
      }
      const applied = await deps.apply(
        [
          {
            path: `content/posts/${version.cluster}/${version.articleId}.md`,
            content: renderMarkdown(version),
          },
        ],
        `publish: ${version.articleId} ${version.id}`,
      );
      const state: PublishState = {
        url: `/c/${version.cluster}/${version.articleId}/`,
        versionId: version.id,
        commitSha: applied.sha,
        status: "published",
      };
      published.set(idempotencyKey, state);
      return { result: "published" as const, state };
    },
    async inspect(articleId) {
      return deps.inspectRemote(articleId);
    },
    async restore({ articleId, versionId, operator }) {
      if (!operator) throw new Error("restore requires explicit operator");
      return {
        url: null,
        versionId,
        commitSha: `restore-${articleId}-${versionId}`,
        status: "draft",
      };
    },
  };
}

export function renderMarkdown(version: ArticleVersion): string {
  const keywords = JSON.stringify(version.targetKeywords);
  const offers = version.offers
    .map((o) => `  - slug: ${o.slug}\n    label: ${JSON.stringify(o.label)}`)
    .join("\n");
  const firsthand = version.firsthand
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
  return `---
id: ${version.articleId}
title: ${JSON.stringify(version.title)}
description: ${JSON.stringify(version.description)}
cluster: ${version.cluster}
articleType: ${version.articleType}
isPillar: false
targetKeywords: ${keywords}
publishedAt: ${version.createdAt}
updatedAt: ${version.createdAt}
offers:
${offers || "  []"}
firsthand: |
${firsthand}
noindex: true
versionId: ${version.id}
---

${version.body}
`;
}

export function isOpsSafePath(path: string): boolean {
  return (
    path.startsWith("content/posts/") ||
    path === "data/links.json" ||
    path.startsWith("data/approvals/") ||
    path === "data/ops-settings.json"
  );
}
