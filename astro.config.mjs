// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";
import { PRODUCTION_IMAGE_BASE, PRODUCTION_SITE_URL, resolveUrl } from "./src/config/domain.ts";

const siteUrl = resolveUrl(process.env.PUBLIC_SITE_URL, PRODUCTION_SITE_URL);
const imageBase = resolveUrl(process.env.PUBLIC_IMAGE_BASE, PRODUCTION_IMAGE_BASE);

/** @type {import('astro').AstroUserConfig} */
export default defineConfig({
  site: siteUrl,
  output: "static",
  adapter: cloudflare({
    imageService: "passthrough",
  }),
  trailingSlash: "always",
  build: {
    format: "directory",
  },
  integrations: [
    sitemap({
      filter: (page) => {
        if (page.includes("/preview/")) return false;
        if (page.includes("/contact/")) return false;
        return true;
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
  },
  image: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: new URL(imageBase).hostname,
      },
    ],
  },
});
