/**
 * W6: microCMS の全公開記事を frontmatter 付き Markdown としてエクスポートする。
 *
 * CMS ロックイン解除の保険。出力はそのまま `CONTENT_SOURCE=local npm run build`
 * が通る形式にする（docs/04 W6）。テーブルは Markdown 化せず HTML のまま残す。
 */
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import matter from "gray-matter";
import TurndownService from "turndown";

type MicroCmsPost = {
  id: string;
  title: string;
  description: string;
  cluster: string;
  articleType: "comparison" | "review" | "guide";
  isPillar?: boolean;
  targetKeywords: string;
  publishedAt: string;
  updatedAt: string;
  heroImageUrl?: string;
  heroImageAlt?: string;
  body: string;
  offers?: Array<{ slug: string; label: string; context?: string }>;
  firsthand: string;
  noindex?: boolean;
};

type MicroCmsListResponse = {
  contents: MicroCmsPost[];
  totalCount: number;
};

// CMS 由来の値をファイルパスに使うため、パストラバーサルを構造的に防ぐ
const PATH_SEGMENT_RE = /^[a-z0-9-]+$/;

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
});
// 表は Markdown で表現しきれないため HTML のまま保持する（docs/06 T11）
turndown.keep(["table"]);

export function htmlToMarkdown(html: string): string {
  return turndown.turndown(html);
}

export function postToFile(post: MicroCmsPost): { relPath: string; content: string } {
  if (!PATH_SEGMENT_RE.test(post.cluster) || !PATH_SEGMENT_RE.test(post.id)) {
    throw new Error(`不正な cluster / id: ${post.cluster}/${post.id}`);
  }

  const frontmatter: Record<string, unknown> = {
    id: post.id,
    title: post.title,
    description: post.description,
    cluster: post.cluster,
    articleType: post.articleType,
    isPillar: post.isPillar ?? false,
    targetKeywords: post.targetKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
  };

  if (post.heroImageUrl && post.heroImageAlt) {
    frontmatter.heroImage = {
      url: post.heroImageUrl,
      width: 1200,
      height: 630,
      alt: post.heroImageAlt,
    };
  }

  frontmatter.offers = post.offers ?? [];
  frontmatter.firsthand = post.firsthand;
  frontmatter.noindex = post.noindex ?? false;

  const markdown = htmlToMarkdown(post.body).trim();
  const content = matter.stringify(`\n${markdown}\n`, frontmatter);

  return { relPath: join(post.cluster, `${post.id}.md`), content };
}

export function exportPosts(
  posts: MicroCmsPost[],
  postsDir: string,
): { written: string[]; unchanged: string[] } {
  const written: string[] = [];
  const unchanged: string[] = [];

  for (const post of posts) {
    const { relPath, content } = postToFile(post);
    const fullPath = join(postsDir, relPath);

    if (existsSync(fullPath) && readFileSync(fullPath, "utf-8") === content) {
      unchanged.push(relPath);
      continue;
    }

    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, content);
    written.push(relPath);
  }

  return { written, unchanged };
}

async function fetchAllPosts(domain: string, apiKey: string): Promise<MicroCmsPost[]> {
  const all: MicroCmsPost[] = [];
  const limit = 100;
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = new URL(`https://${domain}/api/v1/posts`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("filters", "publishedAt[exists]");

    const res = await fetch(url, { headers: { "X-MICROCMS-API-KEY": apiKey } });
    if (!res.ok) {
      throw new Error(`microCMS API error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as MicroCmsListResponse;
    total = json.totalCount;
    all.push(...json.contents);
    offset += limit;
  }

  return all;
}

async function main() {
  const domain = process.env.MICROCMS_SERVICE_DOMAIN;
  const apiKey = process.env.MICROCMS_API_KEY;
  if (!domain || !apiKey) {
    throw new Error("MICROCMS_SERVICE_DOMAIN と MICROCMS_API_KEY が必要です");
  }

  const posts = await fetchAllPosts(domain, apiKey);
  const postsDir = join(process.cwd(), "content/posts");
  const { written, unchanged } = exportPosts(posts, postsDir);

  for (const p of written) console.log(`書き出し: ${p}`);
  console.log(
    `エクスポート完了: ${posts.length} 件（更新 ${written.length} / 変更なし ${unchanged.length}）`,
  );
}

// テストから関数を import できるよう、直接実行時のみ main を走らせる
if (process.argv[1]?.endsWith("export-content.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
