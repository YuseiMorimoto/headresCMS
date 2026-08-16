import { getCollection, type CollectionEntry } from "astro:content";

export type PostEntry = CollectionEntry<"posts">;

/**
 * microCMS が 0 件の初期セットアップでは、Astro が
 * 「collection does not exist or is empty」で throw する。
 * 記事が無いこと自体はセットアップとして正常なので空配列を返す。
 * 設定ミスなど別のエラーは握りつぶさない。
 */
export async function getPosts(
  filter?: (entry: PostEntry) => boolean,
): Promise<PostEntry[]> {
  try {
    return await getCollection("posts", filter);
  } catch (error) {
    if (isEmptyCollectionError(error)) {
      return [];
    }
    throw error;
  }
}

function isEmptyCollectionError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("does not exist or is empty");
}
