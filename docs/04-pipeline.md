# 04. 自動化パイプライン仕様

## 原則

**公開操作は必ず人間が行う。** どのワークフローも下書き作成またはレポート生成までで停止する。
自動 merge・自動 publish は実装しない。

## ワークフロー一覧

| ID | ファイル | トリガ | 出力 |
|---|---|---|---|
| W1 | `deploy.yml` | push(main) / repository_dispatch | 本番デプロイ |
| W2 | `gsc-report.yml` | 毎週月曜 06:00 JST | リライト候補レポート（Issue） |
| W3 | `draft.yml` | 手動 / W2 から起動 | 下書き生成（PR or CMS下書き） |
| W4 | `linkcheck.yml` | 毎週土曜 03:00 JST | リンク切れレポート（Issue） |
| W5 | `cannibalization.yml` | 毎月1日 | キーワード重複レポート（Issue） |
| W6 | `export.yml` | 毎週日曜 04:00 JST / 手動 | 全記事のMarkdownエクスポート（コミット） |

## W1: deploy.yml

```yaml
name: deploy
on:
  push:
    branches: [main]
  repository_dispatch:
    types: [content-published]
jobs:
  deploy:
    runs-on: ubuntu-latest
    concurrency:
      group: deploy
      cancel-in-progress: true
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: '22.12'
          cache: npm
      - run: npm ci
      - run: npx astro check
      - run: npm run build
        env:
          MICROCMS_SERVICE_DOMAIN: ${{ secrets.MICROCMS_SERVICE_DOMAIN }}
          MICROCMS_API_KEY: ${{ secrets.MICROCMS_API_KEY }}
          PUBLIC_SITE_URL: ${{ vars.PUBLIC_SITE_URL }}
          PUBLIC_IMAGE_BASE: ${{ vars.PUBLIC_IMAGE_BASE }}
      - run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

要件:
- `concurrency` で同時デプロイを防ぐ（CMSの連続更新でビルドが多重起動するため）
- microCMS の Webhook は `repository_dispatch` を叩く。**Webhook 署名を検証するプロキシ Worker を経由させる**（GitHub のトークンを microCMS の管理画面に直接置かない）
- ビルド失敗時は前回のデプロイを維持する（wrangler は成功時のみ反映されるので追加実装は不要）

## W2: gsc-report.yml

Search Console API から直近28日のデータを取得し、以下を抽出して Issue を作る。

| 分類 | 抽出条件 | アクション |
|---|---|---|
| あと一歩 | 平均掲載順位 11〜30位、表示回数 100以上 | 既存記事のリライト |
| CTR不足 | 平均掲載順位 1〜10位、CTR が順位別中央値の60%未満 | title / description の改善 |
| 未カバー | 表示はあるが対応記事がないクエリ | 新規記事の候補 |
| 下落 | 前28日比で順位が5以上下落 | 要調査 |

出力形式: 1 Issue に上位20件をチェックリストで列挙。ラベル `rewrite` / `new-article`。

**API の割当を考慮して1日1回以上は叩かない。** 取得結果は `data/gsc/{YYYY-MM-DD}.json` としてコミットし、前週比較の元データにする。

## W3: draft.yml

入力: 記事タイトル、targetKeywords、articleType、cluster、参考URL（任意）

処理:
1. 同一クラスタの既存記事一覧を取得（重複回避のコンテキストとして渡す）
2. `articleType` に対応するテンプレート（`docs/05-content-templates.md`）をプロンプトに含める
3. 本文を生成
4. **`firsthand` は生成しない。** 空欄のまま出力し、PR本文に「一次情報の記入が必要」と明記する
5. 出力先
   - `CONTENT_SOURCE=local` の場合: ブランチを切って Markdown を追加し、Draft PR を作成
   - `CONTENT_SOURCE=microcms` の場合: 下書きステータスで API 投稿し、Issue にリンクを残す

PR テンプレートのチェック項目:

```
- [ ] firsthand（一次情報）を記入した
- [ ] 事実・数値を一次ソースで確認した
- [ ] offers の slug が KV に存在する
- [ ] 同一クラスタの既存記事とカニバっていない
- [ ] 薬機法・景表法に触れる表現がない
```

## W4: linkcheck.yml

- `lychee` で `dist/` 内の全リンクを検査
- **`/go/` は Worker 経由なので、KV の `url` を別途直接検査する**（`scripts/check-offers.ts`）
- 404 / 410 / ドメイン失効を検知したら Issue を作成し、該当 offerSlug を列挙
- 検知した案件は `active: false` に落とす作業を手動で行う（自動で落とさない）

## W5: cannibalization.yml

- 全記事の `targetKeywords` を突き合わせ、完全一致・部分一致の重複を検出
- GSC データで「同一クエリに対して複数URLが表示されている」ケースを抽出
- 統合候補として Issue 化

300記事規模ではこれが最も効く。100記事を超えたら必ず有効化する。

## W6: export.yml

CMS へのロックインを解除するための保険。**Phase 1 で実装する**（後回しにしない）。

`scripts/export-content.ts` が CMS の全記事を取得し、`content/posts/{cluster}/{slug}.md` として書き出す。

出力形式は frontmatter + 本文の Markdown とし、**そのまま `CONTENT_SOURCE=local` でビルドできる状態**にする。

```md
---
id: example-slug
title: 記事タイトル
description: 説明文
cluster: example-a
articleType: comparison
isPillar: false
targetKeywords: ["キーワード1", "キーワード2"]
publishedAt: 2026-09-01T00:00:00Z
updatedAt: 2026-09-15T00:00:00Z
heroImage:
  url: https://img.example.com/xxx.webp
  width: 1200
  height: 630
  alt: 代替テキスト
offers:
  - slug: offer-a
    label: 公式サイトを見る
firsthand: |
  一次情報の本文
noindex: false
---

本文（HTML から Markdown へ変換）
```

要件:

- リッチエディタの HTML を Markdown へ変換する（`turndown` 等）
- 変換で情報が落ちる要素（テーブル、カスタムブロック）は HTML のまま残す
- 差分があった場合のみコミットする
- **エクスポート結果でビルドが通ることを CI で検証する**（`CONTENT_SOURCE=local npm run build`）。ここまでやらないと保険として機能しない
- 画像は R2 にあるため、URL参照のまま。ファイルの複製はしない

このワークフローが緑である限り、CMS が停止しても `CONTENT_SOURCE=local` に切り替えるだけでサイトを維持できる。

## 通知

Issue 作成時に GitHub の通知で足りる。Slack 連携は必要になってから追加する。
ビルド失敗は GitHub の標準通知で検知する。外部通知は今回実装しない。

## 受け入れ条件

- [ ] W1 が push で発火し、5分以内にデプロイが完了する
- [ ] W1 が同時実行されない
- [ ] W2 が Issue を作成し、4分類が含まれている
- [ ] W3 が Draft PR を作り、`firsthand` が空であることが PR 本文に明示される
- [ ] W3 が生成した記事が `astro check` を通る（スキーマ違反で落ちない）
- [ ] W4 が KV の遷移先URLも検査対象に含む
- [ ] W6 が全記事を Markdown として書き出す
- [ ] W6 の出力で `CONTENT_SOURCE=local npm run build` が成功する
- [ ] いずれのワークフローも記事を自動公開しない
