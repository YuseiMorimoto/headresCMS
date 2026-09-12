const ALLOWED = new Set([
  "p",
  "br",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "h2",
  "h3",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a",
  "blockquote",
  "code",
  "pre",
]);

const VOID = new Set(["br"]);

function stripDangerous(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe\b[\s\S]*?<\/iframe>/gi, "")
    .replace(/on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

export function sanitizeHtml(html: string): string {
  const cleaned = stripDangerous(html);
  return cleaned.replace(/<\/?([a-zA-Z0-9]+)([^>]*)>/g, (full, rawName: string, rawAttrs: string) => {
    const name = rawName.toLowerCase();
    const closing = full.startsWith("</");
    if (!ALLOWED.has(name)) return "";
    if (closing) return `</${name}>`;
    if (name === "a") {
      const href = rawAttrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i);
      const value = href?.[2] ?? href?.[3] ?? "";
      if (!value.startsWith("/go/") && !value.startsWith("#") && !value.startsWith("/c/")) {
        return "<a>";
      }
      return `<a href="${value}">`;
    }
    if (VOID.has(name)) return `<${name}>`;
    return `<${name}>`;
  });
}

export function hasUnsafeHtml(html: string): boolean {
  return /<script\b/i.test(html) || /javascript:/i.test(html) || /<iframe\b/i.test(html);
}
