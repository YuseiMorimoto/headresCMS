# 01. データモデル

## 1. Content Layer 定義

`src/content.config.ts`

```ts
import { defineCollection, z } from "astro:content";
import { contentLoader } from "./loaders";

const ARTICLE_TYPES = ["comparison", "review", "guide"] as const;

const offerRef = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/),  // KV の link:{slug} に対応
  label: z.string().max(30),               // ボタン文言
  context: z.string().max(80).optional(),  // ボタン上部の補足
});

const posts = defineCollection({
  loader: contentLoader("posts"),
  schema: z.object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(10).max(60),
    description: z.string().min(40).max(120),
    cluster: z.string(),                    // clusters.ts の id と一致
    articleType: z.enum(ARTICLE_TYPES),
    isPillar: z.boolean().default(false),
    targetKeywords: z.array(z.string()).min(1).max(3),

    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date(),

    heroImage: z.object({
      url: z.string().url(),
      width: z.number(),
      height: z.number(),
      alt: z.string().min(1),
    }).optional(),

    body: z.string().min(1),
    offers: z.array(offerRef).default([]),

    // 一次情報。空欄では公開させない（品質ゲート）
    firsthand: z.string().min(50),

    noindex: z.boolean().default(false),
  }),
});

export const collections = { posts };
```

### firsthand フィールドについて

**必須かつ50文字以上**。実測値・独自比較・実際の使用経験など、AI が生成できない情報をここに入れる。
未入力だとビルドが落ちる。これが AI 量産コンテンツ判定に対する構造的な防御になる。

記事テンプレート内では独立したセクションとしてレンダリングする。

## 2. loader の抽象化

`src/loaders/index.ts`

```ts
import type { Loader } from "astro/loaders";
import { microcmsLoader } from "./microcms";
import { localLoader } from "./local";

export function contentLoader(endpoint: string): Loader {
  const source = import.meta.env.CONTENT_SOURCE ?? "microcms";
  return source === "local" ? localLoader(endpoint) : microcmsLoader(endpoint);
}
```

要件:
- microCMS loader は `limit=100` のページネーションを内部で処理し、全件取得すること
- 下書きステータスの記事は取得しない（本番ビルド時）
- 取得失敗時はビルドを失敗させる（部分的な記事欠落でデプロイしない）

## 3. クラスタ定義

`src/config/clusters.ts`

```ts
export type Cluster = {
  id: string;          // URL に使う。a-z0-9-
  name: string;        // 表示名
  description: string; // クラスタ一覧ページの導入文
  pillarSlug: string;  // ピラー記事の id
  order: number;
};

export const CLUSTERS: Cluster[] = [
  // Phase 0 で 12〜15件に差し替える
  { id: "example-a", name: "例A", description: "…", pillarSlug: "example-a-pillar", order: 1 },
];
```

ビルド時に検証すること:
- 全記事の `cluster` が `CLUSTERS` の id に存在する
- 各クラスタに `isPillar: true` の記事がちょうど1件存在する
- 存在しない場合はビルドを失敗させる

## 4. Workers KV — 案件定義

キー: `link:{offerSlug}`

```json
{
  "url": "https://example-asp.example/track/xxxx",
  "asp": "a8",
  "subIdParam": null,
  "label": "公式サイトを見る",
  "active": true,
  "fallbackPath": "/c/example-a/",
  "note": "案件名・報酬額・終了予定日など運用メモ",
  "updatedAt": "2026-08-11T00:00:00Z"
}
```

| フィールド | 型 | 説明 |
|---|---|---|
| `url` | string | 遷移先。https のみ許可 |
| `asp` | string | `a8` / `moshimo` / `valuecommerce` / `afb` / `accesstrade` / `amazon` / `rakuten` |
| `subIdParam` | string \| null | サブIDのクエリパラメータ名。**ASPの管理画面で確認した実際の名前のみ設定する。推測で埋めない** |
| `active` | boolean | false の場合はリダイレクトせず `fallbackPath` へ |
| `fallbackPath` | string | 案件終了時の代替遷移先（自サイト内） |

投入は `scripts/sync-links.ts` で `data/links.json` から一括反映する。
KV を管理画面から手編集しない（Git で差分を追えなくなるため）。

## 5. Analytics Engine — クリックイベント

データセット名: `AFFILIATE_CLICKS`

| 位置 | フィールド | 内容 |
|---|---|---|
| `indexes[0]` | offerSlug | 案件識別子 |
| `blobs[0]` | offerSlug | |
| `blobs[1]` | articlePath | リファラから抽出した記事パス |
| `blobs[2]` | asp | |
| `blobs[3]` | country | `req.cf.country` |
| `blobs[4]` | deviceHint | `mobile` / `desktop`（UAから簡易判定） |
| `doubles[0]` | 1 | カウント用 |

集計例:

```sql
SELECT blob1 AS article, blob0 AS offer, SUM(_sample_interval) AS clicks
FROM AFFILIATE_CLICKS
WHERE timestamp > NOW() - INTERVAL '30' DAY
GROUP BY article, offer
ORDER BY clicks DESC
```

## 6. microCMS 側の API スキーマ

API ID: `posts`

| フィールドID | 種類 | 必須 | 備考 |
|---|---|---|---|
| `title` | テキスト | ○ | |
| `description` | テキストエリア | ○ | |
| `cluster` | セレクト | ○ | 選択肢は Phase 0 で確定 |
| `articleType` | セレクト | ○ | comparison / review / guide |
| `isPillar` | 真偽値 | | |
| `targetKeywords` | テキスト | ○ | カンマ区切り。loader 側で配列化 |
| `heroImageUrl` | テキスト | | **R2 のURL。microCMS の画像フィールドは使わない** |
| `heroImageAlt` | テキスト | | |
| `body` | リッチエディタ | ○ | |
| `offers` | 繰り返し | | slug / label / context |
| `firsthand` | テキストエリア | ○ | |
| `noindex` | 真偽値 | | |

**API数は5個以内に収める**（Hobbyプランの上限）。現状 `posts` の1つのみ使用。
