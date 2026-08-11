import { marked } from "marked";

// body（Markdown 文字列）を HTML へ変換する。
// CMS の rich body は既に HTML の場合があるため、その場合はそのまま通す。
export function renderBody(body: string): string {
  const looksLikeHtml = /^\s*</.test(body);
  if (looksLikeHtml) return body;
  return marked.parse(body, { async: false });
}
