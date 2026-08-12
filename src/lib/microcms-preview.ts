export type PreviewPost = {
  id: string;
  title: string;
  description: string;
  cluster: string;
  articleType: "comparison" | "review" | "guide";
  targetKeywords: string[];
  publishedAt: Date;
  updatedAt: Date;
  body: string;
  offers: Array<{ slug: string; label: string; context?: string }>;
  firsthand: string;
  heroImage?: {
    url: string;
    width: number;
    height: number;
    alt: string;
  };
};

type MicroCmsDraftResponse = {
  id: string;
  title: string;
  description: string;
  cluster: string;
  articleType: "comparison" | "review" | "guide";
  targetKeywords: string;
  publishedAt?: string;
  updatedAt: string;
  heroImageUrl?: string;
  heroImageAlt?: string;
  body: string;
  offers?: Array<{ slug: string; label: string; context?: string }>;
  firsthand?: string;
};

const ID_RE = /^[a-z0-9-]+$/;
const DRAFT_KEY_RE = /^[a-zA-Z0-9_-]+$/;

function getMicroCmsConfig() {
  const domain =
    process.env.MICROCMS_SERVICE_DOMAIN ?? import.meta.env.MICROCMS_SERVICE_DOMAIN;
  const apiKey = process.env.MICROCMS_API_KEY ?? import.meta.env.MICROCMS_API_KEY;
  return { domain, apiKey };
}

export function validatePreviewParams(
  contentId: string | null,
  draftKey: string | null,
): string | null {
  if (!contentId || !draftKey) {
    return "id と draftKey クエリパラメータが必要です";
  }
  if (!ID_RE.test(contentId)) {
    return "id の形式が不正です";
  }
  if (!DRAFT_KEY_RE.test(draftKey)) {
    return "draftKey の形式が不正です";
  }
  return null;
}

export async function fetchDraftPost(
  contentId: string,
  draftKey: string,
): Promise<PreviewPost | null> {
  const { domain, apiKey } = getMicroCmsConfig();
  if (!domain || !apiKey) {
    throw new Error("MICROCMS_SERVICE_DOMAIN と MICROCMS_API_KEY が設定されていません");
  }

  const url = new URL(`https://${domain}/api/v1/posts/${contentId}`);
  url.searchParams.set("draftKey", draftKey);

  const res = await fetch(url, {
    headers: { "X-MICROCMS-API-KEY": apiKey },
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`microCMS preview API error: ${res.status} ${res.statusText}`);
  }

  const post = (await res.json()) as MicroCmsDraftResponse;

  return {
    id: post.id,
    title: post.title,
    description: post.description,
    cluster: post.cluster,
    articleType: post.articleType,
    targetKeywords: post.targetKeywords
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
    publishedAt: new Date(post.publishedAt ?? post.updatedAt),
    updatedAt: new Date(post.updatedAt),
    body: post.body,
    offers: post.offers ?? [],
    firsthand: post.firsthand ?? "",
    heroImage:
      post.heroImageUrl && post.heroImageAlt
        ? {
            url: post.heroImageUrl,
            width: 1200,
            height: 630,
            alt: post.heroImageAlt,
          }
        : undefined,
  };
}
