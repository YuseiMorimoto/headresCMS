# 06. 開発計画

`docs/00`〜`05` の仕様と `AGENTS.md` の不変条件に基づく実装計画。
規模の見積りは日数ではなく、変更対象のコンポーネントと依存関係で表す。

## 計画の前提

- **1 PR = 1 タスク**（`AGENTS.md`）。以下のタスク一覧は、それぞれ独立した PR になる粒度で分割している
- Phase 0（ジャンル・クラスタ定義・案件リスト）は人間の意思決定タスクであり、**未確定でも Phase 1〜3 の実装を進められる**（`docs/00` 参照）。クラスタはダミー3件、案件は KV へダミーデータで開発する
- 各タスクの受け入れ条件は該当 docs のチェックリストをそのまま使い、PR 説明にコピーする
- 全タスク共通の完了条件: `npx astro check` エラーなし、`npm run build` 成功、秘匿値・生成物をコミットしない

## フェーズ構成と依存関係

```
Phase 0（並行・人間）: ジャンル / クラスタ12〜15件 / テンプレ文言 / ASP案件リスト
        │（ダミーで代替可能。確定後に差し替え）
        ▼
Phase 1: サイト基盤 ──────────────────┐
  T1 → T2 → T3                        │
        │                             │
        ▼                             ▼
Phase 2: ページとコンポーネント     Phase 3: 配信基盤（Worker・KV・CI）
  T4 → T5 → T6 → T7                   T8 → T9 → T10
        │                             │
        └──────────┬──────────────────┘
                   ▼
Phase 4: エクスポート保険と運用自動化
  T11 → T12 → (T13, T14, T15 は独立)
                   │
                   ▼
Phase 5: 公開準備（品質ゲート・本番設定・実データ投入）
```

Phase 2 と Phase 3 は T3 完了後に**並行して進められる**（互いに依存しない）。

---

## Phase 1: サイト基盤

### T1. プロジェクト初期化

新規ファイル: `package.json`, `astro.config.mjs`, `tsconfig.json`, `wrangler.jsonc`, `.assetsignore`, `.gitignore`, `.dev.vars.example`, `public/robots.txt`, `public/_headers`

- Astro `^6.4` / Node `>=22.12.0` / TypeScript strict / Tailwind CSS v4（`@tailwindcss/vite`）
- `trailingSlash: "always"`、`build.format: "directory"`（`docs/02`）
- `wrangler.jsonc` は `docs/03` の雛形どおり（`assets` 配信、`run_worker_first: ["/go/*"]`、KV / Analytics Engine バインディング）。KV namespace ID はプレースホルダのまま T10 で確定
- `@astrojs/sitemap` / `@astrojs/rss` を導入。**Pages 向けアダプタ・`functions/` は作らない**
- `robots.txt` に `Disallow: /go/` と `Disallow: /preview/`
- 検証: `npm run build` が空サイトで成功し、`npx wrangler dev` で静的配信できる

### T2. Content Layer とローダー

新規ファイル: `src/content.config.ts`, `src/loaders/index.ts`, `src/loaders/local.ts`, `src/loaders/microcms.ts`, `src/config/clusters.ts`, `src/config/site.ts`, サンプル記事（`content/posts/` にダミー3クラスタ×数本）

- スキーマは `docs/01` §1 のとおり。**`firsthand` は必須・50文字以上**（空を許容する変更をしない）
- `CONTENT_SOURCE` 環境変数で microCMS / local を切替（`docs/01` §2）
- microCMS loader: `limit=100` ページネーション処理、下書き除外、取得失敗時はビルド失敗
- ビルド時検証: 全記事の `cluster` が `CLUSTERS` に存在、各クラスタに `isPillar: true` がちょうど1件（違反でビルド失敗）
- クラスタはダミー3件で定義し、Phase 0 確定後に差し替える
- 検証: 不正データ（firsthand 空、存在しない cluster、ピラー0件/2件）でビルドが落ちることを実際に確認する

### T3. 301リダイレクト生成

新規ファイル: `data/redirects.json`, `scripts/build-redirects.ts`、`package.json` の `prebuild` に組み込み

- `data/redirects.json` → `public/_redirects` を生成（`docs/02` リダイレクト管理）
- 検証ロジック: `from` が公開記事と重複しない / 多段リダイレクト検出 / `from`=`to` 検出、違反でビルド失敗
- `public/_redirects` は生成物なので `.gitignore` に入れ、直接編集を構造的に防ぐ
- 検証: 多段リダイレクトを定義してビルドが失敗することを確認

## Phase 2: ページとコンポーネント

### T4. レイアウトと SEO 基盤

新規ファイル: `src/layouts/`, `src/components/seo/`（JSON-LD / OGP / canonical）, `src/lib/schema.ts`

- `<title>` / description / canonical / OGP / Twitter Card（`docs/02` SEO要件）
- JSON-LD: `Article` + `BreadcrumbList`。**`Product` / `Review` は出力しない**
- `noindex: true` の記事は robots メタ出力＋sitemap 除外
- フォントは `astro:assets` の Fonts API でセルフホスト、`font-display: swap`
- R2 のリモート画像ドメイン（`PUBLIC_IMAGE_BASE`）を `astro.config` の許可リストに追加

### T5. 記事コンポーネント群と内部リンク

新規ファイル: `src/components/article/`（`PrNotice` / `OfferButton` / `ComparisonTable` / `SpecTable` / `Firsthand` / `Faq` / `Toc` / `RelatedPosts`）, `src/lib/related.ts`

- `docs/05` の必須コンポーネント表を満たす。特に:
  - `OfferButton`: `/go/{slug}` + `rel="sponsored nofollow noopener"`。実URLを出力しない
  - `PrNotice`: `offers` が空でも表示
  - `Firsthand`: 空ならビルドエラー（スキーマで担保済みだがコンポーネント側でも防御）
  - `Toc`: H2/H3 から自動生成、**JS を使わない**
- `related.ts`: キーワードベクトル＋コサイン類似度、同一クラスタに係数1.5、自分と noindex を除外し上位4件（`docs/02`）
- 記事詳細のクライアント JS は 0KB を目標

### T6. 全ルーティングページ

新規ファイル: `src/pages/` 配下（`index`, `c/[cluster]/index`, `c/[cluster]/[slug]`, `page/[n]`, `about`, `privacy`, `contact`, `disclaimer`, `404`, `rss.xml`）

- URL 設計は `docs/02` の表のとおり。記事は必ずクラスタ配下
- 記事詳細は `docs/02` の構成要素9項目を上から順に固定（パンくず → PR表記 → H1 → 日付 → 目次 → 本文 → firsthand → 関連記事 → 前後リンク）
- `/c/{cluster}/` はピラー記事本文＋子記事一覧を兼ねる
- `/contact/` は Googleフォーム iframe（`loading="lazy"`、直接リンク併記、noindex、URL は `site.ts` の `contactFormUrl`）
- sitemap から noindex 記事を除外、RSS は最新20件
- 検証: `docs/02` 受け入れ条件のチェックリスト全項目＋Lighthouse（記事詳細で Performance / Accessibility 95以上）

### T7. 下書きプレビュー（/preview/）

- SSR の1ルートのみ。microCMS の下書きを `draftKey` 付きで取得して表示、noindex
- Workers 上で SSR するため `@astrojs/cloudflare` アダプタの導入が必要になる見込み。**Pages 向け設定は使わず**、既存の `wrangler.jsonc`（Workers + assets）構成と両立させる。アダプタ導入の理由と構成差分を PR に明記する

## Phase 3: 配信基盤（Phase 2 と並行可）

### T8. /go/ リダイレクタ Worker

新規ファイル: `worker/index.ts`、補助関数、Worker のユニットテスト（`vitest` + `@cloudflare/vitest-pool-workers` 等。追加理由を PR に記載）

- `docs/03` の実装仕様のとおり: slug 正規表現検証 → KV 取得 → active 判定 → リファラから記事パス抽出 → subId 付与 → Analytics Engine 書き込み → 302
- https 以外の遷移先は拒否、`X-Robots-Tag: noindex, nofollow`、`Cache-Control: no-store`
- クリックログに IP・完全UA・クエリ文字列を保存しない
- **Worker で301を実装しない**（静的アセットの無料配信から外さない）
- 検証: `docs/03` 受け入れ条件（不正入力404、active:false→fallback、`/` へのリクエストで Worker が処理しない、等）を `wrangler dev` とテストで確認

### T9. 案件データ同期スクリプト

新規ファイル: `data/links.json`, `scripts/sync-links.ts`, `scripts/check-offers.ts`

- `links.json` → KV へ一括反映（`docs/01` §4）。投入時に https 検証
- `subIdParam` は**推測で埋めない**。不明なら `null`
- `check-offers.ts`: KV の全遷移先URLの疎通確認（T13 の linkcheck から利用）
- 開発用にダミー案件2〜3件を定義

### T10. デプロイ CI（W1）と Webhook プロキシ

新規ファイル: `.github/workflows/deploy.yml`, Webhook 署名検証プロキシ Worker（別ディレクトリの小さな Worker）

- `docs/04` W1 のとおり: push(main) / `repository_dispatch` 発火、`concurrency` で多重デプロイ防止、`astro check` → `build` → `wrangler deploy`
- microCMS Webhook は署名検証プロキシ Worker 経由で `repository_dispatch` を叩く（GitHub トークンを microCMS 管理画面に置かない）
- このタスクで KV namespace / Analytics Engine データセットを実際に作成し、`wrangler.jsonc` のプレースホルダを確定
- 必要な Secrets / Vars（`docs/00` 環境変数表）を README に整理し、設定は人間が行う

## Phase 4: エクスポート保険と運用自動化

### T11. コンテンツエクスポート（W6）

新規ファイル: `scripts/export-content.ts`, `.github/workflows/export.yml`

- `docs/04` W6 のとおり。CMS 全記事 → frontmatter付き Markdown（`content/posts/{cluster}/{slug}.md`）
- リッチエディタ HTML → Markdown 変換（`turndown` 等。追加理由を PR に記載）。テーブル等は HTML のまま残す
- 差分がある場合のみコミット。**`CONTENT_SOURCE=local npm run build` が通ることを CI で検証**（これがないと保険にならない）
- `docs/04` に「Phase 1 で実装する（後回しにしない）」とあるため、自動化群の中で最優先。T2 の local loader が完成していれば microCMS 運用開始と同時に有効化できる

### T12. NGワード検査（lint-content）

新規ファイル: `scripts/lint-content.ts`、CI への組み込み

- `docs/05` の禁止表現（薬機法・景表法・煽り・他社中傷）を検出
- **ビルドはブロックせず**、警告として PR にコメント（誤検知が多いため）

### T13. リンク切れ検査（W4）

新規ファイル: `.github/workflows/linkcheck.yml`

- `lychee` で `dist/` 内を検査＋`check-offers.ts` で KV の遷移先を直接検査
- 検知したら Issue 作成。`active: false` への変更は**手動**（自動で落とさない）

### T14. GSC レポート（W2）とカニバリ検出（W5）

新規ファイル: `.github/workflows/gsc-report.yml`, `.github/workflows/cannibalization.yml`, 集計スクリプト

- W2: 4分類（あと一歩 / CTR不足 / 未カバー / 下落）で Issue 化。取得結果を `data/gsc/{date}.json` にコミット。API は1日1回まで
- W5: `targetKeywords` の重複＋GSC の複数URL表示を検出して Issue 化
- **GSC はサイト公開・Search Console 登録後でないと動作確認できない**ため、実装は先行しつつ有効化は Phase 5 以降

### T15. 下書き生成（W3）

新規ファイル: `.github/workflows/draft.yml`, 生成スクリプト

- `docs/04` W3 のとおり。テンプレート（`docs/05`）をプロンプトに含め、同一クラスタの既存記事を重複回避コンテキストとして渡す
- **`firsthand` は生成しない**。空欄のまま Draft PR / CMS下書きを作成し、PR 本文に記入必要と明記
- **公開まで自動化しない**。下書き作成で必ず停止する
- Phase 0 のテンプレ文言確定後の方が精度が出るため、自動化群の最後に回す

## Phase 5: 公開準備

コード変更よりも設定・データ投入・検証が中心。

1. Phase 0 確定値の反映: `clusters.ts` を本番12〜15件へ差し替え、`docs/05` の見出し文言を具体化、`data/links.json` に実案件を投入（`subIdParam` は ASP 管理画面で確認した値のみ）
2. microCMS 本番セットアップ: `docs/01` §6 のスキーマで `posts` API を作成（API数5個以内）、Webhook 接続
3. R2 バケット・公開ドメインの設定、`PUBLIC_IMAGE_BASE` 確定
4. 品質ゲートの最終確認: `docs/00` の5項目（astro check / build / Lighthouse 95 / 全記事PR表記 / 遷移先URL非ハードコード）を本番データで通す
5. Search Console 登録 → T14 のワークフロー有効化

## タスクとdocsの対応表

| タスク | 主参照 | 受け入れ条件の出典 |
|---|---|---|
| T1 | 00, 03 | 00 品質ゲート |
| T2 | 01 | 01 §1〜3 |
| T3 | 02 | 02 リダイレクト管理・検証 |
| T4 | 02 | 02 SEO要件 |
| T5 | 02, 05 | 05 必須コンポーネント |
| T6 | 02 | 02 受け入れ条件 |
| T7 | 02 | 02 URL設計（/preview/） |
| T8 | 03 | 03 受け入れ条件 |
| T9 | 01, 03 | 01 §4 |
| T10 | 04 | 04 W1 |
| T11 | 04 | 04 W6 |
| T12 | 05 | 05 表現の禁止事項 |
| T13 | 04 | 04 W4 |
| T14 | 04 | 04 W2, W5 |
| T15 | 04, 05 | 04 W3 |

## リスクと要確認事項

実装前に Issue / PR で確認が必要な曖昧点（`AGENTS.md`「推測で実装しない」に従う）。

1. **/preview/ の SSR 方式**: `docs/00` は「SSR を前提とした動的ページ（プレビュー用の1ルートを除く）」を非目標とする一方、SSR には `@astrojs/cloudflare` アダプタが必要になる見込み。Workers + Static Assets 構成（Pages 非使用）とアダプタ設定の両立方法を T7 の PR で提示し、確認を取る
2. **本文レンダリングの差異**: microCMS はリッチエディタの HTML、local loader は Markdown。`body` の型は string（`docs/01`）だが、レンダリング時に HTML / Markdown をどう判別・処理するかは未規定。T2 で方針を提示する（例: loader 側で常に HTML へ正規化）
3. **Webhook プロキシ Worker の置き場所**: 本体 Worker と同一プロジェクトか別プロジェクトか未規定。T10 で提案する
4. **`docs/04` の「Phase 1 で実装する」**: 本計画では W6 を Phase 4 の先頭（T11）に置いた。「microCMS で記事を書き始める前に有効化する」を満たすことが目的であり、実記事の投入開始（Phase 5）より前に完了するため趣旨は満たす
5. **比較記事の `ItemList`**: 「追加してよい」（任意）とあるため、初期実装では出力せず、必要になったら追加する

## 進め方の運用ルール（再掲）

- 各 PR の説明に、該当 docs の受け入れ条件チェックリストをコピーする
- 新規ライブラリ追加時は既存依存で代替できない理由を PR に書く（現時点で追加が見込まれるもの: `turndown`（T11）、`lychee` は Action 利用、Worker テスト用の vitest 系（T8））
- 記事の削除・統合を伴う変更は同一 PR で `data/redirects.json` に301を追加する
- 秘匿値は `.dev.vars` / GitHub Secrets / `wrangler secret` のみ。コミットしない
