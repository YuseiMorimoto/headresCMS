import type { Topic, TopicTemplate } from "./types.ts";

const TEMPLATES: TopicTemplate[] = [
  "conditional_compare",
  "pricing_sim",
  "use_case_pick",
  "free_plan_limits",
  "switch_checklist",
];

export function proposeTopics(input: {
  cluster: string;
  audience: string;
  problems: string[];
  existingIntents: string[];
  maxCandidates?: number;
  select?: number;
}): Topic[] {
  const max = input.maxCandidates ?? 10;
  const select = input.select ?? 2;
  const uniqueProblems = [...new Set(input.problems.map((p) => p.trim()).filter(Boolean))];
  const topics: Topic[] = [];
  for (const [index, problem] of uniqueProblems.entries()) {
    if (topics.length >= max) break;
    const intent = `${input.audience} ${problem}`;
    if (input.existingIntents.includes(intent)) continue;
    const template = TEMPLATES[index % TEMPLATES.length]!;
    topics.push({
      id: `topic-${topics.length + 1}`,
      searchIntent: intent,
      template,
      cluster: input.cluster,
      articleType:
        template === "conditional_compare" || template === "pricing_sim" ? "comparison" : "guide",
      audience: input.audience,
      selected: topics.length < select,
    });
  }
  return topics;
}
