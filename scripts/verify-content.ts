import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import matter from "gray-matter";
import {
  PRODUCTION_IMAGE_BASE,
  PRODUCTION_SITE_URL,
  resolveUrl,
} from "../src/config/domain.ts";

const POSTS_DIR = join(process.cwd(), "content/posts");
const LINKS_PATH = join(process.cwd(), "data/links.json");
const DIST_DIR = join(process.cwd(), "dist/client");

const IMAGE_BASE = resolveUrl(process.env.PUBLIC_IMAGE_BASE, PRODUCTION_IMAGE_BASE);
const SITE_URL = resolveUrl(process.env.PUBLIC_SITE_URL, PRODUCTION_SITE_URL);

const AFFILIATE_HOST_PATTERNS = [
  /a8\.net/i,
  /moshimo\.com/i,
  /valuecommerce\.com/i,
  /afb\.jp/i,
  /accesstrade\.net/i,
  /amazon\.co\.jp/i,
  /rakuten\.co\.jp/i,
  /px\.a8\.net/i,
  /al\.linksynergy\.com/i,
];

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

function collectHtmlFiles(dir: string): string[] {
  const files: string[] = [];
  if (!statSync(dir, { throwIfNoEntry: false })) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...collectHtmlFiles(full));
    } else if (entry.endsWith(".html")) {
      files.push(full);
    }
  }
  return files;
}

function loadOfferSlugs(): Set<string> {
  const entries = JSON.parse(readFileSync(LINKS_PATH, "utf-8")) as Array<{ slug: string }>;
  return new Set(entries.map((e) => e.slug));
}

function isAllowedUrl(url: string): boolean {
  if (url.startsWith("/")) return true;
  if (url.startsWith(IMAGE_BASE)) return true;
  if (url.startsWith(SITE_URL)) return true;
  return false;
}

export function verifyMarkdownContent(): string[] {
  const errors: string[] = [];
  const offerSlugs = loadOfferSlugs();

  for (const file of collectMarkdownFiles(POSTS_DIR)) {
    const raw = readFileSync(file, "utf-8");
    const { data, content } = matter(raw);
    const rel = relative(process.cwd(), file);

    const urlMatches = content.matchAll(/https?:\/\/[^\s)"'<>]+/g);
    for (const match of urlMatches) {
      const url = match[0]!;
      if (isAllowedUrl(url)) continue;
      if (AFFILIATE_HOST_PATTERNS.some((p) => p.test(url))) {
        errors.push(`${rel}: アフィリエイトURLが本文にハードコードされています → ${url}`);
      }
    }

    const offers = (data.offers as Array<{ slug: string }> | undefined) ?? [];
    for (const offer of offers) {
      if (!offerSlugs.has(offer.slug)) {
        errors.push(`${rel}: offers.slug "${offer.slug}" が data/links.json に存在しません`);
      }
    }

    const firsthand = (data.firsthand as string | undefined) ?? "";
    if (firsthand.length < 50) {
      errors.push(`${rel}: firsthand が50文字未満です`);
    }
  }

  return errors;
}

export function verifyBuiltHtml(): string[] {
  const errors: string[] = [];
  const prNotice = "※本記事にはアフィリエイトリンクを含みます";
  const articlePages = collectHtmlFiles(join(DIST_DIR, "c"));

  for (const file of articlePages) {
    const html = readFileSync(file, "utf-8");
    const rel = relative(process.cwd(), file);

    if (!html.includes(prNotice)) {
      errors.push(`${rel}: PR表記が見つかりません`);
    }

    const goLinkTags = html.match(/<a[^>]*href="\/go\/[^"]*"[^>]*>/g) ?? [];
    for (const tag of goLinkTags) {
      if (!tag.includes("sponsored") || !tag.includes("nofollow")) {
        errors.push(`${rel}: /go/ リンクに rel="sponsored nofollow noopener" がありません`);
        break;
      }
    }

    for (const pattern of AFFILIATE_HOST_PATTERNS) {
      if (pattern.test(html)) {
        errors.push(`${rel}: ビルド済みHTMLにアフィリエイト直リンクの痕跡があります`);
        break;
      }
    }
  }

  return errors;
}

function main() {
  const markdownErrors = verifyMarkdownContent();
  const htmlErrors = verifyBuiltHtml();
  const all = [...markdownErrors, ...htmlErrors];

  if (all.length > 0) {
    console.error("コンテンツ検証エラー:");
    for (const e of all) console.error(`  ✗ ${e}`);
    process.exit(1);
  }

  console.log("✓ コンテンツ検証: 問題なし");
}

main();
