# 03. Worker 仕様（リダイレクタと配信）

## wrangler.jsonc

```jsonc
{
  "name": "affiliate-site",
  "compatibility_date": "2026-08-01",
  "main": "./worker/index.ts",
  "assets": {
    "directory": "./dist/",
    "not_found_handling": "404-page",
    "binding": "ASSETS",
    "run_worker_first": ["/go/*"]
  },
  "kv_namespaces": [
    { "binding": "LINKS", "id": "<KV_NAMESPACE_ID>" }
  ],
  "analytics_engine_datasets": [
    { "binding": "CLICKS", "dataset": "AFFILIATE_CLICKS" }
  ],
  "observability": { "enabled": true }
}
```

`.assetsignore` を必ず置く（Pages と違い Workers は自動除外しない）:

```
node_modules
.git
.DS_Store
.env*
*.map
```

## 責務の分界

| 種類 | 担当 | 定義場所 |
|---|---|---|
| 301（記事の統合・URL変更） | Workers Static Assets の `_redirects` | `data/redirects.json` → `public/_redirects` |
| 302（アフィリエイト遷移） | Worker コード | Workers KV |

`_redirects` のルールは Worker が処理するリクエストには適用されない。
`/go/*` は `run_worker_first` で Worker に流れるため、両者は干渉しない。

**Worker 側で301リダイレクトを実装しない。** サイト内URLの転送を Worker で処理すると、静的アセットの無料配信から外れてリクエスト課金の対象になる。

## リダイレクタの処理仕様

### 対象

`/go/{offerSlug}` のみ。それ以外は `env.ASSETS.fetch(request)` に委譲する。

### 処理順

1. `offerSlug` を抽出。`^[a-z0-9-]{1,64}$` にマッチしなければ 404
2. KV から `link:{offerSlug}` を JSON として取得
3. 見つからなければ 404（Workerが404ページのHTMLを返す）
4. `active: false` なら `fallbackPath` へ 302
5. リファラから記事パスを抽出（自サイトのオリジンでない場合は `external`）
6. `subIdParam` が非nullなら、遷移先URLのクエリに記事パスを付与
7. Analytics Engine に書き込み
8. 302 リダイレクト

### 実装

```ts
type LinkRecord = {
  url: string;
  asp: string;
  subIdParam: string | null;
  label: string;
  active: boolean;
  fallbackPath: string;
};

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/go/")) {
      return env.ASSETS.fetch(request);
    }

    const slug = url.pathname.slice(4).replace(/\/$/, "");
    if (!SLUG_RE.test(slug)) return notFound(env, request);

    const record = await env.LINKS.get<LinkRecord>(`link:${slug}`, "json");
    if (!record) return notFound(env, request);

    if (!record.active) {
      return Response.redirect(new URL(record.fallbackPath, url.origin).toString(), 302);
    }

    const dest = new URL(record.url);
    // オープンリダイレクト防止: https 以外は拒否
    if (dest.protocol !== "https:") return notFound(env, request);

    const article = articlePathFrom(request.headers.get("referer"), url.origin);
    if (record.subIdParam) {
      dest.searchParams.set(record.subIdParam, toSubId(article));
    }

    env.CLICKS.writeDataPoint({
      indexes: [slug],
      blobs: [
        slug,
        article,
        record.asp,
        request.cf?.country ?? "unknown",
        deviceHint(request.headers.get("user-agent")),
      ],
      doubles: [1],
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: dest.toString(),
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer-when-downgrade",
        "X-Robots-Tag": "noindex, nofollow",
      },
    });
  },
};
```

補助関数の要件:

- `articlePathFrom(referer, origin)`: 同一オリジンなら `pathname` を返す。異なる/空なら `"external"`
- `toSubId(path)`: 英数とハイフンのみに正規化し、先頭末尾のスラッシュを除去、**最大40文字に切り詰める**（ASP側の文字数制限を考慮）
- `deviceHint(ua)`: `mobile` / `desktop` の2値
- `notFound(env, request)`: `env.ASSETS.fetch` で `/404` のHTMLを取得し、status 404 で返す

## 記事側でのリンク出力

`offers` からリンクを生成するコンポーネントは以下を必ず満たす。

```html
<a href="/go/{slug}" rel="sponsored nofollow noopener" target="_blank">{label}</a>
```

- `rel="sponsored nofollow"` は省略不可
- 遷移先の実URLをHTMLに出力しない
- `offers` が空の記事でも PR表記は出す

## セキュリティ要件

- KV に投入する `url` は https のみ。`scripts/sync-links.ts` の投入時にも検証する
- `offerSlug` を正規表現で必ず検証してから KV アクセスする
- Worker のレスポンスに `X-Robots-Tag: noindex, nofollow` を付ける
- クリックログに個人を特定しうる値（IP、完全なUA、クエリ文字列）を保存しない

## 受け入れ条件

- [ ] `/go/{存在するslug}` が 302 を返し、Location が KV の url と一致する
- [ ] `subIdParam` を設定した案件で、Location のクエリに記事パスが入る
- [ ] `/go/{存在しないslug}` が 404 を返す
- [ ] `/go/../../etc` のような不正入力が 404 になる
- [ ] `active: false` の案件が `fallbackPath` へ 302 する
- [ ] `/` や `/c/xxx/` へのリクエストで Worker のログが出ない（静的アセットが優先されている）
- [ ] Analytics Engine のクエリでクリックが記事別に集計できる
- [ ] `_redirects` に定義したパスが 301 を返し、その処理で Worker のログが出ない
- [ ] Worker コードに301リダイレクトの実装が含まれていない
