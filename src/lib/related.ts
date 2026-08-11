import type { Post } from "./content";

// 本文からキーワードベクトルを作り、コサイン類似度で関連記事を算出する。
// 同一クラスタを優先（係数1.5）。自分自身と noindex は除外。上位4件を返す。
// 300記事規模ならビルド時の全対全計算で十分。
export function relatedPosts(target: Post, all: Post[], limit = 4): Post[] {
  const targetVec = vectorize(text(target));

  const scored = all
    .filter((p) => p.id !== target.id && !p.data.noindex)
    .map((p) => {
      const sim = cosine(targetVec, vectorize(text(p)));
      const boost = p.data.cluster === target.data.cluster ? 1.5 : 1;
      return { post: p, score: sim * boost };
    })
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map((s) => s.post);
}

function text(post: Post): string {
  return [post.data.title, post.data.targetKeywords.join(" "), post.data.body].join(
    " ",
  );
}

function vectorize(input: string): Map<string, number> {
  const vec = new Map<string, number>();
  for (const token of tokenize(input)) {
    vec.set(token, (vec.get(token) ?? 0) + 1);
  }
  return vec;
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[#*`>\-|[\]()!]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  for (const [key, va] of a) {
    const vb = b.get(key);
    if (vb) dot += va * vb;
  }
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dot / (magA * magB);
}

function magnitude(vec: Map<string, number>): number {
  let sum = 0;
  for (const v of vec.values()) sum += v * v;
  return Math.sqrt(sum);
}
