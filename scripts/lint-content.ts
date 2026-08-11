import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";

const POSTS_DIR = join(process.cwd(), "content/posts");

const NG_PATTERNS = [
  { pattern: /必ず(治る|効く|痩せる)/, label: "薬機法: 効能の断定" },
  { pattern: /100%|日本一|世界一/, label: "景表法: 根拠のない最上級" },
  { pattern: /今だけ|先着\d+名/, label: "景表法: 煽り表現" },
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
