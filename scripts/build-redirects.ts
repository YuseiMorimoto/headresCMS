import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// data/redirects.json をマスタとして public/_redirects を生成する。
// public/_redirects は直接編集しない。build 前（prebuild）に必ず実行する。

type Redirect = {
  from: string;
  to: string;
  code: number;
  reason?: string;
  date?: string;
};

const ROOT = process.cwd();
const SRC = join(ROOT, "data", "redirects.json");
const OUT = join(ROOT, "public", "_redirects");

async function main(): Promise<void> {
  const raw = await readFile(SRC, "utf-8");
  const redirects = JSON.parse(raw) as Redirect[];

  validate(redirects);

  const lines = redirects.map((r) => `${r.from} ${r.to} ${r.code}`);
  await mkdir(join(ROOT, "public"), { recursive: true });
  await writeFile(OUT, lines.join("\n") + "\n", "utf-8");

  console.log(`[build-redirects] ${redirects.length} 件を public/_redirects に生成しました。`);
}

function validate(redirects: Redirect[]): void {
  const froms = new Set(redirects.map((r) => r.from));

  for (const r of redirects) {
    // from と to が同一
    if (r.from === r.to) {
      throw new Error(`[build-redirects] from と to が同一です: ${r.from}`);
    }
    // 多段リダイレクト検出: to が別の from に一致すると連鎖する（_redirects は連鎖しない）
    if (froms.has(r.to)) {
      throw new Error(
        `[build-redirects] 多段リダイレクトを検出しました: ${r.from} → ${r.to}（${r.to} も from に存在）。A→C に書き換えてください。`,
      );
    }
  }

  // from の重複
  const seen = new Set<string>();
  for (const r of redirects) {
    if (seen.has(r.from)) {
      throw new Error(`[build-redirects] from が重複しています: ${r.from}`);
    }
    seen.add(r.from);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
