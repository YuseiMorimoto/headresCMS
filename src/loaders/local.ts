import type { Loader } from "astro/loaders";
import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import matter from "gray-matter";

const POSTS_DIR = join(process.cwd(), "content/posts");

async function collectMarkdownFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectMarkdownFiles(fullPath)));
    } else if (entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

export function localLoader(_endpoint: string): Loader {
  return {
    name: "local-posts-loader",
    load: async ({ store, parseData, renderMarkdown }) => {
      const files = await collectMarkdownFiles(POSTS_DIR);

      for (const filePath of files) {
        const raw = await readFile(filePath, "utf-8");
        const { data, content } = matter(raw);
        const rel = relative(POSTS_DIR, filePath).replaceAll(sep, "/");
        const id = (data.id as string | undefined) ?? rel.replace(/\.md$/, "").split("/").pop()!;

        const entry = {
          id,
          ...data,
          body: content.trim(),
        };

        const parsed = await parseData({ id, data: entry });
        store.set({
          id,
          data: parsed,
          rendered: await renderMarkdown(content),
        });
      }
    },
  };
}
