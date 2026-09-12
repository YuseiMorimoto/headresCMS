import { sha256Hex, normalizeBody } from "./hash.ts";
import type { ApprovalRecord, ArticleVersion } from "./types.ts";

export async function fingerprint(version: Pick<ArticleVersion, "body" | "infoVersionSet" | "linkVersion">): Promise<{
  bodyHash: string;
  infoVersionSet: string;
  linkVersion: string;
}> {
  return {
    bodyHash: await sha256Hex(normalizeBody(version.body)),
    infoVersionSet: version.infoVersionSet,
    linkVersion: version.linkVersion,
  };
}

export function matchesApproval(version: ArticleVersion, approval: ApprovalRecord): boolean {
  return (
    approval.articleId === version.articleId &&
    approval.versionId === version.id &&
    approval.bodyHash === version.bodyHash &&
    approval.infoVersionSet === version.infoVersionSet &&
    approval.linkVersion === version.linkVersion &&
    approval.reviewPassed &&
    approval.invalidatedAt === null
  );
}

export function invalidateIfChanged(approval: ApprovalRecord, version: ArticleVersion, now: Date): ApprovalRecord {
  if (matchesApproval(version, approval) && approval.versionId === version.id) return approval;
  if (
    approval.bodyHash !== version.bodyHash ||
    approval.infoVersionSet !== version.infoVersionSet ||
    approval.linkVersion !== version.linkVersion
  ) {
    return { ...approval, invalidatedAt: now.toISOString() };
  }
  return approval;
}

export function grantApproval(approval: ApprovalRecord, operator: string, now: Date): ApprovalRecord {
  if (!operator) throw new Error("approval requires operator");
  if (!approval.reviewPassed) throw new Error("review has not passed");
  if (approval.invalidatedAt) throw new Error("approval invalidated");
  return { ...approval, approvedBy: operator, approvedAt: now.toISOString() };
}
