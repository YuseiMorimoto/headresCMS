import type { Post } from "./content";
import { SITE } from "../config/site";

type Crumb = { name: string; url: string };

// 記事詳細ページの JSON-LD（Article + BreadcrumbList）を生成する。
// Product / Review は出力しない（自社商品ではないため）。
export function articleJsonLd(post: Post, canonical: string) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.data.title,
    description: post.data.description,
    datePublished: post.data.publishedAt.toISOString(),
    dateModified: post.data.updatedAt.toISOString(),
    author: { "@type": "Organization", name: SITE.author },
    publisher: { "@type": "Organization", name: SITE.name },
    mainEntityOfPage: canonical,
  };
  if (post.data.heroImage) data.image = post.data.heroImage.url;
  return data;
}

export function breadcrumbJsonLd(crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}
