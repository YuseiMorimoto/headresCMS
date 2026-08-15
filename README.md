# 問いの場（toinoba.com）

「答えではなく、問いを。」をコンセプトにした知のプラットフォーム。
Astro 6 + Cloudflare Workers + Static Assets で配信する。

本番ドメイン: **https://toinoba.com**（既定値は `src/config/domain.ts`）

## 開発

```bash
cp .dev.vars.example .dev.vars
npm install
CONTENT_SOURCE=local npm run dev
```

## ビルド

```bash
CONTENT_SOURCE=local npm run build
npx wrangler dev   # Worker + 静的アセットのローカル確認（:8787）
```

## プレビュー

microCMS の下書きを確認する SSR ルートです。

```
/preview/?id={contentId}&draftKey={draftKey}
```

- `noindex` が出力されます（検索エンジンにインデックスされません）
- microCMS の API キーが `.dev.vars` に設定されている必要があります

## 公開スイッチ

`PUBLIC_INDEXABLE` が `true` でない限り、サイトは**検索エンジンに公開されません**。

| 状態 | robots.txt | 全ページの meta robots |
|---|---|---|
| 既定（未設定） | `Disallow: /` | `noindex,nofollow` |
| `PUBLIC_INDEXABLE=true` | `Allow: /` + Sitemap | 出力しない（`/contact/` `/404` を除く） |

Phase 0（クラスタ・記事・案件）が未確定のままインデックスされると、新規ドメインにダミー内容が登録されるため、
**公開準備が完了してから最後に** `PUBLIC_INDEXABLE=true` を設定してください。

詳細: [`docs/07-launch-checklist.md`](docs/07-launch-checklist.md)

## 自動化ワークフロー

| ワークフロー | トリガ | 内容 |
|---|---|---|
| `deploy.yml` | push(main) / content-published | 本番デプロイ |
| `linkcheck.yml` | 毎週土曜 03:00 JST | lychee + 案件URL疎通確認 → Issue |
| `gsc-report.yml` | 毎週月曜 06:00 JST | GSCリライト候補レポート → Issue |
| `cannibalization.yml` | 毎月1日 06:00 JST | キーワード重複検出 → Issue |
| `draft.yml` | 手動 | AI下書き生成 → Draft PR |
| `export.yml` | 毎週日曜 04:00 JST | CMS → Markdown エクスポート |

### ローカル実行

```bash
npm run check-offers      # 案件URL疎通確認
npm run cannibalization   # キーワード重複レポート生成
npm run gsc-report        # GSCデータ取得（要 GSC_SERVICE_ACCOUNT_JSON）
npm run generate-draft -- --title "..." --keywords "kw1,kw2" --type review --cluster example-a
```

## 公開準備

本番公開前は `docs/07-launch-checklist.md` と `docs/08-remaining-tasks.md` を参照してください。

```bash
npm run prelaunch          # 公開前チェック（警告モード）
npm run prelaunch -- --strict  # ダミーデータ残存で失敗
npm run sync-links -- --dry-run  # KV同期の検証のみ
```

## 仕様

`docs/` フォルダに仕様書を配置。エージェント向けルールは `AGENTS.md` を参照。

## 環境変数

### ローカル（`.dev.vars`）

| 変数 | 用途 | 必須 |
|---|---|---|
| `CONTENT_SOURCE` | `local` または `microcms` | ローカル開発時は `local` |
| `MICROCMS_SERVICE_DOMAIN` | CMS接続 | microCMS 利用時 |
| `MICROCMS_API_KEY` | CMS APIキー | microCMS 利用時 |
| `PUBLIC_SITE_URL` | canonical / OGP | 省略可（既定: `https://toinoba.com`） |
| `PUBLIC_IMAGE_BASE` | R2 画像ドメイン | 省略可（既定: `https://img.toinoba.com`） |
| `PUBLIC_INDEXABLE` | 検索エンジン公開 | 省略可（既定: 非公開） |
| `CLOUDFLARE_API_TOKEN` | KV同期・デプロイ | sync-links / deploy 時 |
| `KV_NAMESPACE_ID` | LINKS KV の ID | sync-links 時 |

### GitHub Actions

**Secrets**

| 名前 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | デプロイ・KV同期 |
| `MICROCMS_SERVICE_DOMAIN` | CMS接続 |
| `MICROCMS_API_KEY` | CMS接続 |
| `GSC_SERVICE_ACCOUNT_JSON` | GSCレポート |
| `ANTHROPIC_API_KEY` | 下書き生成 |

**Variables**

| 名前 | 用途 | 既定 |
|---|---|---|
| `KV_NAMESPACE_ID` | LINKS KV の ID | 未設定時はデプロイ失敗 |
| `SESSION_KV_NAMESPACE_ID` | セッション KV の ID | 省略時は `KV_NAMESPACE_ID` を流用 |
| `CONTENT_SOURCE` | ビルド時の CMS ソース | `local` |
| `PUBLIC_SITE_URL` | canonical / OGP | `src/config/domain.ts` の既定値 |
| `PUBLIC_IMAGE_BASE` | R2 画像ドメイン | `src/config/domain.ts` の既定値 |
| `PUBLIC_INDEXABLE` | 検索エンジン公開 | 未設定 = 非公開 |
| `LAUNCH_STRICT` | `true` で prelaunch を strict 実行 | 未設定 = 警告モード |
