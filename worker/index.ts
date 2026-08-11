// /go/{offerSlug} のアフィリエイト遷移（302）だけを担当する。
// サイト内の 301 は _redirects（Static Assets）が処理し、Worker では実装しない。
// それ以外のリクエストは env.ASSETS.fetch に委譲する。

interface Env {
  ASSETS: Fetcher;
  LINKS: KVNamespace;
  CLICKS: AnalyticsEngineDataset;
}

type LinkRecord = {
  url: string;
  asp: string;
  subIdParam: string | null;
  label: string;
  active: boolean;
  fallbackPath: string;
};

const SLUG_RE = /^[a-z0-9-]{1,64}$/;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/go/")) {
      return env.ASSETS.fetch(request);
    }

    const slug = url.pathname.slice(4).replace(/\/$/, "");
    if (!SLUG_RE.test(slug)) return notFound(env, request);

    const record = await env.LINKS.get<LinkRecord>(`link:${slug}`, "json");
    if (!record) return notFound(env, request);

    if (!record.active) {
      return Response.redirect(
        new URL(record.fallbackPath, url.origin).toString(),
        302,
      );
    }

    const dest = new URL(record.url);
    // オープンリダイレクト防止: https 以外は拒否する。
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
        request.cf?.country ?? "unknown",
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
} satisfies ExportedHandler<Env>;

// referer が同一オリジンなら pathname、それ以外/空なら "external"。
function articlePathFrom(referer: string | null, origin: string): string {
  if (!referer) return "external";
  try {
    const ref = new URL(referer);
    return ref.origin === origin ? ref.pathname : "external";
  } catch {
    return "external";
  }
}

// 英数とハイフンのみに正規化し、前後スラッシュを除去、最大40文字に切り詰める。
function toSubId(path: string): string {
  return path
    .replace(/[^a-zA-Z0-9-]/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function deviceHint(ua: string | null): "mobile" | "desktop" {
  return ua && /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop";
}

// 404 は Worker が /404 の HTML を取得して status 404 で返す。
async function notFound(env: Env, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const res = await env.ASSETS.fetch(new URL("/404", url.origin));
  return new Response(res.body, {
    status: 404,
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
