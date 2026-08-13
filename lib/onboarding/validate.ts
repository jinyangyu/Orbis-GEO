import type { OnboardingState, Screen } from "./types";

const SCREENS = new Set<Screen>([
  "profile",
  "brand",
  "promptLoading",
  "prompts",
  "competitorLoading",
  "competitors",
  "processing",
  "tourIntro",
  "tour",
  "ready",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function isValidOnboardingState(value: unknown): value is OnboardingState {
  if (!isObject(value)) return false;
  if (value.version !== 1) return false;
  if (typeof value.screen !== "string" || !SCREENS.has(value.screen as Screen)) {
    return false;
  }
  if (!isObject(value.profile)) return false;
  if (typeof value.profile.firstName !== "string") return false;
  if (typeof value.profile.lastName !== "string") return false;
  if (value.profile.role !== "brand" && value.profile.role !== "agency") {
    return false;
  }
  if (typeof value.profile.source !== "string") return false;

  if (!isObject(value.brand)) return false;
  if (typeof value.brand.website !== "string") return false;
  if (typeof value.brand.name !== "string") return false;
  if (typeof value.brand.market !== "string") return false;
  if (typeof value.brand.language !== "string") return false;

  if (!Array.isArray(value.prompts) || !Array.isArray(value.competitors)) {
    return false;
  }
  if (typeof value.processingIndex !== "number") return false;
  if (typeof value.tourIndex !== "number") return false;
  if (value.completedAt !== null && typeof value.completedAt !== "string") {
    return false;
  }
  return true;
}
