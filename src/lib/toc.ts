export type TocItem = {
  id: string;
  text: string;
  level: 2 | 3;
};

export function extractToc(html: string): TocItem[] {
  const items: TocItem[] = [];
  const re = /<h([23])[^>]*(?:id="([^"]*)")?[^>]*>(.*?)<\/h\1>/gi;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = re.exec(html)) !== null) {
    const level = Number(match[1]) as 2 | 3;
    const id = match[2] || `heading-${index++}`;
    const text = match[3]!.replace(/<[^>]+>/g, "").trim();
    if (text) items.push({ id, text, level });
  }

  return items;
}

export function addHeadingIds(html: string): string {
  let index = 0;
  return html.replace(/<h([23])([^>]*)>(.*?)<\/h\1>/gi, (_full, level, attrs, text) => {
    if (/id=/.test(attrs)) return _full;
    const id = `heading-${index++}`;
    return `<h${level}${attrs} id="${id}">${text}</h${level}>`;
  });
}
