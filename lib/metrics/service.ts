/**
 * Metrics facade: keep existing `@/lib/metrics/service` imports stable.
 */
export {
  estimateSentimentBreakdown,
  likelihoodFromPosition,
  resolveSentiment,
  sentimentFromCoverage,
  visibilityIndex,
} from "./heuristics";

export type { MetricsRange } from "./types";
export type { MetricsQueryOpts } from "./shared";
export { resolveMetricsRange } from "./shared";
export {
  listMonitoringWorkspaces,
  resolveWorkspaceId,
} from "./workspaces";
export { getOverviewMetrics, getBrandsMetrics } from "./overview";
export { getPromptsMetrics, getPromptDetailMetrics } from "./prompts";
export { getCitationsMetrics } from "./citations";
