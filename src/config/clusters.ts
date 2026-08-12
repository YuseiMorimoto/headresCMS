export type Cluster = {
  id: string;
  name: string;
  description: string;
  pillarSlug: string;
  order: number;
};

export const CLUSTERS: Cluster[] = [
  {
    id: "example-a",
    name: "例A：ガジェット比較",
    description: "ガジェット製品の比較・レビューをまとめたクラスタです。",
    pillarSlug: "example-a-pillar",
    order: 1,
  },
  {
    id: "example-b",
    name: "例B：健康・ウェルネス",
    description: "健康関連サービスの比較と解説をまとめたクラスタです。",
    pillarSlug: "example-b-pillar",
    order: 2,
  },
  {
    id: "example-c",
    name: "例C：家計・金融",
    description: "家計管理や金融サービスの比較をまとめたクラスタです。",
    pillarSlug: "example-c-pillar",
    order: 3,
  },
];

export const clusterById = new Map(CLUSTERS.map((c) => [c.id, c]));
