import type { CollectionEntry } from "astro:content";
import { site } from "@/config/site.ts";

export type BreadcrumbItem = {
  name: string;
  url: string;
};

export function articleUrl(cluster: string, slug: string): string {
  return new URL(`/c/${cluster}/${slug}/`, site.url).toString();
}

export function clusterUrl(clusterId: string): string {
  return new URL(`/c/${clusterId}/`, site.url).toString();
}

export function buildArticleJsonLd(post: CollectionEntry<"posts">) {
  const url = articleUrl(post.data.cluster, post.id);
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.data.title,
    description: post.data.description,
    datePublished: post.data.publishedAt.toISOString(),
    dateModified: post.data.updatedAt.toISOString(),
    author: {
      "@type": "Person",
      name: site.author.name,
      url: site.author.url,
    },
    publisher: {
      "@type": "Organization",
      name: site.name,
      url: site.url,
    },
    mainEntityOfPage: url,
    ...(post.data.heroImage
      ? {
          image: [post.data.heroImage.url],
        }
      : {}),
  };
}

export function buildBreadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
