const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]|0\.0\.0\.0)/i;

export function assertSafeFetchUrl(raw: string, allowedHosts: readonly string[]): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("invalid url");
  }
  if (url.protocol !== "https:") throw new Error("https only");
  if (PRIVATE_HOST.test(url.hostname)) throw new Error("private host blocked");
  if (!allowedHosts.includes(url.hostname)) throw new Error(`host not allowed: ${url.hostname}`);
  return url;
}

export type FetchSourceResult =
  | { ok: true; url: string; excerpt: string; status: "ok" }
  | { ok: false; url: string; excerpt: string; status: "failed"; error: string };

export async function fetchOfficialSource(
  raw: string,
  allowedHosts: readonly string[],
  fetcher: (url: URL) => Promise<{ text: string; status: number }>,
): Promise<FetchSourceResult> {
  let url: URL;
  try {
    url = assertSafeFetchUrl(raw, allowedHosts);
  } catch (err) {
    return { ok: false, url: raw, excerpt: "", status: "failed", error: err instanceof Error ? err.message : "blocked" };
  }
  try {
    const res = await fetcher(url);
    if (res.status >= 400) {
      return { ok: false, url: url.toString(), excerpt: "", status: "failed", error: `http ${res.status}` };
    }
    return { ok: true, url: url.toString(), excerpt: res.text.slice(0, 2000), status: "ok" };
  } catch (err) {
    return {
      ok: false,
      url: url.toString(),
      excerpt: "",
      status: "failed",
      error: err instanceof Error ? err.message : "fetch error",
    };
  }
}
