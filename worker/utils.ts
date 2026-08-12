export type LinkRecord = {
  slug: string;
  url: string;
  asp: string;
  subIdParam: string | null;
  label: string;
  active: boolean;
  fallbackPath: string;
  note?: string;
  updatedAt: string;
};

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

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

export async function notFound(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = "/404";
  const res = await env.ASSETS.fetch(new Request(url.toString(), request));
  return new Response(res.body, {
    status: 404,
    headers: res.headers,
  });
}

export { SLUG_RE };
