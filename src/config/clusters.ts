export type Cluster = {
  id: string; // URL に使う。a-z0-9-
  name: string; // 表示名
  description: string; // クラスタ一覧ページの導入文
  pillarSlug: string; // ピラー記事の id
  order: number;
};

// Phase 0 で 12〜15件に差し替える。開発中はダミーで進める。
export const CLUSTERS: Cluster[] = [
  {
    id: "example-a",
    name: "例カテゴリA",
    description: "例カテゴリAに関する比較・レビュー・解説記事のまとめ。",
    pillarSlug: "example-a-pillar",
    order: 1,
  },
];

export function getCluster(id: string): Cluster | undefined {
  return CLUSTERS.find((c) => c.id === id);
}
