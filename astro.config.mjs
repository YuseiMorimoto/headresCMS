// @ts-check
import { defineConfig } from "astro/config";
import cloudflare from "@astrojs/cloudflare";
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
