import type { LinkRecord } from "./utils.ts";
import {
  SLUG_RE,
  articlePathFrom,
  deviceHint,
  notFound,
  toSubId,
} from "./utils.ts";

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/go/")) {
      return env.ASSETS.fetch(request);
    }

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
  },
};
