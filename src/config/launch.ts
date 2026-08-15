/**
 * 検索エンジンへの公開可否を切り替えるスイッチの定義元。
 *
 * ドメイン取得済みでコードが動く状態でも、Phase 0（クラスタ・記事・案件）が
 * 未確定のままインデックスされると、新規ドメインにダミー内容が登録される。
 * 回復に時間がかかるため、既定を非公開にして明示的な指定で公開する。
 *
 * `site.ts` と違い `import.meta` を参照しないため、
 * Astro（`import.meta.env`）と Node スクリプト（`process.env`）の両方から読める。
 */

/** この環境変数が "true" のときだけインデックスを許可する */
export const INDEXABLE_ENV_KEY = "PUBLIC_INDEXABLE";

export function isIndexable(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}
