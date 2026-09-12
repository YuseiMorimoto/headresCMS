import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { NG_PATTERNS } from "../src/ops/review.ts";

const POSTS_DIR = join(process.cwd(), "content/posts");

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
  const warnings: string[] = [];

  for (const file of collectMarkdownFiles(POSTS_DIR)) {
    const raw = readFileSync(file, "utf-8");
    const { data, content } = matter(raw);
    const text = `${data.title ?? ""} ${content}`;

    for (const { pattern, label } of NG_PATTERNS) {
      if (pattern.test(text)) {
        warnings.push(`${file}: ${label} (${pattern})`);
      }
    }
  }

  if (warnings.length > 0) {
    console.log("⚠ NGワード検査で警告:");
    for (const w of warnings) console.log(`  ${w}`);
  } else {
    console.log("✓ NGワード検査: 警告なし");
  }
}

main();
