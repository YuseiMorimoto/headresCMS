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
