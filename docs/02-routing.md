# 02. ルーティングとページ仕様

## URL 設計

`trailingSlash: "always"`、`build.format: "directory"` とする。

| パス | 内容 | 生成方法 |
|---|---|---|
| `/` | トップ。新着12件＋クラスタ一覧 | 静的 |
| `/c/{cluster}/` | クラスタのピラー記事（記事本体を兼ねる）＋子記事一覧 | `getStaticPaths` |
| `/c/{cluster}/{slug}/` | 記事詳細 | `getStaticPaths` |
| `/page/{n}/` | 新着一覧のページネーション（20件/頁） | `paginate()` |
| `/about/` | 運営者情報 | 静的 |
| `/privacy/` | プライバシーポリシー | 静的 |
| `/contact/` | お問い合わせ（Googleフォーム埋め込み） | 静的 |
| `/disclaimer/` | 免責事項 | 静的 |
| `/404` | 404ページ | 静的 |
| `/sitemap-index.xml` | `@astrojs/sitemap` が生成 | |
| `/rss.xml` | `@astrojs/rss` | |
| `/robots.txt` | 静的ファイル | |
| `/go/{offerSlug}` | **Worker が処理。末尾スラッシュなし** | Worker |
| `/preview/` | 下書きプレビュー（SSR、noindex） | SSR |

**URL に日付を含めない。** リライト運用で古く見えるのを避けるため。

**記事は必ずクラスタ配下に置く。** クラスタ横断の記事は作らない。どうしても必要なら新しいクラスタを立てる。

## robots.txt

```
User-agent: *
Allow: /
Disallow: /go/
Disallow: /preview/

Sitemap: https://{PUBLIC_SITE_URL}/sitemap-index.xml
```

## お問い合わせページ

自前のフォーム実装は行わない。Googleフォームを iframe で埋め込む。

```astro
<iframe
  src={GOOGLE_FORM_EMBED_URL}
  width="100%"
  height="900"
  loading="lazy"
  title="お問い合わせフォーム"
  style="border:0"
></iframe>
```

要件:

- 埋め込みURLは `src/config/site.ts` の `contactFormUrl` に持たせる（ハードコードしない）
- `loading="lazy"` を必ず付ける。このページの LCP に影響させない
- iframe が表示されない環境向けに、フォームへの直接リンクを併記する
- ページ内に返信までの目安日数と、対応しない問い合わせ種別を明記する
- **`/contact/` を noindex にする**（フォームだけのページは検索結果に不要）
- Googleフォーム側で「メールアドレスを収集する」を有効にし、回答通知をオンにする

プライバシーポリシーに「お問い合わせフォームは Google フォームを使用しており、入力情報は Google のサーバーに保存される」旨を記載すること。

## リダイレクト管理

記事の統合・削除・URL変更で発生する301リダイレクトを管理する。
**Workers Static Assets の `_redirects` をそのまま使う。** Worker 側での自前実装はしない。

### マスタデータ

`data/redirects.json`

```json
[
  {
    "from": "/c/example-a/old-slug/",
    "to": "/c/example-a/new-slug/",
    "code": 301,
    "reason": "記事統合",
    "date": "2026-09-01"
  }
]
```

### 生成

`scripts/build-redirects.ts` が `public/_redirects` を生成する。ビルド前に必ず実行する（`prebuild` スクリプトに組み込む）。

```
/c/example-a/old-slug/ /c/example-a/new-slug/ 301
```

### ルール

- **`public/_redirects` を直接編集しない。** マスタは `data/redirects.json`
- 記事を削除・統合したら、同じ PR で `redirects.json` に追記する。これを CI でチェックする（公開記事のパス集合が前回より減っていて、対応する `from` エントリがなければ警告）
- リダイレクト先は必ず**関連性のあるページ**にする。全部トップに飛ばさない（ソフト404扱いになる）
- 多段リダイレクトを作らない。A→B の後に B→C が発生したら、A→C に書き換える。`_redirects` は最初にマッチした1件しか適用されず連鎖しない
- 上限は静的2,000件・動的100件。300記事規模なら十分だが、到達したら Bulk Redirects へ移行する
- `_redirects` は Worker が処理するリクエスト（`/go/*`）には適用されない。両者は干渉しない

### 検証

生成後、`scripts/build-redirects.ts` が以下を検証し、違反があればビルドを失敗させる。

- `from` が現存する公開記事のパスと重複していない
- `to` が現存するページか、既存のリダイレクトの `from` でない（多段検出）
- `from` と `to` が同一でない

## 記事詳細ページの構成要素

上から順に固定する。

1. パンくず（Home > クラスタ名 > 記事タイトル）
2. **PR表記**（`※本記事にはアフィリエイトリンクを含みます` 相当。`offers` が空でも表示する）
3. H1（title）
4. 公開日・更新日
5. 目次（H2/H3 から自動生成）
6. 本文
7. `firsthand` セクション（見出し付きで独立表示）
8. 関連記事（同一クラスタ優先で4件）
9. 前後の記事リンク

## SEO 要件

各ページに以下を出力する。

- `<title>`: 記事は `{title} | {サイト名}`、トップは `{サイト名} | {キャッチ}`
- `<meta name="description">`: `description` をそのまま
- `<link rel="canonical">`: 絶対URL
- OGP: `og:title` `og:description` `og:image` `og:type` `og:url`、Twitter Card は `summary_large_image`
- `noindex: true` の記事は `<meta name="robots" content="noindex,nofollow">` を出力し、**sitemap からも除外する**

### JSON-LD

記事詳細ページ:

- `Article`（`headline` / `description` / `datePublished` / `dateModified` / `author` / `publisher` / `image`）
- `BreadcrumbList`

`articleType: "comparison"` の場合のみ、比較表がある場合に `ItemList` を追加してよい。
**`Product` や `Review` の構造化データは出力しない**（自社商品ではないため、スパム扱いのリスクがある）。

## 画像

- `heroImage` は R2 の URL を `astro:assets` の `<Image />` に渡す（リモート画像として設定に許可ドメインを追加）
- 記事詳細のヒーロー画像のみ `loading="eager"`、それ以外は `lazy`
- `width` / `height` を必ず指定して CLS を防ぐ
- フォーマットは WebP、幅は最大1200px

## 内部リンク

`src/lib/related.ts` に以下を実装する。

- ビルド時に全記事の本文からキーワードベクトルを作り、コサイン類似度で関連記事を算出
- 同一クラスタの記事を優先（スコアに係数1.5を掛ける）
- 自分自身と `noindex` の記事は除外
- 上位4件を返す
- 300記事規模なら全対全の計算をビルド時に行って問題ない

## パフォーマンス要件

- 記事詳細ページの JavaScript は 0KB を目標（インタラクティブ要素は目次の追従のみ、CSS で実現できる範囲に留める）
- LCP 2.0秒以内、CLS 0.1未満
- フォントは `astro:assets` の Fonts API でセルフホストし、`font-display: swap`

## 受け入れ条件

- [ ] `/sitemap-index.xml` が 200 を返し、`noindex` の記事を含まない
- [ ] `/rss.xml` が 200 を返し、最新20件を含む
- [ ] `/robots.txt` に `Disallow: /go/` が含まれる
- [ ] 存在しないパスが 404 ページを返す（`not_found_handling: "404-page"`）
- [ ] 全記事詳細ページに PR表記が出力される
- [ ] 全記事詳細ページに canonical と JSON-LD（Article, BreadcrumbList）が出力される
- [ ] `/c/{cluster}/` にピラー記事の本文と子記事一覧の両方が表示される
- [ ] Lighthouse で記事詳細ページが Performance 95以上
- [ ] `/contact/` にGoogleフォームが表示され、noindex が出力される
- [ ] `data/redirects.json` に定義したパスが 301 を返し、Location が正しい
- [ ] `public/_redirects` がビルド時に生成される（手動編集されていない）
- [ ] 多段リダイレクトを定義するとビルドが失敗する
