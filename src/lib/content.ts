import { getCollection, type CollectionEntry } from "astro:content";
import { CLUSTERS } from "../config/clusters";

export type Post = CollectionEntry<"posts">;

// 公開記事のみ（下書き除外は loader 側、ここでは noindex を除外しない＝ページは出すが sitemap で除く）。
export async function getPosts(): Promise<Post[]> {
  const posts = await getCollection("posts");
  validate(posts);
  return posts.sort(
    (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
  );
}

export async function getPostsByCluster(clusterId: string): Promise<Post[]> {
  const posts = await getPosts();
  return posts.filter((p) => p.data.cluster === clusterId);
}

// ビルド時にデータ整合性を検証する。違反があればビルドを失敗させる。
function validate(posts: Post[]): void {
  const clusterIds = new Set(CLUSTERS.map((c) => c.id));

  for (const post of posts) {
    if (!clusterIds.has(post.data.cluster)) {
      throw new Error(
        `記事 "${post.id}" の cluster "${post.data.cluster}" が clusters.ts に存在しません。`,
      );
    }
  }

  for (const cluster of CLUSTERS) {
    const pillars = posts.filter(
      (p) => p.data.cluster === cluster.id && p.data.isPillar,
    );
    if (pillars.length !== 1) {
      throw new Error(
        `クラスタ "${cluster.id}" の isPillar 記事はちょうど1件必要です（現在 ${pillars.length} 件）。`,
      );
    }
  }
}
