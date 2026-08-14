/**
 * microCMS Webhook → GitHub repository_dispatch プロキシ
 *
 * microCMS の Webhook 署名を検証し、content-published イベントを GitHub に転送する。
 * GitHub トークンを microCMS 管理画面に置かないためのプロキシ Worker。
 */

interface Env {
  MICROCMS_WEBHOOK_SECRET: string;
  GITHUB_DISPATCH_TOKEN: string;
  GITHUB_REPO: string; // "owner/repo"
}

async function verifySignature(
  body: string,
  signature: string | null,
  secret: string,
): Promise<boolean> {
  if (!signature) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const expected = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const provided = signature.replace(/^sha256=/, "");
  return expected === provided;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405 });
    }

    const body = await request.text();
    const signature = request.headers.get("X-MICROCMS-Signature");

    const valid = await verifySignature(body, signature, env.MICROCMS_WEBHOOK_SECRET);
    if (!valid) {
      return new Response("Invalid signature", { status: 401 });
    }

    const [owner, repo] = env.GITHUB_REPO.split("/");
    if (!owner || !repo) {
      return new Response("Invalid GITHUB_REPO config", { status: 500 });
    }

    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "toinoba-webhook-proxy",
      },
      body: JSON.stringify({ event_type: "content-published" }),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(`GitHub dispatch failed: ${res.status} ${text}`, { status: 502 });
    }

    return new Response("OK", { status: 200 });
  },
};
