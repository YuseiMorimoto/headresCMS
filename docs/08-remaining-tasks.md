# 08. 残タスク

最終更新: 2026-08-15（PR #16・#17 マージ後）

コード基盤（Phase 1〜5 + 公開スイッチ + Webhook CI）は **main に反映済み**。
以下は**あなたが手動で行う作業**のみ。チェックを付けながら進めてください。

> 進捗確認: `npm run prelaunch`（警告モード） / `npm run prelaunch -- --strict`（Phase 0 完了後）

---

## コード側（完了済み・対応不要）

- [x] サイト基盤・ページ・Worker・CI/CD（PR #2〜#15）
- [x] 本番ドメイン `toinoba.com` のコード反映（`src/config/domain.ts`）
- [x] 公開スイッチ `PUBLIC_INDEXABLE`（既定=非公開、noindex + Disallow:/）
- [x] デプロイ CI の設定漏れ検知（KV ID / `CLOUDFLARE_API_TOKEN`）
- [x] Webhook プロキシ Worker + `deploy-webhook-proxy.yml`（Secrets 設定後に自動デプロイ）
- [x] サイト名・キャッチコピー・トップ/運営者情報のブランド文言
- [x] README / 公開チェックリスト（`docs/07-launch-checklist.md`）

---

## 公開までに必要（人間作業）

### A. Cloudflare・GitHub（インフラ）

- [x] **A-1** ドメイン取得（`toinoba.com`）
- [ ] **A-2** Cloudflare で KV namespace を作成（`LINKS` / `SESSION`）
- [ ] **A-3** GitHub Variables: `KV_NAMESPACE_ID`（任意: `SESSION_KV_NAMESPACE_ID`）
- [ ] **A-4** GitHub Secrets: `CLOUDFLARE_API_TOKEN`
- [ ] **A-5** R2 バケット作成 + `img.toinoba.com` を割り当て
- [ ] **A-6** `main` push で `deploy.yml` が成功することを確認

### B. microCMS 連携

- [ ] **B-1** microCMS 本番 API を `docs/01-data-model.md` のスキーマで作成
- [ ] **B-2** GitHub Secrets: `MICROCMS_SERVICE_DOMAIN` / `MICROCMS_API_KEY`
- [ ] **B-3** GitHub Variables: `CONTENT_SOURCE=microcms`
- [ ] **B-4** GitHub Secrets: `MICROCMS_WEBHOOK_SECRET` / `GITHUB_DISPATCH_TOKEN` を設定し、Webhook プロキシ Worker の初回デプロイを確認
- [ ] **B-5** microCMS の Webhook URL にプロキシ Worker の URL を設定
- [ ] **B-6** microCMS のプレビュー URL を設定  
  `https://toinoba.com/preview/?id={CONTENT_ID}&draftKey={DRAFT_KEY}`

### C. コンテンツ（Phase 0）

- [ ] **C-1** ジャンル・編集方針を確定
- [ ] **C-2** クラスタ 12〜15 件を `src/config/clusters.ts` に定義（`example-*` を差し替え）
- [ ] **C-3** 提携 ASP と案件を `data/links.json` に投入（ダミー URL を実案件に差し替え）
- [ ] **C-4** `src/config/site.ts` の Google フォーム URL を本番値に更新
- [ ] **C-5** 記事を microCMS に投入（**公開ボタンは人間が押す**）

### D. 公開前確認 → 公開

- [ ] **D-1** `npm run sync-links` で KV に案件データを同期
- [ ] **D-2** `npm run prelaunch -- --strict` が合格
- [ ] **D-3** 本番で `/go/{slug}` が 302 で正しい遷移先へリダイレクト
- [ ] **D-4** Search Console にプロパティ追加 + サイトマップ送信
- [ ] **D-5** **最後に** GitHub Variables: `PUBLIC_INDEXABLE=true`

---

## 任意（運用開始後で可）

- [ ] AI 下書き生成を使う → GitHub Secrets: `ANTHROPIC_API_KEY`
- [ ] GSC 週次レポートを使う → GitHub Secrets: `GSC_SERVICE_ACCOUNT_JSON` + Search Console 権限付与
- [ ] 記事型 UI の見直し（ComparisonTable 等）→ Phase 0 のクラスタ・記事型確定後
- [ ] 記事テンプレート見出しの具体化 → `docs/05-content-templates.md`（下書き生成精度を上げたい場合）

---

## 残り件数（目安）

| 区分 | 未完了 |
|---|---|
| A. インフラ | 5 / 6 |
| B. microCMS | 6 / 6 |
| C. コンテンツ | 5 / 5 |
| D. 公開 | 5 / 5 |
| **合計（必須）** | **21 件** |

---

## 参照

- 公開手順の詳細: [`docs/07-launch-checklist.md`](07-launch-checklist.md)
- 開発計画: [`docs/06-development-plan.md`](06-development-plan.md)
