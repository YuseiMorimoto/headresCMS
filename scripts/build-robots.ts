import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PRODUCTION_SITE_URL, resolveUrl } from "../src/config/domain.ts";

const siteUrl = resolveUrl(process.env.PUBLIC_SITE_URL, PRODUCTION_SITE_URL);
const outputPath = join(process.cwd(), "public/robots.txt");

const content = `User-agent: *
Allow: /
Disallow: /go/
Disallow: /preview/

Sitemap: ${siteUrl}/sitemap-index.xml
`;

writeFileSync(outputPath, content);
console.log(`Generated ${outputPath} (Sitemap: ${siteUrl})`);
