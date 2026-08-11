// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

const siteUrl = process.env.PUBLIC_SITE_URL ?? "https://example.com";
const imageBase = process.env.PUBLIC_IMAGE_BASE ?? "https://img.example.com";

/** @type {import('astro').AstroUserConfig} */
export default defineConfig({
  site: siteUrl,
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
