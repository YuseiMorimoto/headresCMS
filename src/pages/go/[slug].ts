import type { APIRoute } from "astro";
import { handleGoRequest } from "@/lib/go-handler.ts";

// 静的出力では middleware が /go/ に到達しないため、SSR エンドポイントとして
// サーバーマニフェストに登録する（/preview/ と同じ方式）。
export const prerender = false;

export const GET: APIRoute = async (context) => {
  const { env } = await import("cloudflare:workers");
  return handleGoRequest(context.request, env as Env);
};
