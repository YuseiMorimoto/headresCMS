import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTION_SITE_URL, resolveUrl } from "../src/config/domain.ts";
import { isIndexable } from "../src/config/launch.ts";

const siteUrl = resolveUrl(process.env.PUBLIC_SITE_URL, PRODUCTION_SITE_URL);
const outputPath = join(process.cwd(), "public/robots.txt");
const indexable = isIndexable(process.env.PUBLIC_INDEXABLE);

// 公開前は全面的にクロールを禁止し、ダミー内容が新規ドメインに
// インデックスされるのを防ぐ。sitemap も出さない。
const content = indexable
  ? `User-agent: *
Allow: /
Disallow: /go/
Disallow: /preview/

Sitemap: ${siteUrl}/sitemap-index.xml
`
  : `# 公開前のためクロールを禁止しています。
# 公開する際は PUBLIC_INDEXABLE=true を設定してください。
User-agent: *
Disallow: /
`;

writeFileSync(outputPath, content);
console.log(
  `Generated ${outputPath} (${indexable ? `公開: Sitemap ${siteUrl}` : "非公開: Disallow: /"})`,
);
