export type NotifyKind = "disconnect" | "publish_fail" | "material_change" | "budget";

export type OpsNotice = {
  kind: NotifyKind;
  title: string;
  body: string;
  urgent: boolean;
};

export function buildNotice(kind: NotifyKind, detail: string): OpsNotice {
  const titles: Record<NotifyKind, string> = {
    disconnect: "接続切れ",
    publish_fail: "公開失敗",
    material_change: "重大な条件変更",
    budget: "予算制限",
  };
  return {
    kind,
    title: titles[kind],
    body: detail,
    urgent: true,
  };
}

export function weeklyDigest(lines: string[]): OpsNotice {
  return {
    kind: "disconnect",
    title: "週次まとめ",
    body: lines.join("\n"),
    urgent: false,
  };
}

export async function postGitHubIssue(
  input: {
    repo: string;
    token: string;
    title: string;
    body: string;
    labels: string[];
  },
  fetcher: typeof fetch = fetch,
): Promise<{ ok: boolean; status: number }> {
  const [owner, name] = input.repo.split("/");
  if (!owner || !name || !/^[A-Za-z0-9_.-]+$/.test(owner) || !/^[A-Za-z0-9_.-]+$/.test(name)) {
    throw new Error("invalid repo");
  }
  const res = await fetcher(`https://api.github.com/repos/${owner}/${name}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "toinoba-ops",
    },
    body: JSON.stringify({ title: input.title, body: input.body, labels: input.labels }),
  });
  return { ok: res.ok, status: res.status };
}
