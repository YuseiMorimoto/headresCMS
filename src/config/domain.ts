/**
 * 本番ドメインの単一の定義元。
 *
 * Astro 側は `import.meta.env`、Node スクリプト側は `process.env` で上書きするため、
 * どちらからも読める「`import.meta` を参照しないモジュール」として分離している。
 * ここを書き換えれば、サイトURL・画像ベースURLの既定値が全体に伝播する。
 */
export const PRODUCTION_SITE_URL = "https://toinoba.com";
export const PRODUCTION_IMAGE_BASE = "https://img.toinoba.com";

/** 末尾スラッシュの有無でURL連結が壊れるのを防ぐ。 */
function normalizeUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/**
 * GitHub Actions は未設定の Variables を空文字として渡すため、`??` では既定値に落ちない。
 * 空文字・空白のみも「未設定」として扱う。
 */
export function resolveUrl(value: string | undefined, fallback: string): string {
  const candidate = value?.trim();
  return normalizeUrl(candidate ? candidate : fallback);
}
