import type { Loader } from "astro/loaders";

type MicroCmsPost = {
  id: string;
  title: string;
  description: string;
  cluster: string;
  articleType: "comparison" | "review" | "guide";
  isPillar?: boolean;
  targetKeywords: string;
  publishedAt: string;
  updatedAt: string;
  heroImageUrl?: string;
  heroImageAlt?: string;
  body: string;
  offers?: Array<{ slug: string; label: string; context?: string }>;
  firsthand: string;
  noindex?: boolean;
};

type MicroCmsListResponse = {
  contents: MicroCmsPost[];
  totalCount: number;
  offset: number;
  limit: number;
};

async function fetchAllPosts(domain: string, apiKey: string): Promise<MicroCmsPost[]> {
  const all: MicroCmsPost[] = [];
  const limit = 100;
  let offset = 0;
  let total = Infinity;

  while (offset < total) {
    const url = new URL(`https://${domain}/api/v1/posts`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("filters", "publishedAt[exists]");

    const res = await fetch(url, {
      headers: { "X-MICROCMS-API-KEY": apiKey },
    });

    if (!res.ok) {
      throw new Error(`microCMS API error: ${res.status} ${res.statusText}`);
    }

    const json = (await res.json()) as MicroCmsListResponse;
    total = json.totalCount;
    all.push(...json.contents);
    offset += limit;
  }

  return all;
}

export function microcmsLoader(_endpoint: string): Loader {
  return {
    name: "microcms-posts-loader",
    load: async ({ store, parseData }) => {
      const domain = process.env.MICROCMS_SERVICE_DOMAIN ?? import.meta.env.MICROCMS_SERVICE_DOMAIN;
      const apiKey = process.env.MICROCMS_API_KEY ?? import.meta.env.MICROCMS_API_KEY;

      if (!domain || !apiKey) {
        throw new Error(
          "MICROCMS_SERVICE_DOMAIN と MICROCMS_API_KEY が設定されていません",
        );
      }

      const posts = await fetchAllPosts(domain, apiKey);

      for (const post of posts) {
        const heroImage =
          post.heroImageUrl && post.heroImageAlt
            ? {
                url: post.heroImageUrl,
                width: 1200,
                height: 630,
                alt: post.heroImageAlt,
              }
            : undefined;

        const entry = {
          id: post.id,
          title: post.title,
          description: post.description,
          cluster: post.cluster,
          articleType: post.articleType,
          isPillar: post.isPillar ?? false,
          targetKeywords: post.targetKeywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean),
          publishedAt: post.publishedAt,
          updatedAt: post.updatedAt,
          heroImage,
          body: post.body,
          offers: post.offers ?? [],
          firsthand: post.firsthand,
          noindex: post.noindex ?? false,
        };

        const parsed = await parseData({ id: post.id, data: entry });
        store.set({
          id: post.id,
          data: parsed,
          rendered: {
            html: post.body,
          },
        });
      }
    },
  };
}
