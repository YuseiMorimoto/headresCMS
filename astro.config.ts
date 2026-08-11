import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import { SITE } from "./src/config/site";

// Workers + Static Assets で配信する。Cloudflare Pages / Pages アダプタは使わない。
// 静的ビルド（SSG）した dist/ を worker/index.ts が ASSETS 経由で配信する。
export default defineConfig({
  site: SITE.url,
  trailingSlash: "always",
  build: {
    format: "directory",
  },
  vite: {
    plugins: [tailwindcss()],
  },
});
