import { readFileSync } from "node:fs";
import { join } from "node:path";

type LinkRecord = {
  slug: string;
  url: string;
  active: boolean;
};

const LINKS_PATH = join(process.cwd(), "data/links.json");

async function checkUrl(url: string): Promise<{ ok: boolean; status: number }> {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    return { ok: res.ok || res.status < 400, status: res.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

async function main() {
  const entries = JSON.parse(readFileSync(LINKS_PATH, "utf-8")) as LinkRecord[];
  let failed = 0;

  for (const entry of entries) {
    if (!entry.active) {
      console.log(`⊘ ${entry.slug}: inactive (スキップ)`);
      continue;
    }
    const result = await checkUrl(entry.url);
    if (result.ok) {
      console.log(`✓ ${entry.slug}: ${result.status}`);
    } else {
      console.log(`✗ ${entry.slug}: ${result.status || "接続失敗"}`);
      failed++;
    }
  }

  if (failed > 0) {
    process.exit(1);
  }
}

main();
