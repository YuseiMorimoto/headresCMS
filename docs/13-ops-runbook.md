# 13. 運営手順

運営画面は作らない。日常操作は GitHub の Draft PR と Issue。

## 初期設定

詳細な操作手順（D1 / R2 / 秘密値 / impact.com）: [`docs/15-ops-initial-setup.md`](15-ops-initial-setup.md)  
コピー用全文: [`docs/15-ops-initial-setup.copy.txt`](15-ops-initial-setup.copy.txt)（GitHub の Copy raw file / Raw → 全選択）

1. Cloudflare で D1 `toinoba-ops` と R2 `toinoba-ops` を作る
2. GitHub Variables に `OPS_D1_ID` を入れる
3. `wrangler secret put OPS_TRIGGER_SECRET` / `PREVIEW_TOKEN`（16文字以上の英数と `_` `-`）
4. 既存固定費を `data/ops-settings.json` の `fixedCosts` に書く。空のままだと有料生成は開始しない。書き方は [`docs/15` §4](15-ops-initial-setup.md)
5. 採用案件が決まるまで ASP 資格は入れなくてよい。モックで試験する

## 通常運用

| やりたいこと | 操作 |
|---|---|
| 今日の操作を見る | ラベル `ops-action` の Issue |
| 下書きを承認して公開する | Draft PR をレビューしてマージ（`deploy.yml` が公開） |
| 修正依頼 | PR に理由を書いて `needs-fix` ラベル |
| 保留 / 却下 | `held` / `rejected` ラベル。マージしない |
| 週次結果 | `weekly-report` Issue |
| 設定変更（本数・時刻・予算） | `data/ops-settings.json` の PR |

自動化は下書き（Draft PR）まで。公開はマージだけがトリガーになる。

## 停止

- 緊急停止: `data/ops-settings.json` の `automationEnabled` を `false` にするか、Worker に `AUTOMATION_DISABLED=1`
- 案件停止: `data/links.json` の `active` を `false`（公開本文の無承認書き換えはしない）
- 公開サイトは停止しても閲覧できる

## 復旧

1. D1: `wrangler d1 export` の成果物（`backup-d1.yml`）を staging へ `d1 execute --file`
2. 記事: Git の該当コミットへ戻す PR。最新の商品条件と矛盾する場合は PR 本文に警告を書く
3. ASP 再認証: secret を更新し、失敗ジョブの Issue から同じ `idempotencyKey` で再開（成功済みの有料工程は再実行しない）

目標は最大24時間分の損失以内、対応開始から4時間以内に手順を開始できること。外部障害の復旧時間は保証しない。

## 環境変数（秘匿値は書かない）

| 名前 | 用途 |
|---|---|
| `OPS_TRIGGER_SECRET` | ops Worker のジョブ起動 |
| `PREVIEW_TOKEN` | `/preview/?v=` |
| `OPS_D1_ID` | D1 データベース ID |
| `ANTHROPIC_API_KEY` | 生成（既存） |
| `IMPACT_ACCOUNT_SID` / `IMPACT_AUTH_TOKEN` | impact.com（未設定ならコネクターは未実装扱い） |
| `GSC_SERVICE_ACCOUNT_JSON` | 検索実績（既存） |
| `GITHUB_CONTENT_TOKEN` | 下書きコミット用。`contents:write` のみ。`workflows` 権限は付けない |
