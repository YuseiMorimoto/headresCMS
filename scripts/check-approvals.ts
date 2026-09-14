import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { sha256Hex, normalizeBody } from "../src/ops/hash.ts";
import type { ApprovalRecord } from "../src/ops/types.ts";

const POSTS_DIR = join(process.cwd(), "content/posts");
const APPROVALS_DIR = join(process.cwd(), "data/approvals");

function collectMarkdown(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return collectMarkdown(full);
    return entry.name.endsWith(".md") ? [full] : [];
  });
}

export async function checkApprovals(): Promise<string[]> {
  const errors: string[] = [];
  if (!existsSync(APPROVALS_DIR)) return errors;

  for (const file of collectMarkdown(POSTS_DIR)) {
    const raw = readFileSync(file, "utf-8");
    const { data, content } = matter(raw);
    const versionId = data.versionId as string | undefined;
    if (!versionId) continue;
    const approvalPath = join(APPROVALS_DIR, `${data.id}.json`);
    if (!existsSync(approvalPath)) {
      errors.push(`${file}: versionId があるのに approval がない`);
      continue;
    }
    const approval = JSON.parse(readFileSync(approvalPath, "utf-8")) as ApprovalRecord;
    const bodyHash = await sha256Hex(normalizeBody(content));
    if (!approval.reviewPassed) errors.push(`${file}: 検品未通過のまま公開対象`);
    if (approval.invalidatedAt) errors.push(`${file}: 承認が失効している`);
    if (approval.bodyHash !== bodyHash) errors.push(`${file}: 本文ハッシュ不一致。再承認が必要`);
    if (approval.versionId !== versionId) errors.push(`${file}: 版ID不一致。再承認が必要`);
  }
  return errors;
}

if (process.argv[1]?.endsWith("check-approvals.ts")) {
  const errors = await checkApprovals();
  if (errors.length > 0) {
    for (const error of errors) console.error(error);
    process.exit(1);
  }
  console.log("✓ approval check: ok");
}
