import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { CLUSTERS } from "@/config/clusters.ts";
import { site, POSTS_PER_PAGE } from "@/config/site.ts";

type SitemapUrl = { loc: string; lastmod?: string };

export const GET: APIRoute = async () => {
  // noindex 記事は robots メタだけでなく sitemap からも除外する（docs/02 SEO要件）
  const posts = (await getCollection("posts", ({ data }) => !data.noindex)).sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );

  const totalPages = Math.ceil(posts.length / POSTS_PER_PAGE);

  const urls: SitemapUrl[] = [
    { loc: `${site.url}/` },
    { loc: `${site.url}/about/` },
    { loc: `${site.url}/privacy/` },
    { loc: `${site.url}/disclaimer/` },
    ...CLUSTERS.map((c) => ({ loc: `${site.url}/c/${c.id}/` })),
    ...Array.from({ length: totalPages }, (_, i) => ({
      loc: `${site.url}/page/${i + 1}/`,
    })),
    ...posts.map((p) => ({
      loc: `${site.url}/c/${p.data.cluster}/${p.id}/`,
      lastmod: p.data.updatedAt.toISOString(),
    })),
  ];

  const body = urls
    .map((u) => {
      const lastmod = u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : "";
      return `  <url><loc>${u.loc}</loc>${lastmod}</url>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${body}
</urlset>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
};
