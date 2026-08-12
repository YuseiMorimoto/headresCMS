import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";

type Redirect = {
  from: string;
  to: string;
  code: 301;
  reason?: string;
  date?: string;
};

const ROOT = process.cwd();
const REDIRECTS_PATH = join(ROOT, "data/redirects.json");
const OUTPUT_PATH = join(ROOT, "public/_redirects");
const POSTS_DIR = join(ROOT, "content/posts");

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectMarkdownFiles(full));
    } else if (entry.endsWith(".md")) {
      files.push(full);
    }
  }
  return files;
}

function getArticlePaths(): Set<string> {
  const paths = new Set<string>();
  if (!statSync(POSTS_DIR, { throwIfNoEntry: false })) return paths;

  const clusters = new Set<string>();
  for (const file of collectMarkdownFiles(POSTS_DIR)) {
    const raw = readFileSync(file, "utf-8");
    const { data } = matter(raw);
    const rel = relative(POSTS_DIR, file).replace(/\.md$/, "");
    const parts = rel.split("/");
    const cluster = (data.cluster as string) ?? parts[0];
    const id = (data.id as string) ?? parts[parts.length - 1];
    if (data.noindex) continue;
    paths.add(`/c/${cluster}/${id}/`);
    clusters.add(cluster);
  }
  for (const cluster of clusters) {
    paths.add(`/c/${cluster}/`);
  }
  return paths;
}

function loadRedirects(): Redirect[] {
  const raw = readFileSync(REDIRECTS_PATH, "utf-8");
  return JSON.parse(raw) as Redirect[];
}

function validateRedirects(redirects: Redirect[], articlePaths: Set<string>) {
  const fromSet = new Set<string>();

  for (const r of redirects) {
    if (r.from === r.to) {
      throw new Error(`リダイレクトの from と to が同一です: ${r.from}`);
    }
    if (fromSet.has(r.from)) {
      throw new Error(`重複する from パスがあります: ${r.from}`);
    }
    fromSet.add(r.from);

    if (articlePaths.has(r.from)) {
      throw new Error(`from が公開記事のパスと重複しています: ${r.from}`);
    }

    const toIsArticle = articlePaths.has(r.to);
    const toIsRedirectFrom = redirects.some((x) => x.from === r.to);
    if (!toIsArticle && toIsRedirectFrom) {
      throw new Error(`多段リダイレクトが検出されました: ${r.from} → ${r.to}`);
    }
  }
}

function main() {
  const redirects = loadRedirects();
  const articlePaths = getArticlePaths();
  validateRedirects(redirects, articlePaths);

  const lines = redirects.map((r) => `${r.from} ${r.to} ${r.code}`);
  writeFileSync(OUTPUT_PATH, lines.join("\n") + (lines.length ? "\n" : ""));
  console.log(`Generated ${OUTPUT_PATH} (${redirects.length} rules)`);
}

main();
