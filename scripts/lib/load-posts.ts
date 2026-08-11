import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";

const POSTS_DIR = join(process.cwd(), "content/posts");

export type LocalPost = {
  id: string;
  filePath: string;
  title: string;
  description: string;
  cluster: string;
  articleType: "comparison" | "review" | "guide";
  isPillar: boolean;
  targetKeywords: string[];
  publishedAt: string;
  updatedAt: string;
  offers: Array<{ slug: string; label: string; context?: string }>;
  firsthand: string;
  noindex: boolean;
  body: string;
};

function collectMarkdownFiles(dir: string): string[] {
  const files: string[] = [];
  if (!statSync(dir, { throwIfNoEntry: false })) return files;

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

export function loadLocalPosts(): LocalPost[] {
  const files = collectMarkdownFiles(POSTS_DIR);
  const posts: LocalPost[] = [];

  for (const filePath of files) {
    const raw = readFileSync(filePath, "utf-8");
    const { data, content } = matter(raw);
    const rel = relative(POSTS_DIR, filePath).replace(/\.md$/, "");
    const id = (data.id as string) ?? rel.split("/").pop()!;

    posts.push({
      id,
      filePath,
      title: data.title as string,
      description: data.description as string,
      cluster: data.cluster as string,
      articleType: data.articleType as LocalPost["articleType"],
      isPillar: Boolean(data.isPillar),
      targetKeywords: (data.targetKeywords as string[]) ?? [],
      publishedAt: String(data.publishedAt ?? ""),
      updatedAt: String(data.updatedAt ?? ""),
      offers: (data.offers as LocalPost["offers"]) ?? [],
      firsthand: (data.firsthand as string) ?? "",
      noindex: Boolean(data.noindex),
      body: content.trim(),
    });
  }

  return posts;
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u3040-\u30ff\u3400-\u9fff-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64) || "draft-article";
}
