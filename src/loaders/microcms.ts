import type { Loader } from "astro/loaders";

type MicroCmsPost = {
  id: string;
  title: string;
  description: string;
  cluster: string;
  articleType: string;
  isPillar?: boolean;
  targetKeywords: string;
  heroImageUrl?: string;
  heroImageAlt?: string;
  body: string;
  offers?: { slug: string; label: string; context?: string }[];
  firsthand: string;
  noindex?: boolean;
  publishedAt: string;
  revisedAt?: string;
  updatedAt?: string;
};

type ListResponse = {
  contents: MicroCmsPost[];
  totalCount: number;
  offset: number;
  limit: number;
};

const LIMIT = 100;

// microCMS loader。limit=100 でページネーションし全件取得する。
// 取得失敗時はビルドを失敗させる（部分欠落でデプロイしない）。
export function microcmsLoader(endpoint: string): Loader {
  return {
    name: "microcms-loader",
    load: async ({ store, parseData, generateDigest, logger }) => {
      const domain = import.meta.env.MICROCMS_SERVICE_DOMAIN;
      const apiKey = import.meta.env.MICROCMS_API_KEY;

      if (!domain || !apiKey) {
        throw new Error(
          "MICROCMS_SERVICE_DOMAIN / MICROCMS_API_KEY が未設定です。CONTENT_SOURCE=local を使うか、.dev.vars を設定してください。",
        );
      }

      store.clear();
      let offset = 0;
      let total = Infinity;

      while (offset < total) {
        const url = `https://${domain}.microcms.io/api/v1/${endpoint}?limit=${LIMIT}&offset=${offset}`;
        const res = await fetch(url, { headers: { "X-MICROCMS-API-KEY": apiKey } });
        if (!res.ok) {
          throw new Error(`microCMS 取得失敗: ${res.status} ${res.statusText}`);
        }
        const page = (await res.json()) as ListResponse;
        total = page.totalCount;

        for (const post of page.contents) {
          const data = await parseData({
            id: post.id,
            data: normalize(post),
          });
          store.set({ id: post.id, data, digest: generateDigest(post) });
        }

        offset += LIMIT;
        if (page.contents.length === 0) break;
      }

      logger.info(`microCMS から ${total} 件取得しました。`);
    },
  };
}

function normalize(post: MicroCmsPost) {
  return {
    id: post.id,
    title: post.title,
    description: post.description,
    cluster: post.cluster,
    articleType: post.articleType,
    isPillar: post.isPillar ?? false,
    // targetKeywords はカンマ区切りテキスト。loader 側で配列化する。
    targetKeywords: post.targetKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    heroImage: post.heroImageUrl
      ? { url: post.heroImageUrl, width: 1200, height: 630, alt: post.heroImageAlt ?? "" }
      : undefined,
    body: post.body,
    offers: post.offers ?? [],
    firsthand: post.firsthand,
    noindex: post.noindex ?? false,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt ?? post.revisedAt ?? post.publishedAt,
  };
}
