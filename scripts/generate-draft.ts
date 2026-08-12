import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { loadLocalPosts, slugify } from "./lib/load-posts.ts";

const FIRSTHAND_PLACEHOLDER = `【要記入】編集者が実測値・独自比較・使用経験などの一次情報をここに記入してください。公開前に必ず置き換えてください。AIが生成できない情報のみを記載します。`;

type DraftInput = {
  title: string;
  targetKeywords: string[];
  articleType: "comparison" | "review" | "guide";
  cluster: string;
  referenceUrl?: string;
};

function parseArgs(): DraftInput {
  const args = process.argv.slice(2);
  const get = (flag: string) => {
    const idx = args.indexOf(flag);
    return idx >= 0 ? args[idx + 1] : undefined;
  };

  const title = get("--title") ?? process.env.DRAFT_TITLE;
  const keywordsRaw = get("--keywords") ?? process.env.DRAFT_KEYWORDS;
  const articleType = (get("--type") ?? process.env.DRAFT_TYPE) as DraftInput["articleType"] | undefined;
  const cluster = get("--cluster") ?? process.env.DRAFT_CLUSTER;
  const referenceUrl = get("--reference-url") ?? process.env.DRAFT_REFERENCE_URL;

  if (!title || !keywordsRaw || !articleType || !cluster) {
    throw new Error(
      "Usage: generate-draft --title '...' --keywords 'kw1,kw2' --type comparison|review|guide --cluster example-a [--reference-url URL]",
    );
  }

  if (!["comparison", "review", "guide"].includes(articleType)) {
    throw new Error("articleType must be comparison, review, or guide");
  }

  return {
    title,
    targetKeywords: keywordsRaw.split(",").map((k) => k.trim()).filter(Boolean),
    articleType,
    cluster,
    referenceUrl,
  };
}

function loadTemplate(articleType: string): string {
  const doc = readFileSync(join(process.cwd(), "docs/05-content-templates.md"), "utf-8");
  const sectionRe = new RegExp(`## ${articleType}[^#]+`, "s");
  const match = doc.match(sectionRe);
  return match?.[0] ?? doc;
}

function buildPrompt(input: DraftInput, existingTitles: string[]): string {
  const template = loadTemplate(input.articleType);
  return `あなたはアフィリエイトメディアの記事ライターです。以下の仕様に従い、Markdown形式の記事本文を生成してください。

## 記事情報
- タイトル: ${input.title}
- キーワード: ${input.targetKeywords.join(", ")}
- 記事タイプ: ${input.articleType}
- クラスタ: ${input.cluster}
${input.referenceUrl ? `- 参考URL: ${input.referenceUrl}` : ""}

## 同一クラスタの既存記事（重複を避けること）
${existingTitles.map((t) => `- ${t}`).join("\n") || "_なし_"}

## テンプレート構造（この見出し構成に従うこと）
${template}

## 制約
- 日本語で3,000〜6,000字
- 段落は3文以内
- アフィリエイトの遷移先URLを本文に直接書かない（/go/{slug} 形式のみ。slugは仮で offer-placeholder を使う）
- 薬機法・景表法に触れる断定表現を避ける
- firsthand セクションの本文は生成しない（フロントマターに別途プレースホルダを入れる）
- 出力は frontmatter なしの Markdown 本文のみ（見出しは ## から開始）
- 比較記事の場合は比較表を Markdown テーブルで記載`;
}

async function generateBody(prompt: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY が設定されていません");

  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const text = message.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("生成結果が空です");
  return text.text.trim();
}

function buildMarkdown(input: DraftInput, body: string): { slug: string; content: string; path: string } {
  const slug = slugify(input.title);
  const now = new Date().toISOString();
  const frontmatter = {
    id: slug,
    title: input.title,
    description: `${input.title}について詳しく解説します。${input.targetKeywords[0] ?? ""}の選び方や注意点をわかりやすくまとめました。`.slice(0, 120),
    cluster: input.cluster,
    articleType: input.articleType,
    isPillar: false,
    targetKeywords: input.targetKeywords.slice(0, 3),
    publishedAt: now,
    updatedAt: now,
    offers: [],
    firsthand: FIRSTHAND_PLACEHOLDER,
    noindex: true,
  };

  const yaml = [
    "---",
    `id: ${frontmatter.id}`,
    `title: ${JSON.stringify(frontmatter.title)}`,
    `description: ${JSON.stringify(frontmatter.description)}`,
    `cluster: ${frontmatter.cluster}`,
    `articleType: ${frontmatter.articleType}`,
    `isPillar: false`,
    `targetKeywords: ${JSON.stringify(frontmatter.targetKeywords)}`,
    `publishedAt: ${frontmatter.publishedAt}`,
    `updatedAt: ${frontmatter.updatedAt}`,
    `offers: []`,
    `firsthand: |`,
    ...frontmatter.firsthand.split("\n").map((line) => `  ${line}`),
    `noindex: true`,
    "---",
    "",
    body,
  ].join("\n");

  const path = join(process.cwd(), "content/posts", input.cluster, `${slug}.md`);
  return { slug, content: yaml, path };
}

async function postToMicroCms(input: DraftInput, body: string, slug: string): Promise<string> {
  const domain = process.env.MICROCMS_SERVICE_DOMAIN;
  const apiKey = process.env.MICROCMS_API_KEY;
  if (!domain || !apiKey) {
    throw new Error("MICROCMS_SERVICE_DOMAIN と MICROCMS_API_KEY が必要です");
  }

  const res = await fetch(`https://${domain}/api/v1/posts`, {
    method: "POST",
    headers: {
      "X-MICROCMS-API-KEY": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: slug,
      title: input.title,
      description: `${input.title}について詳しく解説します。`.slice(0, 120),
      cluster: input.cluster,
      articleType: input.articleType,
      isPillar: false,
      targetKeywords: input.targetKeywords.join(","),
      body,
      firsthand: "",
      noindex: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`microCMS POST failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as { id: string };
  return `https://${domain}/posts/${json.id}`;
}

async function main() {
  const input = parseArgs();
  const source = process.env.CONTENT_SOURCE ?? "local";
  const posts = loadLocalPosts().filter((p) => p.cluster === input.cluster);
  const existingTitles = posts.map((p) => p.title);

  const prompt = buildPrompt(input, existingTitles);
  const body = await generateBody(prompt);
  const { slug, content, path } = buildMarkdown(input, body);

  if (source === "microcms") {
    const url = await postToMicroCms(input, body, slug);
    console.log(`MICROCMS_DRAFT_URL=${url}`);
    writeFileSync(join(process.cwd(), "draft-output.txt"), url);
    return;
  }

  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, content);
  console.log(`DRAFT_PATH=${path}`);
  console.log(`DRAFT_SLUG=${slug}`);
  writeFileSync(join(process.cwd(), "draft-output.txt"), path);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
