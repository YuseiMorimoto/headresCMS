import { readFileSync } from "node:fs";

async function exportFromMicroCms() {
  const domain = process.env.MICROCMS_SERVICE_DOMAIN;
  const apiKey = process.env.MICROCMS_API_KEY;
  if (!domain || !apiKey) {
    throw new Error("MICROCMS_SERVICE_DOMAIN と MICROCMS_API_KEY が必要です");
  }

  const all: unknown[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const url = new URL(`https://${domain}/api/v1/posts`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));

    const res = await fetch(url, { headers: { "X-MICROCMS-API-KEY": apiKey } });
    if (!res.ok) throw new Error(`microCMS API error: ${res.status}`);
    const json = (await res.json()) as { contents: unknown[]; totalCount: number };
    all.push(...json.contents);
    offset += limit;
    if (offset >= json.totalCount) break;
  }

  return all;
}

function main() {
  const source = process.env.CONTENT_SOURCE ?? "local";

  if (source === "microcms") {
    exportFromMicroCms()
      .then((posts) => {
        console.log(`${posts.length} 件をエクスポート（microCMS）`);
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
    return;
  }

  const postsDir = new URL("../content/posts", import.meta.url);
  console.log(`ローカルコンテンツを確認: ${postsDir.pathname}`);
  console.log("ローカルモードではエクスポートは不要です");
}

main();
