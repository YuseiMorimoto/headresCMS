import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type LinkRecord = {
  slug: string;
  url: string;
  active: boolean;
};

export type OfferCheckResult = {
  slug: string;
  url: string;
  ok: boolean;
  status: number;
  error?: string;
};

const LINKS_PATH = join(process.cwd(), "data/links.json");

async function checkUrl(url: string): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    let res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: "GET", redirect: "follow" });
    }
    const ok = res.ok && res.status !== 404 && res.status !== 410;
    return { ok, status: res.status };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "接続失敗",
    };
  }
}

export async function checkAllOffers(): Promise<OfferCheckResult[]> {
  const entries = JSON.parse(readFileSync(LINKS_PATH, "utf-8")) as LinkRecord[];
  const results: OfferCheckResult[] = [];

  for (const entry of entries) {
    if (!entry.active) {
      results.push({ slug: entry.slug, url: entry.url, ok: true, status: 0 });
      continue;
    }
    const result = await checkUrl(entry.url);
    results.push({
      slug: entry.slug,
      url: entry.url,
      ok: result.ok,
      status: result.status,
      error: result.error,
    });
  }

  return results;
}

async function main() {
  const jsonOutput = process.argv.includes("--json");
  const results = await checkAllOffers();
  const failures = results.filter((r) => r.status !== 0 && !r.ok);

  if (jsonOutput) {
    const outPath = process.env.OFFER_CHECK_OUTPUT ?? join(process.cwd(), "offer-check-results.json");
    writeFileSync(outPath, JSON.stringify({ failures, results }, null, 2));
    console.log(`Wrote ${outPath}`);
  } else {
    for (const r of results) {
      if (r.status === 0 && r.ok) {
        console.log(`⊘ ${r.slug}: inactive (スキップ)`);
      } else if (r.ok) {
        console.log(`✓ ${r.slug}: ${r.status}`);
      } else {
        console.log(`✗ ${r.slug}: ${r.status || r.error}`);
      }
    }
  }

  if (failures.length > 0) {
    process.exit(1);
  }
}

main();
