export type ReportFiltersPayload = {
  rangeLabel?: string;
  from?: string;
  to?: string;
  days?: number;
  engineLabel?: string;
  tagLabel?: string;
  marketLabel?: string;
  reportType?: "document" | "presentation";
  visibility?: number | null;
  coverage?: number | null;
  brandName?: string;
};

export function serializeReportFilters(
  filters: ReportFiltersPayload,
): ReportFiltersPayload {
  return {
    rangeLabel: filters.rangeLabel ?? "",
    from: filters.from ?? "",
    to: filters.to ?? "",
    days: filters.days ?? 30,
    engineLabel: filters.engineLabel ?? "",
    tagLabel: filters.tagLabel ?? "",
    marketLabel: filters.marketLabel ?? "",
    reportType:
      filters.reportType === "presentation" ? "presentation" : "document",
    visibility: filters.visibility ?? null,
    coverage: filters.coverage ?? null,
    brandName: filters.brandName ?? "",
  };
}
