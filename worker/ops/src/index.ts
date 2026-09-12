import { authorizeSecret, extractBearer } from "../../../src/ops/auth.ts";
import { DEFAULT_OPS_SETTINGS } from "../../../src/ops/default-settings.ts";
import { dueJobKinds } from "../../../src/ops/settings.ts";

export interface OpsEnv {
  DB: D1Database;
  OPS_BUCKET: R2Bucket;
  OPS_TRIGGER_SECRET: string;
  PREVIEW_TOKEN?: string;
  AUTOMATION_DISABLED?: string;
}

const settings = DEFAULT_OPS_SETTINGS;

export default {
  async fetch(request: Request, env: OpsEnv): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "GET" && url.pathname === "/healthz") {
      return Response.json({
        ok: true,
        automationEnabled: settings.automationEnabled && env.AUTOMATION_DISABLED !== "1",
      });
    }

    if (request.method === "GET" && url.pathname === "/preview-version") {
      const token = url.searchParams.get("token");
      const versionId = url.searchParams.get("v") ?? "";
      if (!/^[a-z0-9-]{1,80}$/.test(versionId)) {
        return new Response("invalid version", { status: 400 });
      }
      if (!authorizeSecret(token, env.PREVIEW_TOKEN)) {
        return new Response("unauthorized", { status: 401 });
      }
      const row = await env.DB.prepare("SELECT * FROM article_versions WHERE id = ?").bind(versionId).first();
      if (!row) return new Response("not found", { status: 404 });
      return Response.json(row);
    }

    if (request.method === "POST" && url.pathname.startsWith("/jobs/")) {
      const kind = url.pathname.slice("/jobs/".length);
      if (!/^(sync|plan|analyze|generate|review|publish|improve|detect)$/.test(kind)) {
        return new Response("unknown job", { status: 404 });
      }
      if (!authorizeSecret(extractBearer(request.headers.get("authorization")), env.OPS_TRIGGER_SECRET)) {
        return new Response("unauthorized", { status: 401 });
      }
      if (env.AUTOMATION_DISABLED === "1" && kind !== "sync") {
        return Response.json({ ok: false, reason: "automation_disabled" }, { status: 409 });
      }
      return Response.json({ ok: true, queued: kind });
    }

    return new Response("not found", { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: OpsEnv): Promise<void> {
    if (env.AUTOMATION_DISABLED === "1" || !settings.automationEnabled) return;
    const now = new Date();
    const rows = await env.DB.prepare("SELECT key FROM ran_keys").all<{ key: string }>();
    const already = new Set((rows.results ?? []).map((r) => r.key));
    const due = dueJobKinds(settings, now, already);
    for (const kind of due) {
      const date = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Tokyo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(now);
      await env.DB.prepare("INSERT OR IGNORE INTO ran_keys (key) VALUES (?)").bind(`${kind}:${date}`).run();
    }
  },
};
