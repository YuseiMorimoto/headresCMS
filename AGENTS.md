# AGENTS.md

このリポジトリで作業するエージェント向けの不変ルール。
仕様の詳細は `docs/` を参照すること。矛盾する場合は本ファイルが優先される。

## 技術前提（違反しやすいので最優先で確認）

- **Astro 6.4 以上を使う。** Astro 5 以前の書き方を出力しない
  - コンテンツ定義は `src/content.config.ts`。`src/content/config.ts` は使わない
  - Content Collections ではなく Content Layer API の loader 方式を使う
- **Cloudflare Pages を使わない。** Workers + Static Assets で配信する
  - `wrangler.jsonc` の `assets` 設定を使う
  - Pages Functions / `functions/` ディレクトリ / Pages 向けアダプタ設定を作らない
- **Node.js 22.12 以上を前提にする**
- 学習データの記憶でバージョン固有の書き方を判断しない。**着手前に `package.json` と `node_modules` の実際のバージョンを確認する**
- 新しいライブラリを追加する前に、既存の依存で実現できないか検討し、追加理由を PR に書く

## 設計上の不変条件

- アフィリエイトの遷移先URLを記事本文・コンポーネント・リポジトリ内のどこにもハードコードしない。必ず `/go/{offerSlug}` を経由する
- 案件リンクには `rel="sponsored nofollow noopener"` を付ける
- 画像は Cloudflare R2 に置く。microCMS の画像フィールドを使わない
- `firsthand` フィールドは必須。空を許容するスキーマ変更をしない
- 記事を自動公開する処理を実装しない。自動化は下書き作成までで停止する
- ASP のサブIDパラメータ名を推測で埋めない。不明な場合は `null` のままにして PR で報告する
- サイト内の301リダイレクトは `_redirects`（Workers Static Assets の機能）で処理する。Worker コードで実装しない
- `public/_redirects` を直接編集しない。マスタは `data/redirects.json`、生成は `scripts/build-redirects.ts`
- お問い合わせフォームを自前実装しない。Googleフォームの埋め込みを使う
- 記事を削除・統合する変更では、同じ PR で `data/redirects.json` に301を追加する

## セキュリティ

- 秘匿値をコードに書かない。ローカルは `.dev.vars`、CI は GitHub Secrets、Worker は `wrangler secret`
- `.dev.vars` `.env` をコミットしない
- Worker で外部入力（URLパス、リファラ）を使う前に必ず正規表現で検証する
- リダイレクト先は https のみ許可する
- クリックログに IP・完全なUA・クエリ文字列を保存しない

## 作業の進め方

- **1 PR = 1 タスク。** 複数の docs にまたがる変更を1つの PR にまとめない
- 実装前に該当する `docs/` の受け入れ条件を読み、PR 説明にその項目をコピーしてチェックリストにする
- 仕様が曖昧・矛盾している場合は、推測で実装せず PR または Issue で確認する
- 既存ファイルを大幅に書き換える場合は、理由を PR に書く

## 完了の定義

以下を全て満たすまで「完了」と報告しない。

- [ ] `npx astro check` がエラーなし
- [ ] `npm run build` が成功
- [ ] 該当 docs の受け入れ条件を全て満たす
- [ ] 新規・変更したページで Lighthouse Performance 95以上（記事詳細ページの場合）
- [ ] 秘匿値・生成物・`node_modules` をコミットしていない

## コードスタイル

- TypeScript strict。`any` を使わない
- コンポーネントは `.astro` を優先。React などの UI フレームワークは、CSS で実現できない場合に限り使う
- 記事詳細ページのクライアント JavaScript は 0KB を目標とする
- コメントは「なぜ」を書く。「何を」はコードで表現する

## やらないこと

- Google Analytics 4 の導入
- 管理画面・ダッシュボードの実装
- ユーザー登録・コメント機能
- 多言語対応
- `Product` / `Review` の構造化データ出力
