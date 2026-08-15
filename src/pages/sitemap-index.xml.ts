import type { APIRoute } from "astro";
import { site } from "@/config/site.ts";

// @astrojs/sitemap はページパスしか参照できず noindex 記事を除外できないため、
// Content Collection の frontmatter を参照できる自前エンドポイントで生成する。
export const GET: APIRoute = () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${site.url}/sitemap-0.xml</loc>
  </sitemap>
</sitemapindex>
`;
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
