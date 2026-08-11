import { readFileSync, writeFileSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { tmpdir } from "node:os";

type LinkRecord = {
  slug: string;
  url: string;
  asp: string;
  subIdParam: string | null;
  label: string;
  active: boolean;
  fallbackPath: string;
  note?: string;
  updatedAt: string;
};

const LINKS_PATH = join(process.cwd(), "data/links.json");

function getKvNamespaceId(): string {
  const fromEnv = process.env.KV_NAMESPACE_ID;
  if (fromEnv) return fromEnv;

  const wrangler = readFileSync(join(process.cwd(), "wrangler.jsonc"), "utf-8");
  const match = wrangler.match(/"binding":\s*"LINKS"[^}]*"id":\s*"([^"]+)"/);
  if (match?.[1] && !match[1].startsWith("<")) return match[1];

  throw new Error("KV_NAMESPACE_ID が未設定です。wrangler.jsonc の LINKS id を確定するか環境変数を設定してください");
}

function validate(entries: LinkRecord[]): void {
  for (const entry of entries) {
    if (!entry.url.startsWith("https://")) {
      throw new Error(`https のみ許可: ${entry.slug}`);
    }
    if (!/^[a-z0-9-]+$/.test(entry.slug)) {
      throw new Error(`不正な slug: ${entry.slug}`);
    }
    if (!entry.fallbackPath.startsWith("/")) {
      throw new Error(`fallbackPath は自サイト内パスである必要があります: ${entry.slug}`);
    }
  }
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const entries = JSON.parse(readFileSync(LINKS_PATH, "utf-8")) as LinkRecord[];
  validate(entries);

  for (const entry of entries) {
    console.log(`✓ link:${entry.slug} → ${entry.url} (active: ${entry.active})`);
  }

  if (dryRun) {
    console.log(`\n${entries.length} 件の検証完了（--dry-run のため KV 同期はスキップ）`);
    return;
  }

  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.log("\nCLOUDFLARE_API_TOKEN 未設定のため KV 同期をスキップします");
    return;
  }

  const bulk = entries.map((e) => ({
    key: `link:${e.slug}`,
    value: JSON.stringify({
      url: e.url,
      asp: e.asp,
      subIdParam: e.subIdParam,
      label: e.label,
      active: e.active,
      fallbackPath: e.fallbackPath,
      note: e.note,
      updatedAt: e.updatedAt,
    }),
  }));

  const tmpDir = mkdtempSync(join(tmpdir(), "kv-bulk-"));
  const bulkPath = join(tmpDir, "bulk.json");
  writeFileSync(bulkPath, JSON.stringify(bulk));

  const namespaceId = getKvNamespaceId();
  console.log(`\nKV namespace ${namespaceId} に ${bulk.length} 件を同期中...`);

  execSync(
    `npx wrangler kv bulk put "${bulkPath}" --namespace-id "${namespaceId}"`,
    { stdio: "inherit", env: process.env },
  );

  console.log("KV 同期完了");
}

main();
