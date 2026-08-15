import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { CLUSTERS } from "../src/config/clusters.ts";
import {
  PRODUCTION_IMAGE_BASE,
  PRODUCTION_SITE_URL,
  resolveUrl,
} from "../src/config/domain.ts";
import { verifyBuiltHtml, verifyMarkdownContent } from "./verify-content.ts";

const strict = process.argv.includes("--strict");

type CheckResult = { name: string; ok: boolean; message: string };

const results: CheckResult[] = [];

function check(name: string, ok: boolean, message: string) {
  results.push({ name, ok, message });
  console.log(`${ok ? "✓" : "✗"} ${name}: ${message}`);
}

function checkPhase0(): void {
  const hasDummyClusters = CLUSTERS.some((c) => c.id.startsWith("example-"));
  if (hasDummyClusters) {
    check(
      "Phase 0: クラスタ定義",
      !strict,
      strict
        ? "ダミークラスタ (example-*) が残っています。src/config/clusters.ts を本番用に差し替えてください"
        : "警告: ダミークラスタが残っています（--strict で失敗）",
    );
  } else if (CLUSTERS.length < 12) {
    check(
      "Phase 0: クラスタ数",
      !strict,
      `クラスタが ${CLUSTERS.length} 件です（目標: 12〜15件）`,
    );
  } else {
    check("Phase 0: クラスタ定義", true, `${CLUSTERS.length} クラスタ定義済み`);
  }

  const links = JSON.parse(readFileSync(join(process.cwd(), "data/links.json"), "utf-8")) as Array<{
    slug: string;
    url: string;
  }>;
  const hasDummyLinks = links.some((l) => l.url.includes("example.com/track"));
  if (hasDummyLinks) {
    check(
      "Phase 0: 案件定義",
      !strict,
      strict
        ? "ダミー案件URL (example.com) が残っています"
        : "警告: ダミー案件URLが残っています",
    );
  } else {
    check("Phase 0: 案件定義", true, `${links.length} 件の案件定義`);
  }

  const siteTs = readFileSync(join(process.cwd(), "src/config/site.ts"), "utf-8");
  if (siteTs.includes("サンプルアフィリエイトメディア")) {
    check(
      "Phase 0: サイト名",
      !strict,
      strict ? "サイト名がサンプルのままです" : "警告: サイト名がサンプルのままです",
    );
  } else {
    check("Phase 0: サイト名", true, "サイト名が設定されています");
  }

  const contactUrl = siteTs.match(/contactFormUrl: "([^"]+)"/)?.[1];
  if (contactUrl?.includes("example")) {
    check(
      "Phase 0: お問い合わせフォーム",
      !strict,
      strict ? "GoogleフォームURLがプレースホルダのままです" : "警告: フォームURLがプレースホルダです",
    );
  } else {
    check("Phase 0: お問い合わせフォーム", true, "フォームURLが設定されています");
  }
}

/**
 * 環境変数が未設定でも src/config/domain.ts の本番既定値に解決されるため、
 * 「設定されているか」ではなく「解決結果が本番URLとして妥当か」を検証する。
 */
function checkEnv(): void {
  const siteUrl = resolveUrl(process.env.PUBLIC_SITE_URL, PRODUCTION_SITE_URL);
  const siteOk = siteUrl.startsWith("https://") && !siteUrl.includes("example.com");
  check("サイトURL", siteOk, siteOk ? siteUrl : `本番URLとして不正です: ${siteUrl}`);

  const imageBase = resolveUrl(process.env.PUBLIC_IMAGE_BASE, PRODUCTION_IMAGE_BASE);
  const imageOk = imageBase.startsWith("https://") && !imageBase.includes("example.com");
  check("画像ベースURL", imageOk, imageOk ? imageBase : `本番URLとして不正です: ${imageBase}`);
}

function checkRobots(): void {
  const robots = readFileSync(join(process.cwd(), "public/robots.txt"), "utf-8");
  const siteUrl = resolveUrl(process.env.PUBLIC_SITE_URL, PRODUCTION_SITE_URL);

  const ok =
    robots.includes("Disallow: /go/") &&
    robots.includes("Disallow: /preview/") &&
    robots.includes(`Sitemap: ${siteUrl}/sitemap-index.xml`);

  check("robots.txt", ok, ok ? "設定OK" : "Sitemap URL または Disallow が不正です");
}

function main() {
  console.log(`=== 公開前品質ゲート ${strict ? "(strict)" : ""} ===\n`);

  checkPhase0();
  checkEnv();
  checkRobots();

  const mdErrors = verifyMarkdownContent();
  check("コンテンツ: Markdown", mdErrors.length === 0, mdErrors.length === 0 ? "OK" : `${mdErrors.length} 件のエラー`);

  if (mdErrors.length > 0) {
    for (const e of mdErrors) console.error(`    ${e}`);
  }

  try {
    const distExists = readFileSync(join(process.cwd(), "dist/client/index.html"));
    if (distExists) {
      const htmlErrors = verifyBuiltHtml();
      check("コンテンツ: ビルド済みHTML", htmlErrors.length === 0, htmlErrors.length === 0 ? "OK" : `${htmlErrors.length} 件のエラー`);
      for (const e of htmlErrors) console.error(`    ${e}`);
    }
  } catch {
    check("コンテンツ: ビルド済みHTML", false, "dist/client が存在しません。先に npm run build を実行してください");
  }

  try {
    execSync("npx astro check", { stdio: "pipe", env: { ...process.env, CONTENT_SOURCE: "local" } });
    check("astro check", true, "エラーなし");
  } catch {
    check("astro check", false, "エラーがあります");
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== 結果: ${results.length - failed.length}/${results.length} 合格 ===`);

  if (failed.length > 0) {
    process.exit(1);
  }
}

main();
