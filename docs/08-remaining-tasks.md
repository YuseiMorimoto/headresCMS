# 08. 残タスク（人間作業）

コード側の Phase 1〜5 基盤は main にマージ済み（PR #2〜#15）。
ここでは**人間が判断・設定する残作業**をチェックリスト形式で整理する。

> 自動検証: `npm run prelaunch`（警告） / `npm run prelaunch -- --strict`（ダミーデータで失敗）

## A. インフラ・CI

- [x] **A-1** ドメイン取得（`toinoba.com` — Cloudflare Registrar）
- [ ] **A-2** GitHub Secrets: `CLOUDFLARE_API_TOKEN` を設定する
- [ ] **A-3** GitHub Variables: `KV_NAMESPACE_ID` を設定する（任意: `SESSION_KV_NAMESPACE_ID`）
- [ ] **A-4** Cloudflare KV namespace を作成する（`LINKS` / `SESSION`）
- [ ] **A-5** R2 バケット作成 + `img.toinoba.com` カスタムドメイン割り当て
- [ ] **A-6** `main` push で `deploy.yml` が成功することを確認する

## B. microCMS・Webhook

- [ ] **B-1** microCMS 本番 API を `docs/01-data-model.md` のスキーマで作成する
- [ ] **B-2** GitHub Secrets: `MICROCMS_SERVICE_DOMAIN` / `MICROCMS_API_KEY`
- [ ] **B-3** GitHub Variables: `CONTENT_SOURCE=microcms`（本番ビルド用）
- [ ] **B-4** Webhook プロキシ Worker をデプロイする（`worker/webhook-proxy/`）
  - Secrets: `MICROCMS_WEBHOOK_SECRET`, `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO`
- [ ] **B-5** microCMS Webhook URL にプロキシ Worker の URL を設定する
- [ ] **B-6** プレビュー URL を設定する: `https://toinoba.com/preview/?id={CONTENT_ID}&draftKey={DRAFT_KEY}`

## C. Phase 0（コンテンツ戦略）

- [ ] **C-1** ジャンル・編集方針を確定する
- [ ] **C-2** トピッククラスタ 12〜15 件を `src/config/clusters.ts` に定義する（`example-*` を差し替え）
- [ ] **C-3** 記事テンプレート見出しを `docs/05-content-templates.md` に具体化する
- [ ] **C-4** 提携 ASP と案件を `data/links.json` に投入する（ダミー URL を実案件に差し替え）
- [ ] **C-5** `src/config/site.ts` の Google フォーム URL を本番値に更新する
- [ ] **C-6** 記事コンテンツを microCMS に投入する（公開は人間が行う）

## D. 品質・公開

- [ ] **D-1** `npm run prelaunch -- --strict` が合格する
- [ ] **D-2** Lighthouse: 記事詳細で Performance 95+ / Accessibility 95+
- [ ] **D-3** `/go/{slug}` が 302 で正しい遷移先にリダイレクトする（本番 KV 同期後）
- [ ] **D-4** Search Console にプロパティ追加 + サイトマップ送信
- [ ] **D-5** GitHub Secrets: `GSC_SERVICE_ACCOUNT_JSON`（GSC レポート用）
- [ ] **D-6** **最後に** GitHub Variables: `PUBLIC_INDEXABLE=true` を設定する

## E. 任意・運用

- [ ] **E-1** GitHub Secrets: `ANTHROPIC_API_KEY`（AI 下書き生成を使う場合）
- [ ] **E-2** ブランド方向に沿った UI / 記事型の見直し（ComparisonTable 等）
- [ ] **E-3** `LAUNCH_STRICT=true` を CI で有効化する（Phase 0 完了後）

## 参照

- 公開手順の詳細: [`docs/07-launch-checklist.md`](07-launch-checklist.md)
- 開発計画: [`docs/06-development-plan.md`](06-development-plan.md)
