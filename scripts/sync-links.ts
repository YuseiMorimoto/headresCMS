import { readFileSync } from "node:fs";
import { join } from "node:path";

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

function main() {
  const entries = JSON.parse(readFileSync(LINKS_PATH, "utf-8")) as LinkRecord[];

  for (const entry of entries) {
    if (!entry.url.startsWith("https://")) {
      throw new Error(`https のみ許可: ${entry.slug}`);
    }
    if (!/^[a-z0-9-]+$/.test(entry.slug)) {
      throw new Error(`不正な slug: ${entry.slug}`);
    }
    console.log(`✓ link:${entry.slug} → ${entry.url}`);
  }

  if (!process.env.CLOUDFLARE_API_TOKEN) {
    console.log("\nCLOUDFLARE_API_TOKEN 未設定のため KV 同期をスキップします");
    console.log("本番では wrangler kv bulk put を使用してください");
    return;
  }

  const kvData = entries.map((e) => ({
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

  console.log(`\n${kvData.length} 件のリンクを KV に同期する準備ができました`);
}

main();
