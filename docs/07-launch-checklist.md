# 07. 公開準備チェックリスト（Phase 5）

本番公開前に完了させる項目。`npm run prelaunch -- --strict` で自動検証できるものはスクリプトに委譲する。

## Phase 0: コンテンツ戦略の確定

人間が決定し、コードに反映する項目。

- [ ] **ジャンル**を確定する
- [ ] **トピッククラスタ 12〜15件**を `src/config/clusters.ts` に定義する（ダミーの `example-*` を差し替え）
- [ ] **記事テンプレートの見出し文言**を `docs/05-content-templates.md` に具体化する
- [ ] **提携 ASP と案件リスト**を `data/links.json` に投入する（ダミー URL を実案件に差し替え）
- [ ] `src/config/site.ts` のサイト名・著者情報・Googleフォーム URL を本番値に更新する

## Cloudflare インフラ

### Workers + KV

1. Cloudflare ダッシュボードで KV namespace を作成する
   - `LINKS` — 案件定義用
   - `SESSION` — Astro セッション用（アダプタが自動利用）
2. `wrangler.jsonc` のプレースホルダ ID を実際の ID に差し替える
3. 案件データを同期する:

```bash
CLOUDFLARE_API_TOKEN=xxx KV_NAMESPACE_ID=xxx npm run sync-links
```

### Analytics Engine

- データセット `AFFILIATE_CLICKS` が `wrangler.jsonc` に定義済みであることを確認
- 初回デプロイ後、Cloudflare ダッシュボードでデータセットが作成されていることを確認

### R2（画像ストレージ）

1. R2 バケットを作成する（例: `affiliate-site-images`）
2. カスタムドメインまたは R2.dev 公開 URL を設定する
3. GitHub Variables に `PUBLIC_IMAGE_BASE` を設定する（例: `https://img.example.com`）
4. `astro.config.mjs` の `image.remotePatterns` がこのドメインを許可していることを確認

> 画像のアップロードは R2 ダッシュボードまたは別ツールで行う。microCMS には R2 の URL のみ保存する。

## microCMS 本番セットアップ

1. `posts` API を `docs/01-data-model.md` §6 のスキーマで作成する
2. クラスタの選択肢を `src/config/clusters.ts` の id と一致させる
3. プレビュー URL を設定する:

```
https://{PUBLIC_SITE_URL}/preview/?id={CONTENT_ID}&draftKey={DRAFT_KEY}
```

4. **Webhook プロキシ Worker** をデプロイする（GitHub トークンを microCMS に置かないため）:

```bash
cd worker/webhook-proxy
npx wrangler secret put MICROCMS_WEBHOOK_SECRET
npx wrangler secret put GITHUB_DISPATCH_TOKEN
npx wrangler secret put GITHUB_REPO          # "owner/repo"
npx wrangler deploy
```

5. microCMS の Webhook URL にプロキシ Worker の URL を設定する
6. GitHub Secrets に `MICROCMS_SERVICE_DOMAIN` と `MICROCMS_API_KEY` を設定する

## GitHub 設定

### Secrets

| 名前 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | デプロイ・KV同期 |
| `MICROCMS_SERVICE_DOMAIN` | CMS接続 |
| `MICROCMS_API_KEY` | CMS接続 |
| `GSC_SERVICE_ACCOUNT_JSON` | GSCレポート |
| `ANTHROPIC_API_KEY` | 下書き生成 |

### Variables

| 名前 | 例 |
|---|---|
| `PUBLIC_SITE_URL` | `https://your-domain.com` |
| `PUBLIC_IMAGE_BASE` | `https://img.your-domain.com` |
| `CONTENT_SOURCE` | `microcms`（本番） |

## 品質ゲート（公開前に全て合格）

```bash
CONTENT_SOURCE=local PUBLIC_SITE_URL=https://your-domain.com PUBLIC_IMAGE_BASE=https://img.your-domain.com npm run prelaunch -- --strict
```

自動検証項目:

- [ ] `astro check` エラーなし
- [ ] `npm run build` 成功
- [ ] 全記事に PR 表記が出力されている
- [ ] 遷移先 URL が記事本文にハードコードされていない
- [ ] `offers.slug` が `data/links.json` に存在する
- [ ] `firsthand` が全記事で 50 文字以上
- [ ] `robots.txt` の Sitemap URL が `PUBLIC_SITE_URL` と一致
- [ ] Phase 0 のダミーデータが残っていない（`--strict` 時）

手動確認:

- [ ] Lighthouse: 記事詳細ページで Performance 95 以上、Accessibility 95 以上
- [ ] `/go/{slug}` が 302 で正しい遷移先にリダイレクトする
- [ ] `/preview/` で下書きが表示される
- [ ] `data/redirects.json` の 301 が正しく動作する

## Search Console

1. プロパティを追加し、所有権を確認する
2. サイトマップ `https://{PUBLIC_SITE_URL}/sitemap-index.xml` を送信する
3. サービスアカウントにプロパティの権限を付与する
4. `GSC_SERVICE_ACCOUNT_JSON` を GitHub Secrets に設定する
5. `gsc-report.yml` ワークフローが正常に動作することを確認する

## 公開手順

1. Phase 0 の確定値をすべて反映する
2. `npm run prelaunch -- --strict` が合格する
3. `main` ブランチにマージする → `deploy.yml` が自動デプロイ
4. microCMS で記事を公開する → Webhook → 再デプロイ
5. Search Console でインデックス状況を確認する

> **記事の公開操作は必ず人間が行う。** 自動化はデプロイまでであり、CMS での公開ボタンは人間が押す。
