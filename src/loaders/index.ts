import type { Loader } from "astro/loaders";
import { microcmsLoader } from "./microcms.ts";
import { localLoader } from "./local.ts";

export function contentLoader(endpoint: string): Loader {
  const source =
    process.env.CONTENT_SOURCE ?? import.meta.env.CONTENT_SOURCE ?? "local";
  return source === "local" ? localLoader(endpoint) : microcmsLoader(endpoint);
}
