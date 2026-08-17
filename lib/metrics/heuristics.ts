import type { BrandMatrixRow } from "./types";

/** 0–100 composite (v1 heuristic): coverage + SoV + owned citation share. */
export function visibilityIndex(
  coverage: number,
  sov: number,
  citeShare: number,
): number {
  return Number((0.45 * coverage + 0.35 * sov + 0.2 * citeShare).toFixed(1));
}

/** Map average mention position → 0–100 "Likelihood to buy" (Otterly Y-axis). */
export function likelihoodFromPosition(avgPosition: number | null): number {
  if (avgPosition == null || avgPosition <= 0) return 0;
  return Number(
    Math.max(0, Math.min(100, 100 - (avgPosition - 1) * 12.5)).toFixed(1),
  );
}

export function sentimentFromCoverage(coverage: number): number {
  if (coverage >= 60) return 86;
  if (coverage >= 40) return 74;
  return 62;
}

/** When true, missing DB sentiment falls back to coverage heuristic (debug only). */
export function heuristicSentimentEnabled(): boolean {
  return (process.env.ORBIS_HEURISTIC_SENTIMENT ?? "").trim() === "1";
}

/**
 * Prefer stored mention sentiment; otherwise null (or coverage heuristic if flag on).
 */
export function resolveSentiment(
  dbSentiment: number | null | undefined,
  coverageForHeuristic?: number,
): number | null {
  if (dbSentiment != null && Number.isFinite(Number(dbSentiment))) {
    return Math.round(Number(dbSentiment));
  }
  if (
    heuristicSentimentEnabled() &&
    coverageForHeuristic != null &&
    Number.isFinite(coverageForHeuristic)
  ) {
    return sentimentFromCoverage(coverageForHeuristic);
  }
  return null;
}

/** Deterministic pos/neu/neg split from mention count + sentiment score (v1 heuristic). */
export function estimateSentimentBreakdown(
  mentions: number,
  sentimentScore: number,
): NonNullable<BrandMatrixRow["sentimentBreakdown"]> {
  const total = Math.max(1, Math.round(mentions));
  const posW = Math.min(0.78, Math.max(0.28, (sentimentScore - 40) / 80));
  const negW = Math.min(0.35, Math.max(0.08, (95 - sentimentScore) / 120));
  const neuW = Math.max(0.1, 1 - posW - negW);
  const sumW = posW + neuW + negW;
  let positive = Math.round((posW / sumW) * total);
  let negative = Math.round((negW / sumW) * total);
  let neutral = Math.max(0, total - positive - negative);
  const drift = total - (positive + neutral + negative);
  neutral = Math.max(0, neutral + drift);
  const positivePct = Math.round((positive / total) * 100);
  const negativePct = Math.round((negative / total) * 100);
  const neutralPct = Math.max(0, 100 - positivePct - negativePct);
  let label: "Positive" | "Neutral" | "Negative" | "Mixed" = "Mixed";
  if (positivePct >= 55) label = "Positive";
  else if (negativePct >= 45) label = "Negative";
  else if (neutralPct >= 50) label = "Neutral";
  return {
    positive,
    neutral,
    negative,
    positivePct,
    neutralPct,
    negativePct,
    label,
  };
}
