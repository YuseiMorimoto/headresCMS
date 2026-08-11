import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

// data/links.json を Workers KV（link:{slug}）へ一括反映する。
// 投入時に url が https であることを検証する。KV を管理画面から手編集しない。
// 実行例: npm run sync-links -- --remote   （--remote 省略時はローカル KV）

type LinkRecord = {
  url: string;
  asp: string;
  subIdParam: string | null;
  label: string;
  active: boolean;
  fallbackPath: string;
  note?: string;
  updatedAt?: string;
};

const ROOT = process.cwd();
const SRC = join(ROOT, "data", "links.json");

async function main(): Promise<void> {
  const remote = process.argv.includes("--remote");
  const links = JSON.parse(await readFile(SRC, "utf-8")) as Record<string, LinkRecord>;

  for (const [slug, record] of Object.entries(links)) {
    if (!/^[a-z0-9-]{1,64}$/.test(slug)) {
      throw new Error(`不正な offerSlug: ${slug}`);
    }
    if (!record.url.startsWith("https://")) {
      throw new Error(`url は https のみ許可されます: ${slug} → ${record.url}`);
    }

    const args = [
      "wrangler",
      "kv",
      "key",
      "put",
      `link:${slug}`,
      JSON.stringify(record),
      "--binding=LINKS",
      remote ? "--remote" : "--local",
    ];
    execFileSync("npx", args, { stdio: "inherit" });
    console.log(`[sync-links] link:${slug} を反映しました。`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
