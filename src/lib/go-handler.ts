import type { LinkRecord } from "./go-types.ts";
import {
  SLUG_RE,
  articlePathFrom,
  deviceHint,
  toSubId,
} from "./go-types.ts";

export async function handleGoRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const slug = url.pathname.slice(4).replace(/\/$/, "");
  if (!SLUG_RE.test(slug)) return notFound(env, request);

  const record = await env.LINKS.get<LinkRecord>(`link:${slug}`, "json");
  if (!record) return notFound(env, request);

  if (!record.active) {
    return Response.redirect(new URL(record.fallbackPath, url.origin).toString(), 302);
  }

  const dest = new URL(record.url);
  if (dest.protocol !== "https:") return notFound(env, request);

  const article = articlePathFrom(request.headers.get("referer"), url.origin);
  if (record.subIdParam) {
    dest.searchParams.set(record.subIdParam, toSubId(article));
  }

  env.CLICKS.writeDataPoint({
    indexes: [slug],
    blobs: [
      slug,
      article,
      record.asp,
      String(request.cf?.country ?? "unknown"),
      deviceHint(request.headers.get("user-agent")),
    ],
    doubles: [1],
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: dest.toString(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer-when-downgrade",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

async function notFound(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = "/404";
  const res = await env.ASSETS.fetch(new Request(url.toString(), request));
  return new Response(res.body, { status: 404, headers: res.headers });
}
