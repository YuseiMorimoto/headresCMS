import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { loadLocalPosts } from "./lib/load-posts.ts";

type KeywordOverlap = {
  keyword: string;
  posts: Array<{ id: string; cluster: string; title: string; matchType: "exact" | "partial" }>;
};

type GscMultiUrl = {
  query: string;
  pages: Array<{ page: string; impressions: number; position: number }>;
};

type GscSnapshot = {
  rows: Array<{
    query?: string;
    page?: string;
    keys?: string[];
    impressions: number;
    position: number;
  }>;
};

const GSC_DIR = join(process.cwd(), "data/gsc");

function findKeywordOverlaps(): KeywordOverlap[] {
  const posts = loadLocalPosts();
  const keywordMap = new Map<string, KeywordOverlap["posts"]>();

  for (const post of posts) {
    for (const keyword of post.targetKeywords) {
      const normalized = keyword.trim().toLowerCase();
      if (!normalized) continue;
      const list = keywordMap.get(normalized) ?? [];
      list.push({ id: post.id, cluster: post.cluster, title: post.title, matchType: "exact" });
      keywordMap.set(normalized, list);
    }
  }

  const keywords = [...keywordMap.keys()];
  for (let i = 0; i < keywords.length; i++) {
    for (let j = i + 1; j < keywords.length; j++) {
      const a = keywords[i]!;
      const b = keywords[j]!;
      if (a.includes(b) || b.includes(a)) {
        const postsA = keywordMap.get(a) ?? [];
        const postsB = keywordMap.get(b) ?? [];
        const combined = [...postsA, ...postsB];
        const unique = [...new Map(combined.map((p) => [p.id, p])).values()];
        if (unique.length >= 2) {
          keywordMap.set(`${a} / ${b}`, unique.map((p) => ({ ...p, matchType: "partial" as const })));
        }
      }
    }
  }

  return [...keywordMap.entries()]
    .filter(([, posts]) => posts.length >= 2)
    .map(([keyword, posts]) => ({ keyword, posts }));
}

function findGscMultiUrl(): GscMultiUrl[] {
  mkdirSync(GSC_DIR, { recursive: true });
  const files = readdirSync(GSC_DIR).filter((f) => f.endsWith(".json")).sort().reverse();
  if (files.length === 0) return [];

  const snapshot = JSON.parse(
    readFileSync(join(GSC_DIR, files[0]!), "utf-8"),
  ) as GscSnapshot;

  const byQuery = new Map<string, GscMultiUrl["pages"]>();
  for (const row of snapshot.rows) {
    const query = row.query ?? row.keys?.[0];
    const page = row.page ?? row.keys?.[1];
    if (!query || !page) continue;
    const list = byQuery.get(query) ?? [];
    list.push({ page, impressions: row.impressions, position: row.position });
    byQuery.set(query, list);
  }

  return [...byQuery.entries()]
    .filter(([, pages]) => pages.length >= 2)
    .map(([query, pages]) => ({ query, pages: pages.sort((a, b) => b.impressions - a.impressions) }))
    .sort((a, b) => {
      const aImp = a.pages.reduce((s, p) => s + p.impressions, 0);
      const bImp = b.pages.reduce((s, p) => s + p.impressions, 0);
      return bImp - aImp;
    })
    .slice(0, 20);
}

function buildIssueBody(overlaps: KeywordOverlap[], multiUrl: GscMultiUrl[]): string {
  const lines = [
    "## キーワードカニバリゼーションレポート",
    "",
    "### targetKeywords の重複",
    "",
  ];

  if (overlaps.length === 0) {
    lines.push("_重複なし_", "");
  } else {
    for (const overlap of overlaps) {
      lines.push(`#### \`${overlap.keyword}\``, "");
      for (const post of overlap.posts) {
        lines.push(
          `- [ ] [${post.title}](/c/${post.cluster}/${post.id}/) (${post.matchType})`,
        );
      }
      lines.push("");
    }
  }

  lines.push("### GSC: 同一クエリで複数URLが表示", "");
  if (multiUrl.length === 0) {
    lines.push("_該当なし（GSCデータ未取得の場合は gsc-report 実行後に再確認）_", "");
  } else {
    for (const item of multiUrl) {
      lines.push(`#### \`${item.query}\``, "");
      for (const page of item.pages) {
        lines.push(
          `- ${page.page} (表示: ${page.impressions}, 順位: ${page.position.toFixed(1)})`,
        );
      }
      lines.push("");
    }
  }

  lines.push("> 統合候補として検討してください。記事統合時は `data/redirects.json` に301を追加してください。");
  return lines.join("\n");
}

function main() {
  const overlaps = findKeywordOverlaps();
  const multiUrl = findGscMultiUrl();
  const body = buildIssueBody(overlaps, multiUrl);

  const outPath = join(process.cwd(), "cannibalization-report.md");
  writeFileSync(outPath, body);
  console.log(`Wrote ${outPath}`);
  console.log(`Keyword overlaps: ${overlaps.length}, GSC multi-URL: ${multiUrl.length}`);
}

main();
