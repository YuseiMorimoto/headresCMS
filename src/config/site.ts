import { PR_NOTICE } from "./brand.ts";
import { PRODUCTION_IMAGE_BASE, PRODUCTION_SITE_URL, resolveUrl } from "./domain.ts";

const url = resolveUrl(import.meta.env.PUBLIC_SITE_URL, PRODUCTION_SITE_URL);
const imageBase = resolveUrl(import.meta.env.PUBLIC_IMAGE_BASE, PRODUCTION_IMAGE_BASE);

/** 一覧ページと sitemap のページ数計算で共有する（値の乖離を防ぐ） */
export const POSTS_PER_PAGE = 20;

/** impact.com のサイト所有権確認。公開 HTML に出す値であり、API 秘密ではない。トップページの head のみ。 */
export const IMPACT_SITE_VERIFICATION = "3412605a-25bd-4780-9514-8c384b3342cb";

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
  prNotice: PR_NOTICE,
} as const;
