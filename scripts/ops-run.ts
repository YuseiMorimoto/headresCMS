import { readFileSync } from "node:fs";
import { dueJobKinds, parseOpsSettings } from "../src/ops/settings.ts";

const settings = parseOpsSettings(
  JSON.parse(readFileSync(new URL("../data/ops-settings.json", import.meta.url), "utf-8")),
);

const kind = process.argv[2];
if (!kind) {
  const due = dueJobKinds(settings, new Date(), new Set());
  console.log(JSON.stringify({ automationEnabled: settings.automationEnabled, due }, null, 2));
  process.exit(0);
}

if (!["sync", "plan", "analyze", "generate", "review", "publish", "improve", "detect"].includes(kind)) {
  throw new Error(`unknown job: ${kind}`);
}

console.log(`job ${kind} は src/ops のワークフローをローカルで実行する入口です。実接続は環境変数が必要です。`);
