import { PRODUCTION_IMAGE_BASE, PRODUCTION_SITE_URL, resolveUrl } from "./domain.ts";

const url = resolveUrl(import.meta.env.PUBLIC_SITE_URL, PRODUCTION_SITE_URL);
const imageBase = resolveUrl(import.meta.env.PUBLIC_IMAGE_BASE, PRODUCTION_IMAGE_BASE);

export const site = {
  name: "問いの場",
  catchphrase: "答えではなく、問いを。",
  url,
  imageBase,
  author: {
    name: "編集部",
    url: `${url}/about/`,
  },
  contactFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSf_example/viewform?embedded=true",
  contactFormDirectUrl: "https://docs.google.com/forms/d/e/1FAIpQLSf_example/viewform",
  prNotice: "※本記事にはアフィリエイトリンクを含みます",
} as const;
