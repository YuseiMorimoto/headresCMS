// サイト全体のメタ情報。ハードコードを一箇所に集約する。
// PUBLIC_SITE_URL はビルド時に注入する。未設定でもローカルビルドが通るよう既定値を持つ。
const url = import.meta.env.PUBLIC_SITE_URL ?? "http://localhost:4321";

export const SITE = {
  name: "レビューメディア",
  catch: "実際に使って比較する",
  url,
  author: "編集部",
  // お問い合わせは Google フォームの埋め込みを使う（自前実装しない）。
  contactFormUrl: "https://docs.google.com/forms/d/e/EXAMPLE/viewform?embedded=true",
} as const;
