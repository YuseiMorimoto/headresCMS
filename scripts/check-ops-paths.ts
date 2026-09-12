import { execSync } from "node:child_process";
import { isOpsSafePath } from "../src/ops/connectors/publisher.ts";

const range = process.argv[2] ?? "HEAD~1..HEAD";
const output = execSync(`git diff --name-only ${range}`, { encoding: "utf-8" });
const files = output.split("\n").map((line) => line.trim()).filter(Boolean);
const unsafe = files.filter((file) => !isOpsSafePath(file));

if (process.env.OPS_COMMIT === "1" && unsafe.length > 0) {
  console.error("ops bot が許可外パスを変更しています:");
  for (const file of unsafe) console.error(`  ${file}`);
  process.exit(1);
}

console.log(`✓ ops path check: ${files.length} files (OPS_COMMIT=${process.env.OPS_COMMIT ?? "0"})`);
