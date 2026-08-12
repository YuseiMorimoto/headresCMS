import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { JWT } from "google-auth-library";
import { loadLocalPosts } from "./lib/load-posts.ts";

type GscRow = {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

type GscQueryRow = GscRow & { query: string; page?: string };

type Classification = {
  category: "almost" | "ctr" | "uncovered" | "decline";
  query: string;
  page?: string;
  position: number;
  impressions: number;
  ctr: number;
  label: "rewrite" | "new-article";
  note: string;
};

type GscSnapshot = {
  date: string;
  siteUrl: string;
  period: { start: string; end: string };
  rows: GscQueryRow[];
};

const GSC_DIR = join(process.cwd(), "data/gsc");
const SITE_URL = process.env.PUBLIC_SITE_URL ?? "https://example.com";

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

async function getAccessToken(): Promise<string> {
  const raw = process.env.GSC_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error("GSC_SERVICE_ACCOUNT_JSON が設定されていません");
  }
  const credentials = JSON.parse(raw) as {
    client_email: string;
    private_key: string;
  };
  const client = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });
  const token = await client.getAccessToken();
  if (!token.token) throw new Error("GSC アクセストークンの取得に失敗しました");
  return token.token;
}

async function fetchGscData(
  token: string,
  startDate: string,
  endDate: string,
  dimensions: string[],
): Promise<GscRow[]> {
  const siteUrl = encodeURIComponent(SITE_URL);
  const res = await fetch(
    `https://www.googleapis.com/webmasters/v3/sites/${siteUrl}/searchAnalytics/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions,
        rowLimit: 25000,
      }),
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GSC API error: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { rows?: GscRow[] };
  return json.rows ?? [];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function classifyRows(
  queryRows: GscQueryRow[],
  pageRows: GscQueryRow[],
  previousQueryRows: GscQueryRow[],
): Classification[] {
  const results: Classification[] = [];
  const posts = loadLocalPosts();
  const allKeywords = posts.flatMap((p) => p.targetKeywords);

  const prevByQuery = new Map(
    previousQueryRows.map((r) => [r.query, r]),
  );

  const ctrByPositionBand = new Map<number, number[]>();
  for (const row of queryRows) {
    const band = Math.round(row.position);
    if (band >= 1 && band <= 10) {
      const arr = ctrByPositionBand.get(band) ?? [];
      arr.push(row.ctr);
      ctrByPositionBand.set(band, arr);
    }
  }

  for (const row of queryRows) {
    if (row.position >= 11 && row.position <= 30 && row.impressions >= 100) {
      results.push({
        category: "almost",
        query: row.query,
        page: row.page,
        position: row.position,
        impressions: row.impressions,
        ctr: row.ctr,
        label: "rewrite",
        note: "あと一歩: 11〜30位・表示100以上",
      });
    }

    if (row.position >= 1 && row.position <= 10) {
      const band = Math.round(row.position);
      const bandMedian = median(ctrByPositionBand.get(band) ?? []);
      if (bandMedian > 0 && row.ctr < bandMedian * 0.6) {
        results.push({
          category: "ctr",
          query: row.query,
          page: row.page,
          position: row.position,
          impressions: row.impressions,
          ctr: row.ctr,
          label: "rewrite",
          note: `CTR不足: 順位${band}位帯の中央値${(bandMedian * 100).toFixed(1)}%の60%未満`,
        });
      }
    }

    const covered = allKeywords.some(
      (kw) => kw === row.query || row.query.includes(kw) || kw.includes(row.query),
    );
    if (!covered && row.impressions >= 50) {
      results.push({
        category: "uncovered",
        query: row.query,
        page: row.page,
        position: row.position,
        impressions: row.impressions,
        ctr: row.ctr,
        label: "new-article",
        note: "未カバー: 対応記事が見つからないクエリ",
      });
    }

    const prev = prevByQuery.get(row.query);
    if (prev && prev.position - row.position >= 5) {
      results.push({
        category: "decline",
        query: row.query,
        page: row.page,
        position: row.position,
        impressions: row.impressions,
        ctr: row.ctr,
        label: "rewrite",
        note: `下落: 前28日比で順位が${(prev.position - row.position).toFixed(1)}位下落`,
      });
    }
  }

  const seen = new Set<string>();
  return results
    .filter((r) => {
      const key = `${r.category}:${r.query}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 20);
}

function findLatestSnapshot(beforeDate: string): GscSnapshot | null {
  mkdirSync(GSC_DIR, { recursive: true });
  const files = readdirSync(GSC_DIR)
    .filter((f) => f.endsWith(".json") && f < `${beforeDate}.json`)
    .sort()
    .reverse();
  if (files.length === 0) return null;
  return JSON.parse(readFileSync(join(GSC_DIR, files[0]!), "utf-8")) as GscSnapshot;
}

function buildIssueBody(classifications: Classification[], snapshotDate: string): string {
  const sections: Record<Classification["category"], string> = {
    almost: "あと一歩（11〜30位）",
    ctr: "CTR不足（1〜10位）",
    uncovered: "未カバー（新規記事候補）",
    decline: "下落（要調査）",
  };

  const lines = [
    "## GSC リライト候補レポート",
    "",
    `取得日: ${snapshotDate}`,
    `対象サイト: ${SITE_URL}`,
    "",
  ];

  for (const [category, title] of Object.entries(sections)) {
    const items = classifications.filter((c) => c.category === category);
    lines.push(`### ${title}`, "");
    if (items.length === 0) {
      lines.push("_該当なし_", "");
      continue;
    }
    for (const item of items) {
      lines.push(
        `- [ ] \`${item.query}\` — ${item.note} (順位: ${item.position.toFixed(1)}, 表示: ${item.impressions}, CTR: ${(item.ctr * 100).toFixed(1)}%)`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

async function main() {
  const issueOnly = process.argv.includes("--issue-only");
  const today = formatDate(new Date());
  const endDate = formatDate(daysAgo(3));
  const startDate = formatDate(daysAgo(30));
  const prevEndDate = formatDate(daysAgo(31));
  const prevStartDate = formatDate(daysAgo(58));

  const token = await getAccessToken();

  const [queryRows, pageQueryRows] = await Promise.all([
    fetchGscData(token, startDate, endDate, ["query"]),
    fetchGscData(token, startDate, endDate, ["query", "page"]),
  ]);

  const prevQueryRows = await fetchGscData(token, prevStartDate, prevEndDate, ["query"]);

  const normalizedQueryRows: GscQueryRow[] = queryRows.map((r) => ({
    ...r,
    query: r.keys[0]!,
  }));

  const normalizedPageRows: GscQueryRow[] = pageQueryRows.map((r) => ({
    ...r,
    query: r.keys[0]!,
    page: r.keys[1],
  }));

  const prevNormalized: GscQueryRow[] = prevQueryRows.map((r) => ({
    ...r,
    query: r.keys[0]!,
  }));

  const snapshot: GscSnapshot = {
    date: today,
    siteUrl: SITE_URL,
    period: { start: startDate, end: endDate },
    rows: normalizedPageRows,
  };

  mkdirSync(GSC_DIR, { recursive: true });
  const outPath = join(GSC_DIR, `${today}.json`);
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2));
  console.log(`Saved ${outPath}`);

  const previous = findLatestSnapshot(today);
  const prevRows = previous?.rows ?? prevNormalized;

  const classifications = classifyRows(
    normalizedQueryRows,
    normalizedPageRows,
    prevRows.map((r) => ({ ...r, query: r.query ?? r.keys?.[0] ?? "" })),
  );

  const issueBody = buildIssueBody(classifications, today);
  const issuePath = join(process.cwd(), "gsc-report-issue.md");
  writeFileSync(issuePath, issueBody);
  console.log(`Wrote ${issuePath}`);

  if (issueOnly) {
    console.log("Issue body ready for workflow");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
