# 07. 公開準備チェックリスト（Phase 5）

本番公開前に完了させる項目。`npm run prelaunch -- --strict` で自動検証できるものはスクリプトに委譲する。

## Phase 0: コンテンツ戦略の確定

人間が決定し、コードに反映する項目。

- [ ] **ジャンル**を確定する
- [ ] **トピッククラスタ 12〜15件**を `src/config/clusters.ts` に定義する（ダミーの `example-*` を差し替え）
- [ ] **記事テンプレートの見出し文言**を `docs/05-content-templates.md` に具体化する
- [ ] **提携 ASP と案件リスト**を `data/links.json` に投入する（ダミー URL を実案件に差し替え）
- [ ] `src/config/site.ts` のサイト名・著者情報・Googleフォーム URL を本番値に更新する

## 公開スイッチ（最後に入れる）

`PUBLIC_INDEXABLE` が `true` でない限り、サイトは**検索エンジンに公開されない**。

| 状態 | robots.txt | 全ページの meta robots |
|---|---|---|
| 既定（未設定） | `Disallow: /` | `noindex,nofollow` |
| `PUBLIC_INDEXABLE=true` | `Allow: /` + Sitemap | 出力しない（`/contact/` `/404` を除く） |

デプロイ自体は既定のままでも成功する。Phase 0（クラスタ・記事・案件）が未確定のうちに
インデックスされると、新規ドメインにダミー内容が登録されて回復に時間がかかるため、
**本チェックリストを全て満たしてから最後に** GitHub Variables へ `PUBLIC_INDEXABLE=true` を設定する。

公開後は `npm run prelaunch` の「検索エンジンへの公開」項目で状態を確認できる。

## ドメイン

本番ドメインは **`toinoba.com`**（Cloudflare Registrar で取得済み）。

- 既定値の定義元は `src/config/domain.ts`。ここを変えれば Astro・スクリプト・CI の全てに伝播する
- `PUBLIC_SITE_URL` / `PUBLIC_IMAGE_BASE` は**未設定でよい**。ステージング等で切り替えたいときだけ GitHub Variables に設定する
- Worker は `wrangler.jsonc` の `routes` で `toinoba.com` にカスタムドメインとして紐づく。Cloudflare 上にゾーンが存在している必要がある

## Cloudflare インフラ

### Workers + KV

1. Cloudflare ダッシュボードで KV namespace を作成する
   - `LINKS` — 案件定義用
   - `SESSION` — Astro セッション用（アダプタが自動利用）
2. GitHub Variables に ID を設定する
   - `KV_NAMESPACE_ID` — `LINKS` の ID
   - `SESSION_KV_NAMESPACE_ID` — `SESSION` の ID（省略時は `LINKS` と同じ ID を流用）

   `wrangler.jsonc` はプレースホルダのままコミットしておく。CI が**ビルド前に**実 ID へ置換する。
   `wrangler deploy` が読むのはビルド生成物の `dist/server/wrangler.json` なので、
   ビルド後に置換しても反映されない（この順序を崩さないこと）。
   ID が未解決のままデプロイに進んだ場合は `Verify deploy config is resolved` で失敗する。
3. ローカルから案件データを同期する場合:

```bash
CLOUDFLARE_API_TOKEN=xxx KV_NAMESPACE_ID=xxx npm run sync-links
```

### Analytics Engine

- データセット `AFFILIATE_CLICKS` が `wrangler.jsonc` に定義済みであることを確認
- 初回デプロイ後、Cloudflare ダッシュボードでデータセットが作成されていることを確認

### R2（画像ストレージ）

1. R2 バケットを作成する（例: `toinoba-images`）
2. カスタムドメイン `img.toinoba.com` を割り当てる（`src/config/domain.ts` の既定値と一致させる）
3. 別ドメインにする場合のみ GitHub Variables に `PUBLIC_IMAGE_BASE` を設定する
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

| 名前 | 例 | 備考 |
|---|---|---|
| `KV_NAMESPACE_ID` | `abc123...` | 必須（未設定時デプロイ失敗） |
| `SESSION_KV_NAMESPACE_ID` | `def456...` | 省略時は `KV_NAMESPACE_ID` を流用 |
| `PUBLIC_SITE_URL` | `https://toinoba.com` | 省略可（`src/config/domain.ts` の既定値） |
| `PUBLIC_IMAGE_BASE` | `https://img.toinoba.com` | 省略可（同上） |
| `CONTENT_SOURCE` | `microcms`（本番） | 省略時 `local` |
| `PUBLIC_INDEXABLE` | `true` | **最後に**設定。未設定 = 非公開 |
| `LAUNCH_STRICT` | `true` | Phase 0 完了後に prelaunch strict を CI で有効化 |

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
