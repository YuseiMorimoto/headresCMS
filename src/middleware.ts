import { defineMiddleware } from "astro:middleware";
import { handleGoRequest } from "@/lib/go-handler.ts";

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  if (url.pathname.startsWith("/go/")) {
    const { env } = await import("cloudflare:workers");
    return handleGoRequest(context.request, env as Env);
  }

  return next();
});
