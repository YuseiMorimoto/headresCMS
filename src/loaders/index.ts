import type { Loader } from "astro/loaders";
import { microcmsLoader } from "./microcms";
import { localLoader } from "./local";

// CONTENT_SOURCE で loader を切り替える。既定は microcms。
// CMS 停止時は CONTENT_SOURCE=local に切り替えるだけでサイトを維持できる。
export function contentLoader(endpoint: string): Loader {
  const source = import.meta.env.CONTENT_SOURCE ?? "microcms";
  return source === "local" ? localLoader(endpoint) : microcmsLoader(endpoint);
}
