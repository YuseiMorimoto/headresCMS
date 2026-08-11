export type LinkRecord = {
  url: string;
  asp: string;
  subIdParam: string | null;
  label: string;
  active: boolean;
  fallbackPath: string;
};

export const SLUG_RE = /^[a-z0-9-]{1,64}$/;

export function articlePathFrom(referer: string | null, origin: string): string {
  if (!referer) return "external";
  try {
    const ref = new URL(referer);
    const base = new URL(origin);
    if (ref.origin !== base.origin) return "external";
    return ref.pathname;
  } catch {
    return "external";
  }
}

export function toSubId(path: string): string {
  return path
    .replace(/^\/+|\/+$/g, "")
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .slice(0, 40);
}

export function deviceHint(ua: string | null): "mobile" | "desktop" {
  if (!ua) return "desktop";
  return /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
}
