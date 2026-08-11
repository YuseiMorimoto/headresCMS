export const site = {
  name: "サンプルアフィリエイトメディア",
  catchphrase: "比較・レビューで選ぶ",
  url: import.meta.env.PUBLIC_SITE_URL ?? "https://example.com",
  imageBase: import.meta.env.PUBLIC_IMAGE_BASE ?? "https://img.example.com",
  author: {
    name: "編集部",
    url: "https://example.com/about/",
  },
  contactFormUrl: "https://docs.google.com/forms/d/e/1FAIpQLSf_example/viewform?embedded=true",
  contactFormDirectUrl: "https://docs.google.com/forms/d/e/1FAIpQLSf_example/viewform",
  prNotice: "※本記事にはアフィリエイトリンクを含みます",
} as const;
