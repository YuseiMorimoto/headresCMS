import { readdir, readFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import type { Loader } from "astro/loaders";
import matter from "gray-matter";

// Markdown フォールバック loader。
// content/{endpoint}/**/*.md を読み、frontmatter + 本文を Content Layer に投入する。
// 本文（Markdown 文字列）は body フィールドに入れ、CMS の rich body と同じ扱いにする。
// これにより export.yml の出力（frontmatter + Markdown）をそのままビルドできる。
export function localLoader(endpoint: string): Loader {
  const base = join(process.cwd(), "content", endpoint);

  return {
    name: "local-loader",
    load: async ({ store, parseData, generateDigest, logger }) => {
      store.clear();

      let entries: string[];
      try {
        const dirents = await readdir(base, {
          recursive: true,
          withFileTypes: true,
        });
        entries = dirents
          .filter((d) => d.isFile() && d.name.endsWith(".md"))
          .map((d) => join(d.parentPath, d.name));
      } catch (err) {
        // ディレクトリが無い場合は空扱い。取得エラーはビルドを止める。
        if ((err as NodeJS.ErrnoException).code === "ENOENT") {
          logger.warn(`content/${endpoint} が存在しません。記事0件でビルドします。`);
          return;
        }
        throw err;
      }

      for (const file of entries) {
        const raw = await readFile(file, "utf-8");
        const { data: frontmatter, content } = matter(raw);
        const rel = relative(base, file).split(sep).join("/");
        const id = String(frontmatter.id ?? rel.replace(/\.md$/, "").split("/").pop());

        const data = await parseData({
          id,
          data: { ...frontmatter, id, body: content.trim() },
        });

        store.set({
          id,
          data,
          digest: generateDigest(raw),
        });
      }
    },
  };
}
