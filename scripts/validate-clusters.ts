import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";

const POSTS_DIR = join(process.cwd(), "content/posts");

const CLUSTERS = [
  { id: "example-a", pillarSlug: "example-a-pillar" },
  { id: "example-b", pillarSlug: "example-b-pillar" },
  { id: "example-c", pillarSlug: "example-c-pillar" },
];

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

function main() {
  if ((process.env.CONTENT_SOURCE ?? "local") !== "local") {
    console.log("クラスタ検証: microCMS モードのためスキップ");
    return;
  }

  if (!statSync(POSTS_DIR, { throwIfNoEntry: false })) return;

  const posts: Array<{ id: string; cluster: string; isPillar: boolean }> = [];

  for (const file of collectMarkdownFiles(POSTS_DIR)) {
    const { data } = matter(readFileSync(file, "utf-8"));
    const rel = relative(POSTS_DIR, file).replace(/\.md$/, "");
    const id = (data.id as string) ?? rel.split("/").pop()!;
    posts.push({
      id,
      cluster: data.cluster as string,
      isPillar: Boolean(data.isPillar),
    });
  }

  const clusterIds = new Set(CLUSTERS.map((c) => c.id));

  for (const post of posts) {
    if (!clusterIds.has(post.cluster)) {
      throw new Error(`記事 "${post.id}" の cluster "${post.cluster}" は CLUSTERS に存在しません`);
    }
  }

  for (const cluster of CLUSTERS) {
    const pillars = posts.filter((p) => p.cluster === cluster.id && p.isPillar);
    if (pillars.length !== 1) {
      throw new Error(
        `クラスタ "${cluster.id}" のピラー記事は1件である必要があります（現在: ${pillars.length}件）`,
      );
    }
    if (pillars[0]!.id !== cluster.pillarSlug) {
      throw new Error(`クラスタ "${cluster.id}" のピラー記事 id が pillarSlug と一致しません`);
    }
  }

  console.log(`クラスタ検証 OK (${posts.length} 記事)`);
}

main();
