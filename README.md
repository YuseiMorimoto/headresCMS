# アフィリエイトメディア

検索流入を主軸としたアフィリエイトメディア。Astro 6 + Cloudflare Workers + Static Assets で配信。

## 開発

```bash
cp .dev.vars.example .dev.vars
npm install
CONTENT_SOURCE=local npm run dev
```

## ビルド

```bash
CONTENT_SOURCE=local npm run build
npx wrangler dev   # Worker + 静的アセットのローカル確認
```

## プレビュー

microCMS の下書きを確認する SSR ルートです。

```
/preview/?id={contentId}&draftKey={draftKey}
```

- `noindex` が出力されます（検索エンジンにインデックスされません）
- microCMS の API キーが `.dev.vars` に設定されている必要があります

## 自動化ワークフロー

| ワークフロー | トリガ | 内容 |
|---|---|---|
| `deploy.yml` | push(main) / content-published | 本番デプロイ |
| `deploy-webhook-proxy.yml` | push(main, webhook-proxy 変更) / 手動 | microCMS Webhook プロキシ Worker デプロイ |
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

本番公開前は `docs/07-launch-checklist.md` を参照してください。

```bash
npm run prelaunch          # 公開前チェック（警告モード）
npm run prelaunch -- --strict  # ダミーデータ残存で失敗
npm run sync-links -- --dry-run  # KV同期の検証のみ
```

## 仕様

`docs/` フォルダに仕様書を配置。エージェント向けルールは `AGENTS.md` を参照。

## 環境変数

| 変数 | 用途 |
|---|---|
| `CONTENT_SOURCE` | `local` または `microcms` |
| `PUBLIC_SITE_URL` | canonical / OGP |
| `PUBLIC_IMAGE_BASE` | R2 画像ドメイン |
| `MICROCMS_SERVICE_DOMAIN` | CMS接続（microCMS時） |
| `MICROCMS_API_KEY` | CMS APIキー（microCMS時） |
