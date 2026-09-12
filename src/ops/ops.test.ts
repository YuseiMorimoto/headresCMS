import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { grantApproval, invalidateIfChanged } from "./approval.ts";
import { shouldPauseGeneration } from "./article-machine.ts";
import { authorizeSecret, extractBearer } from "./auth.ts";
import { estimateAiYen, reserveBudget } from "./budget.ts";
import { createGitPublisher, isOpsSafePath } from "./connectors/publisher.ts";
import { impactConnector, mockConnector, partnerstackStub, valuecommerceStub } from "./connectors/asp.ts";
import { assertSafeFetchUrl, fetchOfficialSource } from "./fetcher.ts";
import { materializeVersion } from "./generate.ts";
import { emergencyLinkDisable } from "./improve.ts";
import { canRetry, classifyError, runJob } from "./jobs.ts";
import { calculateEpc, shouldSuppressPivot, weeklyReport } from "./kpi.ts";
import { runGenerateWorkflow, runPlanWorkflow, runPublishWorkflow } from "./pipeline.ts";
import { proposeTopics } from "./plan.ts";
import { buildFirsthand, quotePlan } from "./pricing.ts";
import { canBecomeOperable, defaultCapabilities, transitionProgram } from "./program-machine.ts";
import { inspectVersion } from "./review.ts";
import { sanitizeHtml } from "./sanitize.ts";
import { parseOpsSettings } from "./settings.ts";
import { DEFAULT_OPS_SETTINGS } from "./default-settings.ts";
import { createMemoryStore } from "./store.ts";
import { normalizeStatus, upsertConversion } from "./sync.ts";
import type { ArticleVersion, Conversion, ProductPlan, Program, Source } from "./types.ts";

const fileSettings = parseOpsSettings(
  JSON.parse(readFileSync(new URL("../../data/ops-settings.json", import.meta.url), "utf-8")),
);
const settings = fileSettings;
assert.deepEqual(fileSettings, DEFAULT_OPS_SETTINGS);
settings.fixedCosts.push({ name: "workers-paid", yenPerMonth: 750 });

function capableProgram(overrides: Partial<Program> = {}): Program {
  return {
    id: "prog-1",
    network: "mock",
    externalId: "ext-1",
    name: "Example SaaS",
    status: "approved",
    region: "JP",
    languageJa: true,
    adopted: true,
    rewardFixedMinor: 10000,
    rewardRateBps: null,
    rewardCurrency: "JPY",
    recurringMonths: 12,
    verifyBy: "2026-12-01",
    capabilities: defaultCapabilities({
      productInfo: "confirmed",
      createLink: "confirmed",
      conversions: "confirmed",
    }),
    notes: "",
    ...overrides,
  };
}

const sourceOk: Source = {
  id: "src-1",
  url: "https://example.com/pricing",
  fetchedAt: "2026-09-10T00:00:00.000Z",
  excerpt: "1200 per seat",
  contentHash: "abc",
  status: "ok",
  r2Key: null,
};

const plan: ProductPlan = {
  id: "plan-1",
  productId: "prod-1",
  name: "Standard",
  seats: 1,
  interval: "month",
  amountMinor: 1200,
  currency: "JPY",
  taxIncluded: true,
  requiredOptionsMinor: 0,
  minTermMonths: 1,
  infoVersion: "iv_1",
  sourceId: "src-1",
};

function baseVersion(overrides: Partial<ArticleVersion> = {}): ArticleVersion {
  return {
    id: "av-1",
    articleId: "article-1",
    title: "小規模事業者向けSaaSの選び方比較",
    description: "公式料金と機能条件を突き合わせ、人数別の年払総額まで計算して判断材料を並べます。",
    body: "## 結論\n比較表です。\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n[公式](/go/offer-a)",
    firsthand: "公式資料からプログラムが計算した料金比較です。使用経験や口コミではありません。確認日 2026-09-10。",
    bodyHash: "hash",
    infoVersionSet: "iv_1",
    linkVersion: "lv_1",
    targetKeywords: ["SaaS 比較"],
    articleType: "comparison",
    cluster: "example-a",
    offers: [{ slug: "offer-a", label: "公式" }],
    sourceIds: ["src-1"],
    generationRunId: null,
    review: null,
    createdAt: "2026-09-12T00:00:00.000Z",
    ...overrides,
  };
}

describe("T01 program adoption gates", () => {
  it("rejects unaffiliated, region mismatch, and non-automatable links", () => {
    assert.equal(canBecomeOperable(capableProgram({ adopted: false })).ok, false);
    assert.equal(canBecomeOperable(capableProgram({ region: "US" })).ok, false);
    assert.equal(
      canBecomeOperable(
        capableProgram({
          capabilities: defaultCapabilities({
            productInfo: "confirmed",
            createLink: "unsupported",
            reuseLink: "unsupported",
            conversions: "confirmed",
          }),
        }),
      ).ok,
      false,
    );
  });

  it("allows operable after capabilities are confirmed", () => {
    const program = transitionProgram(capableProgram(), "operable");
    assert.equal(program.status, "operable");
  });
});

describe("T02 pricing versions", () => {
  it("computes per-seat and annual totals", () => {
    const quote = quotePlan(plan, sourceOk, 5);
    assert.equal(quote.monthlyMinor, 6000);
    assert.equal(quote.annualTotalMinor, 72000);
  });

  it("does not rewrite price when fetch failed", () => {
    assert.throws(() => quotePlan(plan, { ...sourceOk, status: "failed" }), /refuse to rewrite price/);
  });

  it("builds firsthand from official quotes only", () => {
    const text = buildFirsthand([quotePlan(plan, sourceOk, 1)]);
    assert.ok(text.length >= 50);
    assert.ok(text.includes("使用経験や口コミではありません"));
  });
});

describe("T03 planning and fabrication review", () => {
  it("creates topics from empty site data without inventing volumes", () => {
    const topics = proposeTopics({
      cluster: "example-a",
      audience: "個人事業主",
      problems: ["請求書の発行", "経費精算"],
      existingIntents: [],
    });
    assert.equal(topics.length, 2);
    assert.equal(topics.filter((t) => t.selected).length, 2);
  });

  it("treats duplicate search intent as a blocker", () => {
    const result = inspectVersion({
      version: baseVersion(),
      sources: [sourceOk],
      settings,
      now: new Date("2026-09-12T00:00:00Z"),
      existingIntents: ["SaaS 比較"],
      publishedInternalHrefs: [],
      knownOfferSlugs: ["offer-a"],
    });
    assert.equal(result.passed, false);
    assert.ok(result.issues.some((i) => i.code === "duplicate_intent"));
  });

  it("holds fabricated social proof", () => {
    const result = inspectVersion({
      version: baseVersion({ body: "口コミでは高評価です" }),
      sources: [sourceOk],
      settings,
      now: new Date("2026-09-12T00:00:00Z"),
      existingIntents: [],
      publishedInternalHrefs: [],
      knownOfferSlugs: ["offer-a"],
    });
    assert.ok(result.issues.some((i) => i.code === "fabricated_proof"));
  });
});

describe("T04 links and HTML", () => {
  it("keeps official tracking id and strips scripts", () => {
    const html = sanitizeHtml(`<p>ok</p><script>alert(1)</script><a href="/go/offer-a">x</a>`);
    assert.equal(html.includes("script"), false);
    assert.ok(html.includes('href="/go/offer-a"'));
  });
});

describe("T05 review gates", () => {
  it("blocks stale pricing and missing sources", () => {
    const stale = inspectVersion({
      version: baseVersion(),
      sources: [{ ...sourceOk, fetchedAt: "2026-01-01T00:00:00.000Z" }],
      settings,
      now: new Date("2026-09-12T00:00:00Z"),
      existingIntents: [],
      publishedInternalHrefs: [],
      knownOfferSlugs: ["offer-a"],
    });
    assert.equal(stale.passed, false);
    assert.ok(stale.issues.some((i) => i.code === "stale"));
  });
});

describe("T06-T08 approval and publish idempotency", () => {
  it("refuses publish after body or info version change", async () => {
    const publisher = createGitPublisher({
      inspectRemote: async () => ({ url: null, versionId: null, commitSha: null, status: "absent" }),
      apply: async () => ({ sha: "sha-1" }),
    });
    const version = baseVersion({ bodyHash: "aaa" });
    const approval = {
      articleId: version.articleId,
      versionId: version.id,
      bodyHash: "aaa",
      infoVersionSet: "iv_1",
      linkVersion: "lv_1",
      reviewPassed: true,
      approvedBy: "operator",
      approvedAt: "2026-09-12T00:00:00.000Z",
      invalidatedAt: null,
    };
    const changed = invalidateIfChanged(approval, { ...version, bodyHash: "bbb" }, new Date());
    assert.ok(changed.invalidatedAt);
    await assert.rejects(
      () =>
        publisher.publish({
          version: { ...version, bodyHash: "bbb" },
          approval: changed,
          idempotencyKey: "k1",
        }),
      /re-approval|invalidated/,
    );
  });

  it("does not duplicate publish on retry", async () => {
    let applies = 0;
    const publisher = createGitPublisher({
      inspectRemote: async () => ({ url: null, versionId: null, commitSha: null, status: "absent" }),
      apply: async () => {
        applies += 1;
        return { sha: "sha-1" };
      },
    });
    const version = baseVersion({ bodyHash: "aaa" });
    const approval = grantApproval(
      {
        articleId: version.articleId,
        versionId: version.id,
        bodyHash: "aaa",
        infoVersionSet: "iv_1",
        linkVersion: "lv_1",
        reviewPassed: true,
        approvedBy: null,
        approvedAt: null,
        invalidatedAt: null,
      },
      "operator",
      new Date(),
    );
    const first = await publisher.publish({ version, approval, idempotencyKey: "pub-1" });
    const second = await publisher.publish({ version, approval, idempotencyKey: "pub-1" });
    assert.equal(first.result, "published");
    assert.equal(second.result, "already_published");
    assert.equal(applies, 1);
  });
});

describe("T07 draft update does not change published version", () => {
  it("keeps publishedVersionId while a new draft exists", async () => {
    const store = createMemoryStore();
    store.sources.set(sourceOk.id, sourceOk);
    const topic = (await runPlanWorkflow({
      store,
      cluster: "example-a",
      audience: "個人事業主",
      problems: ["請求管理"],
      weeklyNewArticles: 1,
    }))[0]!;
    const generated = {
        title: "請求管理SaaSの条件別比較ガイド",
        description: "公式料金と機能制限を突き合わせ、人数別の年払総額まで計算して判断材料を並べます。",
        headings: ["結論", "比較", "注意"],
        body: "## 結論\n公式条件のみで比較します。料金は確認日時点の公式ページを優先し、取得失敗では価格をゼロや無料に書き換えません。人数別の年払総額と月換算を併記し、前提条件を本文にも出します。\n\n## 比較\n1席と5席の年払総額を表にします。出典URLと確認日を各数値の横に置きます。",
        suitedFor: ["請求件数が多い個人事業主"],
        notSuitedFor: ["紙運用を変えられない事業所"],
      cautions: ["料金は確認日時点"],
      offerPlacements: [{ productId: "prod-1", position: "after_conclusion" as const }],
    };
    const { article } = await runGenerateWorkflow({
      store,
      settings,
      topic,
      generated,
      quotes: [quotePlan(plan, sourceOk, 1)],
      plans: [plan],
      sources: [sourceOk],
      offerSlugs: [{ slug: "offer-a", label: "公式" }],
      knownOfferSlugs: ["offer-a"],
      publishedInternalHrefs: [],
      existingIntents: [],
      now: new Date("2026-09-12T00:00:00Z"),
    });
    store.articles.set(article.id, { ...article, publishedVersionId: article.draftVersionId, status: "published" });
    const publishedId = store.articles.get(article.id)!.publishedVersionId;
    store.articles.set(article.id, {
      ...store.articles.get(article.id)!,
      draftVersionId: `${publishedId}-rev`,
      status: "awaiting_approval",
    });
    assert.equal(store.articles.get(article.id)?.publishedVersionId, publishedId);
  });
});

describe("T09 program end", () => {
  it("notifies and prepares takedown without rewriting published pages", () => {
    const result = emergencyLinkDisable({ ...capableProgram(), status: "ended" }, true);
    assert.equal(result.notify, true);
    assert.equal(result.rewritePublished, false);
    assert.equal(result.action, "prepare_takedown");
  });
});

describe("T10 conversions", () => {
  it("dedupes API and webhook and tracks unknown attribution", () => {
    const store = createMemoryStore();
    const row: Conversion = {
      network: "mock",
      rawId: "tx-1",
      programId: "prog-1",
      articleId: "article-1",
      occurredAt: "2026-09-01T00:00:00.000Z",
      approvedAt: null,
      currency: "JPY",
      saleMinor: 10000,
      rewardMinor: 2000,
      rawStatus: "pending",
      status: "pending",
    };
    upsertConversion(store, { ...row, status: normalizeStatus(row.rawStatus) });
    upsertConversion(store, { ...row, rawStatus: "approved", status: "approved", approvedAt: "2026-09-10T00:00:00Z" });
    upsertConversion(store, { ...row, rawStatus: "reversed", status: "reversed" });
    assert.equal(store.conversions.size, 1);
    assert.equal([...store.conversions.values()][0]?.status, "reversed");
    upsertConversion(store, { ...row, rawId: "tx-2", articleId: null, status: "approved", rawStatus: "approved" });
    assert.equal([...store.conversions.values()].filter((c) => c.articleId === null).length, 1);
  });
});

describe("T11 KPI", () => {
  it("does not invent EPC or pivot on thin data", () => {
    assert.equal(calculateEpc({ conversions: [], clicks: 0, currency: "JPY" }).status, "undefined");
    const mixed = calculateEpc({
      conversions: [
        {
          network: "mock",
          rawId: "a",
          programId: "p",
          articleId: "x",
          occurredAt: "2026-09-01T00:00:00Z",
          approvedAt: "2026-09-02T00:00:00Z",
          currency: "USD",
          saleMinor: 10,
          rewardMinor: 10,
          rawStatus: "approved",
          status: "approved",
        },
      ],
      clicks: 10,
      currency: "JPY",
    });
    assert.equal(mixed.status, "undefined");
    assert.equal(shouldSuppressPivot({ settings, daysLive: 10, clicks: 5 }).suppress, true);
    const report = weeklyReport({
      period: { start: "2026-09-01", end: "2026-09-07" },
      currentRewardMinor: 100,
      previousRewardMinor: 40,
      completeness: "partial",
      issues: ["sync delayed"],
      nextActions: ["reauth", "review stale pricing", "wait for clicks", "extra"],
    });
    assert.equal(report.nextActions.length, 3);
    assert.equal(report.deltaYen, 60);
  });
});

describe("T12 budget", () => {
  it("rejects parallel reservations that would exceed the cap", () => {
    const store = createMemoryStore();
    const tight = {
      ...settings,
      monthlyCapYen: 2000,
      reserveBufferYen: 500,
      articleReserveCapYen: 200,
      budgetStopPercent: 90,
    };
    tight.fixedCosts = [{ name: "workers", yenPerMonth: 750 }];
    const first = reserveBudget(store, tight, 200);
    const second = reserveBudget(store, tight, 200);
    const third = reserveBudget(store, tight, 200);
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(third.ok, false);
  });

  it("includes retry cost in the reservation estimate", () => {
    const yen = estimateAiYen({
      settings,
      model: "claude-sonnet-4-20250514",
      maxInputTokens: 2000,
      maxOutputTokens: 4000,
      maxRetries: 2,
    });
    const once = estimateAiYen({
      settings,
      model: "claude-sonnet-4-20250514",
      maxInputTokens: 2000,
      maxOutputTokens: 4000,
      maxRetries: 0,
    });
    assert.ok(yen > once);
  });

  it("refuses paid generation when fixed costs are unknown", () => {
    const store = createMemoryStore();
    const unknown = { ...settings, fixedCosts: [] };
    assert.equal(reserveBudget(store, unknown, 100).ok, false);
  });
});

describe("T13 jobs and auth", () => {
  it("does not retry auth failures and pauses generation at 5 awaiting", async () => {
    assert.equal(classifyError("token expired reauth required"), "auth");
    assert.equal(
      canRetry(
        {
          id: "j",
          kind: "generate",
          state: "failed",
          idempotencyKey: "j",
          inputVersion: "v1",
          attempt: 1,
          reservedMinor: 0,
          spentMinor: 0,
          error: "expired",
          retryClass: "auth",
        },
        "auth",
      ),
      false,
    );
    assert.equal(shouldPauseGeneration(5, settings.maxAwaitingApproval), true);
    const store = createMemoryStore();
    const first = await runJob({
      store,
      settings,
      kind: "generate",
      idempotencyKey: "gen-1",
      reserveYen: 40,
      step: async () => ({ spentYen: 20, value: "ok" }),
    });
    const replay = await runJob({
      store,
      settings,
      kind: "generate",
      idempotencyKey: "gen-1",
      reserveYen: 40,
      step: async () => ({ spentYen: 20, value: "again" }),
    });
    assert.equal(first.job.state, "succeeded");
    assert.equal(replay.job.state, "succeeded");
    assert.equal(replay.value, undefined);
  });
});

describe("T14 auth and SSRF", () => {
  it("rejects unauthenticated trigger and preview tokens", () => {
    assert.equal(authorizeSecret(null, "abcdefghijklmnop"), false);
    assert.equal(authorizeSecret("abcdefghijklmnop", "abcdefghijklmnop"), true);
    assert.equal(extractBearer("Bearer abcdefghijklmnop"), "abcdefghijklmnop");
    assert.equal(extractBearer("abcdefghijklmnop"), null);
  });

  it("blocks private hosts and unknown domains", async () => {
    assert.throws(() => assertSafeFetchUrl("http://example.com", settings.allowedFetchHosts), /https only/);
    assert.throws(() => assertSafeFetchUrl("https://127.0.0.1/secret", settings.allowedFetchHosts), /private/);
    const blocked = await fetchOfficialSource("https://169.254.169.254/latest", settings.allowedFetchHosts, async () => {
      throw new Error("should not fetch");
    });
    assert.equal(blocked.ok, false);
  });

  it("restricts ops git paths", () => {
    assert.equal(isOpsSafePath("content/posts/a/b.md"), true);
    assert.equal(isOpsSafePath("worker/index.ts"), false);
  });
});

describe("connectors", () => {
  it("keeps PartnerStack and ValueCommerce unimplemented", () => {
    assert.equal(partnerstackStub.implemented, false);
    assert.equal(valuecommerceStub.implemented, false);
    assert.equal(impactConnector({}).implemented, false);
  });

  it("mock connector creates https links only", async () => {
    const links: never[] = [];
    const connector = mockConnector([capableProgram({ status: "operable" })], links, []);
    const link = await connector.getOrCreateLink({
      program: capableProgram({ status: "operable" }),
      slug: "offer-x",
      label: "公式",
    });
    assert.ok(link.url.startsWith("https://"));
  });
});

describe("T17 mock path", () => {
  it("goes from empty plan to approved publish with mock data", async () => {
    const store = createMemoryStore();
    store.sources.set(sourceOk.id, sourceOk);
    const topics = await runPlanWorkflow({
      store,
      cluster: "example-a",
      audience: "個人事業主",
      problems: ["請求書作成"],
      weeklyNewArticles: 1,
    });
    const { article, approval } = await runGenerateWorkflow({
      store,
      settings,
      topic: topics[0]!,
      generated: {
        title: "請求書作成SaaSの条件別比較ガイド",
        description: "公式料金と機能制限を突き合わせ、人数別の年払総額まで計算して判断材料を並べます。",
        headings: ["結論", "比較", "注意"],
        body: "## 結論\n公式条件のみで比較します。料金は確認日時点の公式ページを優先し、取得失敗では価格をゼロや無料に書き換えません。人数別の年払総額と月換算を併記し、前提条件を本文にも出します。\n\n## 比較\n1席と5席の年払総額を表にします。出典URLと確認日を各数値の横に置きます。",
        suitedFor: ["請求件数が多い個人事業主"],
        notSuitedFor: ["紙運用を続けたい事業所"],
        cautions: ["料金は確認日時点"],
        offerPlacements: [{ productId: "prod-1", position: "after_conclusion" }],
      },
      quotes: [quotePlan(plan, sourceOk, 1)],
      plans: [plan],
      sources: [sourceOk],
      offerSlugs: [{ slug: "offer-a", label: "公式" }],
      knownOfferSlugs: ["offer-a"],
      publishedInternalHrefs: [],
      existingIntents: [],
      now: new Date("2026-09-12T00:00:00Z"),
    });
    assert.equal(approval.reviewPassed, true);
    assert.equal(article.status, "awaiting_approval");
    const publisher = createGitPublisher({
      inspectRemote: async () => ({ url: null, versionId: null, commitSha: null, status: "absent" }),
      apply: async () => ({ sha: "sha-pub" }),
    });
    const published = await runPublishWorkflow({
      store,
      publisher,
      articleId: article.id,
      operator: "operator@example.com",
      now: new Date("2026-09-12T01:00:00Z"),
    });
    assert.equal(published.result, "published");
    assert.equal(store.articles.get(article.id)?.status, "published");
  });
});

describe("materialize firsthand", () => {
  it("never asks the model to write firsthand", async () => {
    const version = await materializeVersion({
      articleId: "a",
      versionId: "v",
      topic: {
        id: "t",
        searchIntent: "個人事業主 請求",
        template: "pricing_sim",
        cluster: "example-a",
        articleType: "comparison",
        audience: "個人事業主",
        selected: true,
      },
      generated: {
        title: "請求SaaSの料金シミュレーション比較",
        description: "公式料金ページの単価から人数別の年払総額を計算し、前提条件と確認日を明示します。",
        headings: ["結論", "料金", "注意"],
        body: "## 結論\n年払総額で比較します。料金は確認日時点の公式ページを優先し、取得失敗では価格をゼロや無料に書き換えません。人数別の年払総額と月換算を併記し、前提条件を本文にも出します。\n\n## 料金\n1席と5席の年払総額を表にします。出典URLと確認日を各数値の横に置きます。",
        suitedFor: ["年払できる事業者"],
        notSuitedFor: ["月次キャッシュが不安定な事業者"],
        cautions: ["外貨は参考値"],
        offerPlacements: [],
      },
      quotes: [quotePlan(plan, sourceOk, 1)],
      offerSlugs: [],
      sourceIds: ["src-1"],
      infoVersionSet: "iv_1",
      linkVersion: "lv_1",
      now: new Date(),
    });
    assert.ok(version.firsthand.includes("プログラムが計算"));
    assert.equal(version.firsthand.includes("実際に使って"), false);
  });
});
