import type { CollectionEntry } from "astro:content";

const STOP_WORDS = new Set([
  "の", "に", "は", "を", "た", "が", "で", "て", "と", "し", "れ", "さ",
  "ある", "いる", "する", "こと", "よう", "ため", "など",
]);

function tokenize(text: string): Map<string, number> {
  const tokens = text
    .toLowerCase()
    .replace(/<[^>]+>/g, " ")
    .split(/[\s、。・「」『』（）()【】\[\],.!?\-_/]+/)
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));

  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  return freq;
}

function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;

  for (const [, v] of a) normA += v * v;
  for (const [, v] of b) normB += v * v;

  for (const [key, va] of a) {
    const vb = b.get(key);
    if (vb) dot += va * vb;
  }

  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export function getRelatedPosts(
  current: CollectionEntry<"posts">,
  allPosts: CollectionEntry<"posts">[],
  limit = 4,
): CollectionEntry<"posts">[] {
  const currentVec = tokenize(
    `${current.data.title} ${current.data.description} ${current.data.body} ${current.data.targetKeywords.join(" ")}`,
  );

  const scored = allPosts
    .filter((p) => p.id !== current.id && !p.data.noindex)
    .map((p) => {
      const vec = tokenize(
        `${p.data.title} ${p.data.description} ${p.data.body} ${p.data.targetKeywords.join(" ")}`,
      );
      let score = cosineSimilarity(currentVec, vec);
      if (p.data.cluster === current.data.cluster) score *= 1.5;
      return { post: p, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.post);
}
