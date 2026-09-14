# 15. ops 初期設定の操作手順

**コピーする:** 全文は [`15-ops-initial-setup.copy.txt`](15-ops-initial-setup.copy.txt)。GitHub ならファイル右上の **Copy raw file**、または **Raw** を開いて全選択。秘密値はコピー文に書いていない。

対象ブランチ: `cursor/automation-ops-core-5354`  
根拠: [`worker/ops/wrangler.jsonc`](../worker/ops/wrangler.jsonc)、[`.github/workflows/deploy-ops.yml`](../.github/workflows/deploy-ops.yml)、[`src/ops/auth.ts`](../src/ops/auth.ts)、[`src/ops/connectors/asp.ts`](../src/ops/connectors/asp.ts)、[`src/pages/preview/index.astro`](../src/pages/preview/index.astro)、[`data/ops-settings.json`](../data/ops-settings.json)

日常運用・停止・復旧は [`docs/13-ops-runbook.md`](13-ops-runbook.md)。接続の実装状態は [`docs/12-connection-matrix.md`](12-connection-matrix.md)。別AIへの引き継ぎ文は [`docs/14-operator-handoff-prompt.md`](14-operator-handoff-prompt.md)。

秘密値（トークン・APIキー）をこの文書・チャット・Issue・コミットに書かない。

`deploy-ops.yml` は `main` への push または手動実行（`workflow_dispatch`）で動く。ワークフローファイルがまだ `main` に無い間は、GitHub Actions からはデプロイできず、この文書のローカル wrangler 手順を使う。

## この文書でやること

| 順 | 作業 | 節 |
|---|---|---|
| 1 | D1 `toinoba-ops` と R2 `toinoba-ops` を作り、マイグレーションを当てる | §1 |
| 2 | GitHub Variables に `OPS_D1_ID` を入れる | §1.5 |
| 3 | `OPS_TRIGGER_SECRET` と `PREVIEW_TOKEN` を Cloudflare secret に入れる | §2 |
| 4 | `data/ops-settings.json` の `fixedCosts` に実固定費を書く | §4 |
| 5 | impact.com は紹介者アカウントと Campaigns 200 まで。Token を Worker に入れるのはその後 | §3 |

4 まで終われば、モック経路での企画・検品・Draft PR 試験に進める。5 は提携承認がなくてもアカウント作成と空の Campaigns 確認まではできる。成果同期と運用可能化は提携後。

完了の目安:

- [ ] R2 `toinoba-ops` がある（公開オフ、カスタムドメインなし）
- [ ] D1 `toinoba-ops` があり、`programs` / `ran_keys` などのテーブルが見える
- [ ] GitHub Variable `OPS_D1_ID` が入っている
- [ ] Worker `toinoba-ops` の secret に `OPS_TRIGGER_SECRET` と `PREVIEW_TOKEN`
- [ ] Worker `toinoba` にも同じ `PREVIEW_TOKEN`（プレビューを使う場合）
- [ ] `fixedCosts` が空配列ではない
- [ ] （任意）impact の Campaigns が 200。トークンはチャットに出していない

---

## 1. D1 `toinoba-ops` と R2

### 1.1 名前（コードと一致させる）

| リソース | 正確な名前 | コード上の参照 |
|---|---|---|
| D1 | `toinoba-ops` | `database_name`。CI は `npx wrangler d1 migrations apply toinoba-ops --remote` |
| R2（ops 用） | `toinoba-ops` | `bucket_name`。バインディング名は `OPS_BUCKET`（バケット名ではない） |
| Worker | `toinoba-ops` | wrangler の `name` |

画像用 R2（`toinoba-images` / `img.toinoba.com`）とは別である。ops 用にカスタムドメインや公開アクセスは付けない。

staging を作る場合だけ、名前は `toinoba-ops-staging`（初期設定では不要）。

### 1.2 R2 の必要設定

必須は次だけ。

- バケット名: `toinoba-ops`
- 公開アクセス: オフ（既定の私有のままでよい）
- カスタムドメイン: 付けない
- CORS / ライフサイクル: 今のコードは未使用なので未設定でよい

ダッシュボード: **R2 オブジェクトストレージ → バケットを作成** で名前を `toinoba-ops` にする。または:

```bash
npx wrangler r2 bucket create toinoba-ops
```

### 1.3 D1 の作成

テーブルは手で `CREATE` しない。マスタは [`worker/ops/migrations/0001_init.sql`](../worker/ops/migrations/0001_init.sql)。適用すると次が作られる。

`programs`, `products`, `plans`, `sources`, `claims`, `claim_articles`, `topics`, `articles`, `article_versions`, `generation_runs`, `affiliate_links`, `approvals`, `conversions`, `click_aggregates`, `search_metrics`, `jobs`, `cost_ledger`, `sync_states`, `audit_events`, `ran_keys`

```bash
git fetch origin
git checkout cursor/automation-ops-core-5354
npx wrangler d1 create toinoba-ops
```

出力の `database_id`（UUID）を控える。これは秘密ではない。

ダッシュボードなら **Workers と Pages → D1 → データベースを作成** で名前を `toinoba-ops` にし、作成画面の **database_id** をコピーする。

### 1.4 マイグレーション

`worker/ops` で実行する。`wrangler.jsonc` の `"<OPS_D1_ID>"` を控えた ID に置き換えてから（**この置換はコミットしない**。リポジトリはプレースホルダのまま。CI がデプロイ時に `sed` で置換する）:

```bash
cd worker/ops
npx wrangler d1 migrations apply toinoba-ops --remote
```

確認:

```bash
npx wrangler d1 execute toinoba-ops --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
```

`programs` や `ran_keys` などが出れば成功。

`main` に `deploy-ops.yml` が入ったあとは、GitHub Actions の **deploy-ops** が同じ `migrations apply` と `wrangler deploy` を行う。そのとき必要な GitHub 側設定は `OPS_D1_ID`（Variables）と既存の `CLOUDFLARE_API_TOKEN`（Secret。Workers / D1 / R2 を編集できるもの）。

### 1.5 `OPS_D1_ID` を置く場所

**GitHub Secrets ではなく Variables。** CI は `vars.OPS_D1_ID` を読む。

1. https://github.com/YuseiMorimoto/headresCMS/settings/variables/actions  
   （リポジトリ → **Settings** → **Secrets and variables** → **Actions** → タブ **Variables**）
2. **New repository variable**
3. Name: `OPS_D1_ID`（この綴り以外は CI が空扱いしてデプロイをスキップする）
4. Value: D1 の `database_id`

未設定のままだとログに `OPS_D1_ID が未設定のため ops Worker のデプロイをスキップしました` と出る。失敗ではなくスキップ。

---

## 2. `OPS_TRIGGER_SECRET` と `PREVIEW_TOKEN`

### 2.1 コードが読んでいる場所

| 値 | 使う処理 | 読み先 |
|---|---|---|
| `OPS_TRIGGER_SECRET` | ops Worker の `POST /jobs/{kind}` の `Authorization: Bearer …` | Cloudflare の Worker `toinoba-ops` の secret だけ |
| `PREVIEW_TOKEN` | ops の `GET /preview-version?v=&token=` | Worker `toinoba-ops` の secret |
| `PREVIEW_TOKEN` | 公開サイトの `/preview/?v=&token=` | 公開サイト Worker `toinoba` の secret（`process.env` / `import.meta.env`） |

形式はどちらも **16〜128文字**。使える文字は `A-Z a-z 0-9 _ -` だけ（`src/ops/auth.ts`）。記号 `!@#` や空白は使えない。

### 2.2 GitHub に同じ値は必要か

今の CI はどちらも読まない。GitHub Secrets / Variables に入れる必要はない。`deploy-ops.yml` が見るのは `OPS_D1_ID`（Variables）と `CLOUDFLARE_API_TOKEN`（既存 Secret）だけ。

GitHub にコピーすると漏洩面が増えるだけで、現行コードの得はない。

### 2.3 2つの秘密は同じ値にしてよいか

別々にする。用途が違う（ジョブ起動 vs プレビュー）。

`PREVIEW_TOKEN` だけは、ops と公開サイトで同じ値にする。サイトの `/preview/?v=` と ops の `/preview-version` が同じトークンを見るため。

- `OPS_TRIGGER_SECRET` ≠ `PREVIEW_TOKEN`
- `PREVIEW_TOKEN` は `toinoba-ops` と `toinoba` で同一
- GitHub には置かない

### 2.4 安全な作り方（値は表示・保存先以外に出さない）

パスワードマネージャで「英数字と `_` `-`、長さ 32 以上」を生成するか、自分の端末だけで:

```bash
openssl rand -base64 32 | tr -dc 'A-Za-z0-9_-' | head -c 32; echo
```

出力はパスワードマネージャに保存する。チャット・Issue・リポジトリには貼らない。`.dev.vars` にも書いてよいがコミットしない（`.gitignore` 済み）。

### 2.5 Cloudflare への登録

Worker がまだ無い場合は、D1 ID を埋めた状態で先に一度デプロイする。

```bash
cd worker/ops
npx wrangler deploy
npx wrangler secret put OPS_TRIGGER_SECRET
npx wrangler secret put PREVIEW_TOKEN
```

対話で値を入力する。標準出力に値が残らないようにする。

ダッシュボード: Cloudflare → **Workers と Pages** → Worker **`toinoba-ops`** → **Settings** → **Variables and Secrets** → **Add** → 種類 **Secret**。名前は `OPS_TRIGGER_SECRET` と `PREVIEW_TOKEN`。平文の Variable にしない。

公開サイトのプレビューも使うなら、Worker **`toinoba`** にも Secret **`PREVIEW_TOKEN`** を ops と同じ値で追加する。リポジトリルートで `npx wrangler secret put PREVIEW_TOKEN` でも同じ。

ローカル確認だけなら、リポジトリ直下の `.dev.vars` に同じ名前で書く（コミットしない）。

### 2.6 入れたあとの確認（値は見ない）

- `GET https://<toinoba-ops の URL>/healthz` → 200
- `POST /jobs/sync` に Authorization なし → 401
- 公開サイト `https://toinoba.com/preview/?v=dummy-version-id` に token なし → 401（サイト側に `PREVIEW_TOKEN` を入れた場合）

---

## 3. impact.com

### 3.1 必要なアカウント種別

コードは紹介者（メディア）向け API を叩く。

```
https://api.impact.com/Mediapartners/{AccountSID}/Campaigns
https://api.impact.com/Mediapartners/{AccountSID}/TrackingLinks
```

**Publisher / Media Partner（紹介者）**。広告主（Advertiser / Brand）アカウントの API では動かない。

### 3.2 資格情報の取得場所と登録先

impact のパブリッシャー画面（名称は UI で多少違う）:

1. 紹介者としてログインする
2. **Settings（設定）** 付近の **API** / **Technical Settings**
3. **Account SID**（アカウント識別子）
4. **Auth Token**（API トークン。再表示できないことが多いのでパスワードマネージャへ）

認証は Basic（SID がユーザ、Token がパスワード）。

| 名前 | 置く場所 |
|---|---|
| `IMPACT_ACCOUNT_SID` | Cloudflare Worker `toinoba-ops` の secret（予定） |
| `IMPACT_AUTH_TOKEN` | 同上 |

```bash
cd worker/ops
npx wrangler secret put IMPACT_ACCOUNT_SID
npx wrangler secret put IMPACT_AUTH_TOKEN
```

チャット・GitHub Secrets・リポジトリには置かない。

コネクター [`src/ops/connectors/asp.ts`](../src/ops/connectors/asp.ts) は SID/Token があれば Campaigns 取得と Tracking Link 作成まで実装している。一方 **`worker/ops` の Env には `IMPACT_*` がまだ無く、Cron からも呼んでいない。** 資格を secret に入れても自動同期はまだ始まらない。先に進む実接続確認は、下記の curl で API を直接叩く。`listConversions` は資格があっても空配列を返すだけなので、成果 API の実証は未実装。

### 3.3 提携すべき案件の条件

自動運用に載せるには、`canBecomeOperable`（[`src/ops/program-machine.ts`](../src/ops/program-machine.ts)）が全部満たる必要がある。

- 運営者が採用する（`adopted`）
- 提供地域が日本（`region === "JP"`）
- 日本語対応がある（`languageJa`）
- 提携が承認済み（状態 `approved`。申請中・候補では運用可能にならない）
- リンクを API で発行できる、または取得済みリンクの再利用が許可されている
- 成果を API で取れる
- 公式の料金・仕様を確認できる

加えて運用判断:

- 対象は日本の個人事業主・小規模向け SaaS
- 日常の手動リンクコピーや売上 CSV 取得が必要な案件は採用しない
- 「高単価」は商品価格ではなく紹介者報酬。足切り額はコードに固定していない
- サブID（記事識別）のパラメータ名は管理画面で見た名前だけ。不明なら `null` のまま（impact コネクターはいま常に `null`）

リンクが開けることだけでは提携継続の証拠にしない。

### 3.4 実接続の確認（資格がある場合）

値はシェル履歴に残さない。環境変数は自分の端末だけに置く。

1. 認証と案件一覧（提携ゼロなら空配列でも、401 でなければ資格は有効）

```bash
curl -sS -u "$IMPACT_ACCOUNT_SID:$IMPACT_AUTH_TOKEN" \
  -H "Accept: application/json" \
  "https://api.impact.com/Mediapartners/${IMPACT_ACCOUNT_SID}/Campaigns"
```

- 401/403 → アカウント種別かトークンが違う
- 200 で `Campaigns` が空 → 資格は生きているが提携案件がまだ無い

2. 提携済み案件があるときだけ Tracking Link（本文やリポジトリに出さない）

コードは `CampaignId` だけ POST する。

```bash
curl -sS -u "$IMPACT_ACCOUNT_SID:$IMPACT_AUTH_TOKEN" \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -X POST "https://api.impact.com/Mediapartners/${IMPACT_ACCOUNT_SID}/TrackingLinks" \
  -d '{"CampaignId":"<提携済みの CampaignId>"}'
```

`TrackingURL` が `https://` で始まること。問題なければ `docs/12-connection-matrix.md` の impact 行を「対象アカウントでリンク作成を確認」と更新する。

3. 成果一覧

コードは空配列固定のため、このリポジトリの実装では成果同期の実接続完了にはならない。レポート API の権限確認は impact のドキュメント（Reports の `ApiAccessible`）側の作業で、別途実装が必要。

### 3.5 提携承認がまだ無いときに進められる範囲

| できる | まだできない |
|---|---|
| 紹介者アカウント作成、サイト審査、本人確認 | 正式トラッキングリンクの発行（通常は承認後） |
| Account SID / Auth Token の発行と、Campaigns が 200 で空を返すことの確認 | 案件を `operable` にして自動記事の広告リンクに使う |
| D1 / R2 / `OPS_D1_ID` / 2つの secret / 固定費入力 | 成果の日次同期（コネクター未接続＋成果 API 未実装） |
| モックでの企画・検品・Draft PR の試験 | 「実接続完了」と呼ぶこと |
| 候補の公開情報調査（出典URLと確認日つき）。未確認は未確認のまま | 地域・日本語・報酬条件が分からないまま採用すること |

提携待ちの間は、§1・§2・§4 と、必要なら Anthropic キーまで進めてよい。impact の Token は、発行できたらパスワードマネージャに置き、Worker へ入れるのは Campaigns の 200 を確認してからでよい。

---

## 4. 固定費 `fixedCosts`

空配列のままだと有料生成は開始しない（`reserveBudget` が `missing_fixed`）。判定は配列の長さなので 1 件以上あれば通る。運用では実在する月額コストを書く。金額 0 のダミー行は使わない。

編集先: [`data/ops-settings.json`](../data/ops-settings.json)。変更は PR で入れる（日常運用と同じ）。

```json
"fixedCosts": [
  { "name": "workers-paid", "yenPerMonth": 750 },
  { "name": "domain", "yenPerMonth": 150 }
]
```

| フィールド | 制約 |
|---|---|
| `name` | 識別用の文字列。秘密は書かない |
| `yenPerMonth` | 0 以上の整数（円） |

月額上限は同ファイルの `monthlyCapYen`（初期値 5000）。固定費の合計が上限を食い潰すと生成枠が残らないので、Workers Paid・ドメイン月割り・AI 以外の実費だけを入れる。予備 500 円は `reserveBufferYen` 側であり、`fixedCosts` には書かない。

確認: `fixedCosts` が 1 件以上ある PR をマージする。値を Issue やチャットに貼る必要はない。
