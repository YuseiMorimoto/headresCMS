import { defineCollection, z } from "astro:content";
import { contentLoader } from "./loaders";

const ARTICLE_TYPES = ["comparison", "review", "guide"] as const;

const offerRef = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/), // KV の link:{slug} に対応
  label: z.string().max(30), // ボタン文言
  context: z.string().max(80).optional(), // ボタン上部の補足
});

const posts = defineCollection({
  loader: contentLoader("posts"),
  schema: z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(10).max(60),
    description: z.string().min(40).max(120),
    cluster: z.string(), // clusters.ts の id と一致
    articleType: z.enum(ARTICLE_TYPES),
    isPillar: z.boolean().default(false),
    targetKeywords: z.array(z.string()).min(1).max(3),

    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date(),

    heroImage: z
      .object({
        url: z.string().url(),
        width: z.number(),
        height: z.number(),
        alt: z.string().min(1),
      })
      .optional(),

    body: z.string().min(1),
    offers: z.array(offerRef).default([]),

    // 一次情報。空欄では公開させない（品質ゲート）。
    firsthand: z.string().min(50),

    noindex: z.boolean().default(false),
  }),
});

export const collections = { posts };
