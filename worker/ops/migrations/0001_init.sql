-- 金額は最小通貨単位の整数。原IDは一意。浮動小数の加算を避ける。
CREATE TABLE programs (
  id TEXT PRIMARY KEY,
  network TEXT NOT NULL,
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  region TEXT NOT NULL,
  language_ja INTEGER NOT NULL,
  adopted INTEGER NOT NULL,
  reward_fixed_minor INTEGER,
  reward_rate_bps INTEGER,
  reward_currency TEXT NOT NULL,
  recurring_months INTEGER,
  verify_by TEXT,
  capabilities_json TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  UNIQUE (network, external_id)
);

CREATE TABLE products (
  id TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  name TEXT NOT NULL,
  FOREIGN KEY (program_id) REFERENCES programs(id)
);

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name TEXT NOT NULL,
  seats INTEGER NOT NULL,
  interval TEXT NOT NULL,
  amount_minor INTEGER NOT NULL,
  currency TEXT NOT NULL,
  tax_included INTEGER NOT NULL,
  required_options_minor INTEGER NOT NULL,
  min_term_months INTEGER NOT NULL,
  info_version TEXT NOT NULL,
  source_id TEXT NOT NULL,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  fetched_at TEXT NOT NULL,
  excerpt TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  status TEXT NOT NULL,
  r2_key TEXT
);

CREATE TABLE claims (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  text TEXT NOT NULL,
  info_version TEXT NOT NULL
);

CREATE TABLE claim_articles (
  claim_id TEXT NOT NULL,
  article_id TEXT NOT NULL,
  PRIMARY KEY (claim_id, article_id)
);

CREATE TABLE topics (
  id TEXT PRIMARY KEY,
  search_intent TEXT NOT NULL UNIQUE,
  template TEXT NOT NULL,
  cluster TEXT NOT NULL,
  article_type TEXT NOT NULL,
  audience TEXT NOT NULL,
  selected INTEGER NOT NULL
);

CREATE TABLE articles (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  cluster TEXT NOT NULL,
  topic_id TEXT,
  status TEXT NOT NULL,
  published_version_id TEXT,
  draft_version_id TEXT,
  published_url TEXT
);

CREATE TABLE article_versions (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  body TEXT NOT NULL,
  firsthand TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  info_version_set TEXT NOT NULL,
  link_version TEXT NOT NULL,
  target_keywords_json TEXT NOT NULL,
  article_type TEXT NOT NULL,
  cluster TEXT NOT NULL,
  offers_json TEXT NOT NULL,
  source_ids_json TEXT NOT NULL,
  generation_run_id TEXT,
  review_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (article_id) REFERENCES articles(id)
);

CREATE TABLE generation_runs (
  id TEXT PRIMARY KEY,
  article_id TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_hash TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  cost_minor INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE affiliate_links (
  slug TEXT PRIMARY KEY,
  program_id TEXT NOT NULL,
  url TEXT NOT NULL,
  asp TEXT NOT NULL,
  sub_id_param TEXT,
  label TEXT NOT NULL,
  active INTEGER NOT NULL,
  fallback_path TEXT NOT NULL,
  version TEXT NOT NULL
);

CREATE TABLE approvals (
  article_id TEXT PRIMARY KEY,
  version_id TEXT NOT NULL,
  body_hash TEXT NOT NULL,
  info_version_set TEXT NOT NULL,
  link_version TEXT NOT NULL,
  review_passed INTEGER NOT NULL,
  approved_by TEXT,
  approved_at TEXT,
  invalidated_at TEXT
);

CREATE TABLE conversions (
  network TEXT NOT NULL,
  raw_id TEXT NOT NULL,
  program_id TEXT NOT NULL,
  article_id TEXT,
  occurred_at TEXT NOT NULL,
  approved_at TEXT,
  currency TEXT NOT NULL,
  sale_minor INTEGER,
  reward_minor INTEGER NOT NULL,
  raw_status TEXT NOT NULL,
  status TEXT NOT NULL,
  PRIMARY KEY (network, raw_id)
);

CREATE TABLE click_aggregates (
  article_id TEXT NOT NULL,
  offer_slug TEXT NOT NULL,
  period_start TEXT NOT NULL,
  clicks INTEGER NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (article_id, offer_slug, period_start, source)
);

CREATE TABLE search_metrics (
  query TEXT NOT NULL,
  page TEXT NOT NULL,
  period_start TEXT NOT NULL,
  impressions INTEGER NOT NULL,
  clicks INTEGER NOT NULL,
  position REAL NOT NULL,
  PRIMARY KEY (query, page, period_start)
);

CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  state TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  input_version TEXT NOT NULL,
  attempt INTEGER NOT NULL,
  reserved_minor INTEGER NOT NULL,
  spent_minor INTEGER NOT NULL,
  error TEXT,
  retry_class TEXT
);

CREATE TABLE cost_ledger (
  month TEXT PRIMARY KEY,
  cap_minor INTEGER NOT NULL,
  fixed_minor INTEGER NOT NULL,
  spent_minor INTEGER NOT NULL,
  reserved_minor INTEGER NOT NULL,
  buffer_minor INTEGER NOT NULL
);

CREATE TABLE sync_states (
  source TEXT PRIMARY KEY,
  health TEXT NOT NULL,
  last_success_at TEXT,
  period_start TEXT,
  period_end TEXT,
  imported_count INTEGER NOT NULL,
  message TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE ran_keys (
  key TEXT PRIMARY KEY
);
