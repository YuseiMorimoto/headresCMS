# 10. 要件対応表（A01: 既存機能との対応）

`docs/09-automation-requirements.md`（要件定義書 v1.0）の要件IDごとに、既存実装との対応を記録する。
調査日: 2026-09-12。対象コミット: `91e4e36`（main）。

状態の定義:

| 状態 | 意味 |
|---|---|
| 充足 | 既存コードで要件を満たす。再実装しない |
| 一部 | 土台はあるが要件の一部が欠ける。既存を拡張する |
| 未実装 | 対応するコードがない。新規実装する |
| 外部依存 | 運営者のアカウント・契約・承認が必要。コードでは代替しない |

## 既存資産の要約

| 資産 | 場所 | 要件との関係 |
|---|---|---|
| Astro 6 静的サイト（Workers + Static Assets） | `astro.config.mjs`, `wrangler.jsonc`, `src/pages/**` | 公開面。変更を最小にする（B02, T16） |
| `/go/{slug}` リダイレクタ + Workers KV + Analytics Engine | `src/lib/go-handler.ts`, `src/pages/go/[slug].ts`, `data/links.json`, `scripts/sync-links.ts` | F16, F17, F27 の自サイトクリック計測 |
| `/preview/`（microCMS 下書き SSR） | `src/pages/preview/index.astro`, `src/lib/microcms-preview.ts` | F21 のプレビュー土台。認証なし（N01 未充足） |
| コンテンツスキーマ（`firsthand` 必須） | `src/content.config.ts` | F13, F15 の構造的防御 |
| loader 抽象（microCMS / local） | `src/loaders/*` | A02 の入稿先切替の土台 |
| デプロイ CI（concurrency, 検証, KV 同期） | `.github/workflows/deploy.yml` | F24, F26（wrangler は成功時のみ反映） |
| Webhook 署名検証プロキシ | `worker/webhook-proxy/index.ts` | N03 の雛形 |
| AI 下書き生成 | `scripts/generate-draft.ts`, `.github/workflows/draft.yml` | F13 の雛形。構造検証・費用記録なし |
| GSC レポート / カニバリ検出 / リンク切れ検査 | `scripts/gsc-report.ts`, `scripts/cannibalization.ts`, `.github/workflows/linkcheck.yml`, `scripts/check-offers.ts` | F10, F11, F25, F27, F34 の部品 |
| NGワード検査 / 公開前検証 | `scripts/lint-content.ts`, `scripts/verify-content.ts`, `scripts/prelaunch-check.ts` | F15, F19 の部品 |
| 公開スイッチ `PUBLIC_INDEXABLE` | `src/config/launch.ts`, `scripts/build-robots.ts` | N05 の一部 |

## 1. 方針と完了条件（B）

| ID | 状態 | 根拠 | 不足・対応 |
|---|---|---|---|
| B01 | 外部依存 | `src/config/clusters.ts` は `example-*` のダミー。SaaS・業務課題は未選定 | 案件調査（F01〜F05）の結果を運営者が採用承認してから `clusters.ts` を差し替える |
| B02 | 充足 | 本リポジトリが既存 Cloudflare アプリ。ドメイン `toinoba.com`（`src/config/domain.ts`）。CMS は microCMS 想定だが未セットアップで `CONTENT_SOURCE=local` 稼働（`docs/08` B-1〜B-6 未完了） | Cloudflare 契約プラン（Free/Paid）は外部依存として確認する |
| B03 | 未実装 | 費用台帳・上限制御がない | O04〜O08 として新規実装 |
| B04 | 一部 | `draft.yml` は Draft PR 作成で停止。`deploy.yml` は main への push で公開 | 版にひも付く承認記録・再承認の仕組みがない（F22） |
| B05 | 未実装 | 週2本・修正2件・承認待ち5件の設定がない | `data/ops-settings.json`（Git で変更。画面は作らない） |
| B06 | 外部依存 | — | 申請文・入力案の生成は F01 の一部として実装 |

## 2. 既存アプリの調査と構成（A）

| ID | 状態 | 根拠 | 不足・対応 |
|---|---|---|---|
| A01 | 充足 | 本ドキュメント | — |
| A02 | 一部 | `generate-draft.ts` に local / microCMS の出力分岐が直書き。公開・状態照会・復元はない | `PublisherAdapter` インターフェースと Git 実装（第1）。microCMS 実装は段階3 |
| A03 | 一部 | Workers・KV・R2・Analytics Engine は既存。D1・Workflows・Cron はない | 運営 Worker（`worker/ops`）に D1 + Workflows + Cron を新設 |
| A04 | 未実装 | 全自動化が GitHub Actions の単発スクリプト。工程永続化・再開なし | Workflows の `step.do` で工程単位に永続化。ジョブ履歴は D1 に一元化 |
| A05 | 一部 | CMS は loader で交換可能。AI は Anthropic SDK 直呼び。検索・ASP の抽象なし | `AiProvider` / `SearchProvider` / `AspConnector` / `PublisherAdapter` の4インターフェース |

## 3. 案件調査と商品管理（F01〜F07）

| ID | 状態 | 根拠 | 不足・対応 |
|---|---|---|---|
| F01 | 未実装 | `data/links.json` の `note` に運用メモがあるだけ | `Program` テーブル + 出典 URL・確認日時 |
| F02 | 未実装 | — | `Capability` テーブル（ネットワーク単位／案件単位、確認済み／未確認／非対応） |
| F03 | 未実装 | — | 採用条件チェックを `Program` 状態遷移のガードとして実装 |
| F04 | 未実装 | — | 固定報酬／継続報酬を分離して保持。最低報酬額は設定項目（既定 null） |
| F05 | 未実装 | — | 候補評価レポート（推測と実測を別カラムで保持） |
| F06 | 一部 | `links.json` の `active: false` + `fallbackPath` で終了案件を無効化できる | 8状態の状態機械と確認期限。`active` は「運用可能」状態から導出する |
| F07 | 未実装 | — | `Plan` 正規化 + 料金計算関数（人数別・年払総額・通貨・換算日） |

## 4. 情報収集と記事企画（F08〜F12）

| ID | 状態 | 根拠 | 不足・対応 |
|---|---|---|---|
| F08 | 未実装 | — | 許可ドメイン制の取得器 + `Source`（抜粋・ハッシュ・確認日）。失敗は「未確認」扱い |
| F09 | 未実装 | — | `Claim` + 記事依存関係。矛盾時は保留 |
| F10 | 一部 | `gsc-report.ts` がリライト／新規候補を抽出、`cannibalization.ts` がキーワード重複を検出 | 週次企画 Workflow（最大10候補→2本）。重複判定に既存ロジックを再利用 |
| F11 | 一部 | `gsc-report.ts` が GSC を取得し `data/gsc/` に保存 | `SearchProvider` として抽象化。GSC を市場ボリュームと混同しない表示 |
| F12 | 一部 | 記事型は `comparison` / `review` / `guide` の3種（`docs/05`「増やさない」） | 要件の5種別は企画テンプレート（`topicTemplate`）として3型にマップする。**要確認事項 R3** |

## 5. 記事作成と広告リンク（F13〜F18）

| ID | 状態 | 根拠 | 不足・対応 |
|---|---|---|---|
| F13 | 一部 | `generate-draft.ts` がテンプレート（`docs/05`）に沿って本文を生成 | 出典・確認日・比較表・向く人／向かない人を構造化出力に含める |
| F14 | 未実装 | 生成結果を文字列として保存するだけ。プロンプト・モデル・費用の記録なし | zod スキーマで検証。`GenerationRun` にプロンプト／モデル／トークン／費用を保存 |
| F15 | 一部 | `lint-content.ts` の NGワード。`firsthand` は AI が生成しない | 創作禁止語（口コミ・事例・最安・ランキング）と使用経験表現の検品ルール。**要確認事項 R2** |
| F16 | 一部 | 本文は `/go/{slug}` のみ。`subIdParam` は `null` 既定で推測しない（`AGENTS.md`） | `AffiliateLink`（案件・記事・掲載位置・版）。AI は商品IDと位置のみ出力 |
| F17 | 一部 | `OfferButton.astro` が `rel="sponsored nofollow noopener"`。`PrNotice` は常時表示 | 媒体・ドメイン・ディープリンク可否の確認記録。クリック計測のボット除外。**要確認事項 R4** |
| F18 | 一部 | `related.ts` が noindex 除外。canonical / sitemap は既存 | 内部リンク候補を「公開済み」に限定。`/preview/` の認証保護（N01） |

## 6. 検品と承認公開（F19〜F26）

| ID | 状態 | 根拠 | 不足・対応 |
|---|---|---|---|
| F19 | 一部 | `lint-content.ts`、`verify-content.ts`（PR表記・URL直書き検査）、zod スキーマ | 根拠対応・数値再計算・鮮度・HTML 安全性・重複の検品器。AI 自己採点を合格条件にしない |
| F20 | 未実装 | — | 鮮度閾値（料金7日／他30日）を設定化。公開直前の再確認 |
| F21 | 一部 | `/preview/` は microCMS の draftKey 前提。認証なし | Draft PR の差分 + `/preview/?v=`（共有トークン必須）。独自運営画面は作らない |
| F22 | 未実装 | — | `Approval`（記事ID・版ID・本文ハッシュ・商品情報版・リンク版） |
| F23 | 未実装 | — | 記事状態機械（9状態 + 保留／却下／失敗） |
| F24 | 一部 | `deploy.yml` の `concurrency` で多重デプロイを抑止 | 公開キーによる冪等化。公開先の状態照会（コミット SHA → デプロイ → 公開URLの版確認） |
| F25 | 一部 | `linkcheck.yml` + `check-offers.ts` が遷移先の 404 を Issue 化。`active: false` は手動 | 影響記事の特定・撤去案・一括停止操作・監査記録 |
| F26 | 一部 | `wrangler deploy` は成功時のみ反映。Git 履歴で旧版が残る | 復元操作（明示操作・警告）と権限検証 |

## 7. 成果計測と自動改善（F27〜F34）

| ID | 状態 | 根拠 | 不足・対応 |
|---|---|---|---|
| F27 | 一部 | 自サイトクリックは Analytics Engine（記事別）、GSC は `gsc-report.ts` | ASP 成果の取得。3データ源を別テーブルで保持。帰属不明は「記事不明」 |
| F28 | 未実装 | — | `Conversion`（原ID一意・元状態・正規化状態・最小通貨単位整数） |
| F29 | 未実装 | — | 日次同期（ページング・カーソル・90日再照合・JST 変換） |
| F30 | 未実装 | — | 同期状態（最終成功・対象期間・件数）と欠損表示 |
| F31 | 未実装 | — | KPI 計算（EPC は分母ゼロで未算出、原通貨保持） |
| F32 | 一部 | `gsc-report.yml` が週次 Issue を作成 | 週次レポート（前期間差・充足度・次の行動3件） |
| F33 | 未実装 | — | 方向転換抑制（28日・100クリック）を設定化 |
| F34 | 一部 | GSC レポートの4分類が改善候補に相当 | 修正版を自動作成して承認待ちへ。採用・市場・予算は変更しない |

## 8. 自動実行と費用制御（O01〜O09）

| ID | 状態 | 根拠 | 不足・対応 |
|---|---|---|---|
| O01 | 一部 | Actions cron: GSC 月曜06:00 JST、linkcheck 土曜、cannibalization 月1、export 日曜 | Asia/Tokyo のスケジュールテーブル + 毎時 Cron で判定（画面から変更可、再起動時のまとめ実行を抑制） |
| O02 | 未実装 | — | `Job` テーブル（工程・入力版・進捗・試行・費用予約） |
| O03 | 未実装 | Actions に再試行なし | Workflows の `retries`（指数バックオフ・最大2回）。認証失効は要対応に分類 |
| O04 | 未実装 | — | `CostLedger`（固定費予約・実消費・予備費500円・JST 暦月） |
| O05 | 未実装 | — | 予約 API（D1 の条件付き UPDATE で一貫性確保、1記事200円上限） |
| O06 | 未実装 | — | 80% 通知・90% 停止。監視・同期・固定費を優先確保 |
| O07 | 未実装 | — | 単価表（モデル・為替・安全率・確認日時）。実請求との照合は手入力欄 |
| O08 | 一部 | `gsc-report.ts` は1日1回制限 | キャッシュ・差分取得・軽量モデル選択 |
| O09 | 一部 | GitHub Issue / Actions 通知 | GitHub Issue を標準通知とする。外部通知は設定された宛先のみ |

## 9. 管理画面とデータ要件（§10, D01〜D06）

| ID | 状態 | 根拠 | 不足・対応 |
|---|---|---|---|
| §10 画面 | 対象外 | 運営者が運営画面は不要と判断（2026-09-12） | Draft PR（承認待ち・差分・検品結果）と Issue（今日の操作・要対応・週次）で代替。独自 UI は作らない |
| D01 | 一部 | `links.json` の `asp` / `active` / `note` | `Program` / `Capability` |
| D02 | 未実装 | — | `Product` / `Plan` / `Source` / `Claim` |
| D03 | 一部 | 記事本体は `content/posts/**.md`（Git 履歴が版） | `Topic` / `Article` / `ArticleVersion`（D1）と Git コミットを相互参照 |
| D04 | 一部 | `links.json` → KV `link:{slug}` | `AffiliateLink` / `Approval` |
| D05 | 一部 | Analytics Engine（クリック）、`data/gsc/*.json` | `ClickAggregate` / `Conversion` / `SearchMetric` |
| D06 | 未実装 | — | `Job` / `CostLedger` / `AuditEvent` |
| 保持方針 | 未実装 | — | 保持期間テーブル + 日次クリーンアップ |

## 10. 安全性と運用保守（N01〜N07）

| ID | 状態 | 根拠 | 不足・対応 |
|---|---|---|---|
| N01 | 一部 | 秘匿値は Secrets / `.dev.vars`（`AGENTS.md`）。`/preview/` は draftKey のみで認証なし | `/preview/?v=` は `PREVIEW_TOKEN` を正規表現検証してから版データを返す。管理 API は `OPS_TRIGGER_SECRET` |
| N02 | 一部 | slug 正規表現、https のみ許可（`go-handler.ts`） | 取得先の許可ドメイン・プライベートIP拒否。生成 HTML の許可リスト型サニタイズ。外部資料はデータとして扱う |
| N03 | 一部 | `webhook-proxy` が HMAC 署名を検証 | 重複・再送処理（イベントID一意）。管理 API のレート制限 |
| N04 | 一部 | クリックログに IP・完全UA・クエリを保存しない。`PrNotice` 常時表示 | 案件別の広告表記・素材条件を検品に反映。プライバシーポリシー更新 |
| N05 | 一部 | `PUBLIC_INDEXABLE` 公開スイッチ | 自動化停止スイッチ、案件単位停止、`--env staging`、DB 移行前バックアップ |
| N06 | 未実装 | 記事は Git にあるため復元可能。D1 は未導入 | D1 の日次エクスポート（R2）と復元手順・試験 |
| N07 | 充足 | AI は Draft PR / 下書きを作るだけ。デプロイは `deploy.yml` 経由 | 運営 Worker の GitHub トークンは `contents:write` のみ（`workflows` 権限なし）。`content/` `data/links.json` 以外の変更を CI で拒否する |

## 11. 候補サービス（§12）

| サービス | 状態 | 対応 |
|---|---|---|
| impact.com | 外部依存 | 接続実証の第1候補。`AspConnector` の実コネクター |
| PartnerStack | 外部依存 | インターフェースのみ定義。採用案件が決まるまで未実装と明示 |
| バリューコマース | 外部依存 | 同上。`verify-content.ts` のホストパターンには既出 |
| Strackr | 対象外 | 予算制約で初期不採用（将来比較） |
| A8.net 他 | 対象外 | F01〜F06 の確認を経るまで未検証 |

## 要確認事項（推測で実装しない項目）

| ID | 内容 | 影響 | 仮の前提（承認待ち） |
|---|---|---|---|
| R1 | `AGENTS.md`「やらないこと: 管理画面」と §10 の運営画面必須が矛盾 | 段階1以降 | **確定: 運営画面は作らない。** GitHub Draft PR / Issue で代替 |
| R2 | `firsthand` 必須（AI 生成禁止）と T17「運営者が文章を書かない」が両立しない | F13, F15 | プログラムが公式資料から計算した料金シミュレーション・比較結果（出典・確認日付き）を `firsthand` に入れる。AI は関与しない |
| R3 | `docs/05`「記事型は3種のみ。増やさない」と F12 の5種別 | F10, F12, F13 | 5種別は企画テンプレートとして `comparison` / `guide` にマップし、レンダリング型は増やさない |
| R4 | F17「計測を壊す独自リダイレクトは既定で導入しない」と `/go/{slug}` 必須（`AGENTS.md`） | F16, F17 | `/go/` は ASP の正式 URL をそのまま 302 で返すため計測を壊さない。維持する |
| R5 | `AGENTS.md`「自動化は下書き作成までで停止する」と承認公開 | F23, F24 | **確定: 公開は運営者の Draft PR マージでのみ行う。** 文言を改訂済み |
| R6 | Cloudflare 契約プランが未確認。Free は CPU 10ms・サブリクエスト50・Cron 5本・Workflows 状態保持3日 | 費用・A04 | Workers Paid（$5/月）を予算に計上する前提。現プランは運営者に確認 |
| R7 | `docs/01`「KV を手編集しない（Git で差分を追う）」と D1 をリンクのマスタにする案 | F16, D04 | リンクの正本は D1 とし、公開時に `data/links.json` へ書き出してコミットする（Git 差分と KV 同期は既存フローを維持） |
| R8 | microCMS Hobby の API 数上限と Management API 書込可否 | A02（microCMS 実装時） | 段階3 で確認。段階1は Git 入稿で進める |
