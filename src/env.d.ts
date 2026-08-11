/// <reference path="../worker/env.d.ts" />

interface Env {
  ASSETS: Fetcher;
  LINKS: KVNamespace;
  CLICKS: AnalyticsEngineDataset;
  SESSION?: KVNamespace;
}
