# 00. プロジェクトコンテキスト

## 何を作るか

検索流入を主軸としたアフィリエイトメディア。初年度300記事規模。
静的サイト生成でビルドし、Cloudflare のエッジから配信する。

## 確定している技術スタック

| レイヤ | 選定 | バージョン制約 |
|---|---|---|
| フレームワーク | Astro | ^6.4 |
| ランタイム | Node.js | >= 22.12.0 |
| 言語 | TypeScript | strict |
| スタイル | Tailwind CSS v4（`@tailwindcss/vite`） | |
| CMS | microCMS（loader経由で差し替え可能） | |
| 画像ストレージ | Cloudflare R2 | |
| リンク定義 | Cloudflare Workers KV | |
| クリック計測 | Cloudflare Workers Analytics Engine | |
| ホスティング | Cloudflare Workers + Static Assets | |
| CI/CD | GitHub Actions + wrangler | |

## 絶対に守る技術前提

- **Cloudflare Pages は使わない。** Workers + Static Assets（`wrangler.jsonc` の `assets`）で配信する。Pages 向けの設定・アダプタ構成を書かない。
- **Astro 5 以前の書き方を使わない。** コンテンツ定義は `src/content.config.ts`（`src/content/config.ts` ではない）。Content Layer API の loader 方式を使う。
- **画像を microCMS に置かない。** すべて R2。CMS はテキストと画像の参照URLのみ保持する。
- **アフィリエイトの遷移先URLを記事本文に直接書かない。** すべて `/go/{offerSlug}` を経由する。

## ディレクトリ構成

```
.
├── src/
│   ├── content.config.ts       # Content Layer 定義
│   ├── loaders/
│   │   ├── index.ts            # loader の選択（環境変数で切替）
│   │   ├── microcms.ts         # microCMS loader
│   │   └── local.ts            # Markdown loader（フォールバック）
│   ├── config/
│   │   ├── site.ts             # サイト名・URL・著者情報
│   │   └── clusters.ts         # トピッククラスタ定義（Phase 0 で埋める）
│   ├── components/
│   │   ├── article/            # 記事型ごとのパーツ
│   │   ├── seo/                # JSON-LD, OGP, canonical
│   │   └── ui/
│   ├── layouts/
│   ├── pages/
│   └── lib/
│       ├── related.ts          # 内部リンク候補算出
│       └── schema.ts           # JSON-LD 生成
├── public/
│   ├── robots.txt
│   ├── _redirects              # ビルド時に生成（直接編集しない）
│   └── _headers
├── worker/
│   └── index.ts                # /go/ リダイレクタ
├── data/
│   ├── links.json              # 案件定義のマスタ（KVへ同期）
│   └── redirects.json          # 301リダイレクトのマスタ
├── scripts/
│   ├── sync-links.ts           # links.json → KV
│   ├── build-redirects.ts      # redirects.json → public/_redirects
│   ├── export-content.ts       # CMS → Markdown 一括エクスポート
│   ├── check-offers.ts         # KV の遷移先URL疎通確認
│   └── lint-content.ts         # NGワード検査
├── docs/
├── wrangler.jsonc
└── AGENTS.md
```

## 環境変数

| 変数名 | 用途 | スコープ |
|---|---|---|
| `MICROCMS_SERVICE_DOMAIN` | CMS接続 | ビルド時 |
| `MICROCMS_API_KEY` | CMS接続 | ビルド時 |
| `CONTENT_SOURCE` | `microcms` \| `local` | ビルド時 |
| `PUBLIC_SITE_URL` | canonical / OGP | ビルド時 |
| `PUBLIC_IMAGE_BASE` | R2 の公開ドメイン | ビルド時 |
| `CLOUDFLARE_API_TOKEN` | デプロイ | CI |
| `GSC_SERVICE_ACCOUNT_JSON` | Search Console API | CI |
| `ANTHROPIC_API_KEY` | 下書き生成 | CI |

**秘匿値をコードに直接書かない。** ローカルは `.dev.vars`、CI は GitHub Secrets、Worker 実行時は `wrangler secret`。

## Phase 0 で埋める空欄（開発と並行して確定させる）

- [ ] ジャンル
- [ ] トピッククラスタ 12〜15個の定義 → `src/config/clusters.ts`
- [ ] 記事の型3種の見出し構成 → `docs/05-content-templates.md`
- [ ] 提携ASPと案件リスト → KV の投入データ

**これらが未確定でも Phase 1〜3 の実装は進められる。** クラスタ定義はダミー3件で開発し、確定後に差し替える。

## 非目標（今回作らない）

- 管理画面・独自ダッシュボード（Analytics Engine への直接クエリで足りる）
- Google Analytics 4 の導入
- ユーザー登録・コメント機能
- 多言語対応
- SSR を前提とした動的ページ（プレビュー用の1ルートを除く）
- 記事の全自動公開（公開操作は必ず人間が行う）
- お問い合わせフォームの自前実装（Googleフォームの埋め込みで代替する）
- ビルド失敗の外部通知（GitHub の標準通知で運用し、必要になったら追加する）

## 品質ゲート

以下を満たさないコードはマージしない。

- `astro check` がエラーなし
- `npm run build` が成功
- Lighthouse: Performance 95以上、Accessibility 95以上（記事詳細ページ）
- 全記事に PR表記が出力されている
- 遷移先URLが記事本文にハードコードされていない
