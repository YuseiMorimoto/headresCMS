import type { CapabilityKey, CapabilityStatus, Program, ProgramStatus } from "./types.ts";

const ORDER: ProgramStatus[] = [
  "candidate",
  "researching",
  "applying",
  "applied",
  "approved",
  "operable",
];

export const AUTO_KEYS: CapabilityKey[] = ["createLink", "conversions"];

export function canBecomeOperable(program: Program): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  if (!program.adopted) reasons.push("not_adopted");
  if (program.region !== "JP") reasons.push("region_mismatch");
  if (!program.languageJa) reasons.push("no_japanese");
  if (program.status !== "approved" && program.status !== "operable") reasons.push("not_partnered");
  const linkOk =
    program.capabilities.createLink === "confirmed" || program.capabilities.reuseLink === "confirmed";
  if (!linkOk) reasons.push("link_not_automatable");
  if (program.capabilities.conversions !== "confirmed") reasons.push("conversions_not_automatable");
  if (program.capabilities.productInfo !== "confirmed") reasons.push("official_info_unverified");
  if (reasons.length > 0) return { ok: false, reasons };
  return { ok: true };
}

export function transitionProgram(program: Program, next: ProgramStatus): Program {
  if (next === "held" || next === "ended" || next === program.status) {
    return { ...program, status: next };
  }
  if (next === "operable") {
    const gate = canBecomeOperable({ ...program, status: "approved" });
    if (!gate.ok) {
      throw new Error(`cannot become operable: ${gate.reasons.join(",")}`);
    }
    return { ...program, status: "operable" };
  }
  const from = ORDER.indexOf(program.status);
  const to = ORDER.indexOf(next);
  if (from < 0 || to < 0 || to > from + 1) {
    throw new Error(`illegal program transition ${program.status} → ${next}`);
  }
  return { ...program, status: next };
}

export function defaultCapabilities(
  overrides: Partial<Record<CapabilityKey, CapabilityStatus>> = {},
): Record<CapabilityKey, CapabilityStatus> {
  return {
    productInfo: "unconfirmed",
    createLink: "unconfirmed",
    reuseLink: "unconfirmed",
    articleSubId: "unconfirmed",
    conversions: "unconfirmed",
    statusUpdate: "unconfirmed",
    notifications: "unconfirmed",
    partnershipStatus: "unconfirmed",
    ...overrides,
  };
}

export function isVerifyExpired(program: Program, today: string): boolean {
  return program.verifyBy !== null && program.verifyBy < today;
}

export function holdIfStale(program: Program, today: string): Program {
  if (program.status === "operable" && isVerifyExpired(program, today)) {
    return { ...program, status: "held" };
  }
  return program;
}
