import { defaultCapabilities } from "../program-machine.ts";
import type { AffiliateLink, CapabilityKey, CapabilityStatus, Conversion, Program } from "../types.ts";

export type ConversionPage = {
  items: Conversion[];
  cursor: string | null;
};

export type AspConnector = {
  network: string;
  implemented: boolean;
  unimplementedReason: string | null;
  capabilities: Record<CapabilityKey, CapabilityStatus>;
  listPrograms(): Promise<Program[]>;
  getOrCreateLink(input: { program: Program; slug: string; label: string }): Promise<AffiliateLink>;
  listConversions(input: { cursor: string | null; since: string }): Promise<ConversionPage>;
};

export function mockConnector(programs: Program[], links: AffiliateLink[], conversions: Conversion[]): AspConnector {
  return {
    network: "mock",
    implemented: true,
    unimplementedReason: null,
    capabilities: defaultCapabilities({
      productInfo: "confirmed",
      createLink: "confirmed",
      reuseLink: "confirmed",
      articleSubId: "unsupported",
      conversions: "confirmed",
      statusUpdate: "unconfirmed",
      notifications: "unconfirmed",
      partnershipStatus: "confirmed",
    }),
    async listPrograms() {
      return programs;
    },
    async getOrCreateLink(input) {
      const existing = links.find((l) => l.slug === input.slug);
      if (existing) return existing;
      if (input.program.capabilities.createLink !== "confirmed") {
        throw new Error("createLink unsupported");
      }
      const created: AffiliateLink = {
        slug: input.slug,
        programId: input.program.id,
        url: `https://example.com/track/${input.slug}`,
        asp: "mock",
        subIdParam: null,
        label: input.label,
        active: input.program.status === "operable",
        fallbackPath: `/c/${input.program.id}/`,
        version: "lv_1",
      };
      links.push(created);
      return created;
    },
    async listConversions({ cursor }) {
      const start = cursor ? Number(cursor) : 0;
      const slice = conversions.slice(start, start + 50);
      return {
        items: slice,
        cursor: start + slice.length < conversions.length ? String(start + slice.length) : null,
      };
    },
  };
}

export const partnerstackStub: AspConnector = {
  network: "partnerstack",
  implemented: false,
  unimplementedReason: "採用案件が未確定のため未実装。Partner API のリンク発行と記事帰属は未実証（docs/12）",
  capabilities: defaultCapabilities(),
  async listPrograms() {
    throw new Error("partnerstack stub");
  },
  async getOrCreateLink() {
    throw new Error("partnerstack stub");
  },
  async listConversions() {
    throw new Error("partnerstack stub");
  },
};

export const valuecommerceStub: AspConnector = {
  network: "valuecommerce",
  implemented: false,
  unimplementedReason: "日本向けという理由だけでは主軸SaaSが十分と扱わない。商品APIと注文APIの案件適合は未確認（docs/12）",
  capabilities: defaultCapabilities(),
  async listPrograms() {
    throw new Error("valuecommerce stub");
  },
  async getOrCreateLink() {
    throw new Error("valuecommerce stub");
  },
  async listConversions() {
    throw new Error("valuecommerce stub");
  },
};

export function impactConnector(env: { accountSid?: string; authToken?: string }): AspConnector {
  const ready = Boolean(env.accountSid && env.authToken);
  return {
    network: "impact",
    implemented: ready,
    unimplementedReason: ready ? null : "IMPACT_ACCOUNT_SID / IMPACT_AUTH_TOKEN が未設定。接続実証は外部依存",
    capabilities: defaultCapabilities({
      createLink: ready ? "confirmed" : "unconfirmed",
      conversions: ready ? "unconfirmed" : "unconfirmed",
      productInfo: "unconfirmed",
    }),
    async listPrograms() {
      if (!ready) throw new Error("impact credentials missing");
      const url = `https://api.impact.com/Mediapartners/${env.accountSid}/Campaigns`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Basic ${btoa(`${env.accountSid}:${env.authToken}`)}`,
          Accept: "application/json",
        },
      });
      if (!res.ok) throw new Error(`impact campaigns ${res.status}`);
      const json = (await res.json()) as { Campaigns?: Array<{ CampaignId: string; CampaignName: string }> };
      return (json.Campaigns ?? []).map((row) => ({
        id: `impact-${row.CampaignId}`,
        network: "impact",
        externalId: row.CampaignId,
        name: row.CampaignName,
        status: "approved" as const,
        region: "unconfirmed",
        languageJa: false,
        adopted: false,
        rewardFixedMinor: null,
        rewardRateBps: null,
        rewardCurrency: "USD",
        recurringMonths: null,
        verifyBy: null,
        capabilities: defaultCapabilities({ createLink: "confirmed" }),
        notes: "",
      }));
    },
    async getOrCreateLink(input) {
      if (!ready) throw new Error("impact credentials missing");
      const url = `https://api.impact.com/Mediapartners/${env.accountSid}/TrackingLinks`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(`${env.accountSid}:${env.authToken}`)}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ CampaignId: input.program.externalId }),
      });
      if (!res.ok) throw new Error(`impact tracking link ${res.status}`);
      const json = (await res.json()) as { TrackingURL?: string };
      if (!json.TrackingURL?.startsWith("https://")) throw new Error("impact link not https");
      return {
        slug: input.slug,
        programId: input.program.id,
        url: json.TrackingURL,
        asp: "impact",
        subIdParam: null,
        label: input.label,
        active: true,
        fallbackPath: `/c/${input.program.id}/`,
        version: "lv_impact",
      };
    },
    async listConversions() {
      if (!ready) throw new Error("impact credentials missing");
      return { items: [], cursor: null };
    },
  };
}
