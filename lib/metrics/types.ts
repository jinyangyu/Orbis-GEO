/** Shared types for monitoring metrics APIs and dashboard UI. */

export type MetricsRange = {
  from: string;
  to: string;
  days: number;
};

export type MetricCard = {
  label: string;
  value: string;
  suffix?: string;
  delta: string;
  tone: "mint" | "blue" | "violet" | "amber";
  hint: string;
};

export type PromptMetricRow = {
  promptId: string;
  q: string;
  tag: string;
  market: string;
  coverage: number;
  sentiment: number | null;
  mentions: number;
  citations: number;
  competitor: string;
  competitors: string[];
  status: string;
  brandMentions: number;
  totalBrandMentions: number;
  domainMentions: number;
  totalDomainCitations: number;
  intentVolume: string;
  sentimentBreakdown?: {
    positive: number;
    neutral: number;
    negative: number;
    positivePct: number;
    neutralPct: number;
    negativePct: number;
    label: "Positive" | "Neutral" | "Negative" | "Mixed";
  };
};

export type EngineMetricRow = {
  code: string;
  name: string;
  mark: string;
  coverage: number;
  mentions: number;
  change: string;
  color: string;
};

export type CompetitorSovRow = {
  brandId: string;
  name: string;
  sovPercent: number;
  color: string;
  delta: string;
  mentions: number;
  coverage: number;
  avgPosition: number | null;
  sentiment: number | null;
};

export type CitationDomainRow = {
  domain: string;
  type: string;
  citations: number;
  prompts: number;
  growth: string;
  authority: number;
};

export type BrandMatrixRow = {
  brandId: string;
  name: string;
  domain: string;
  isPrimary: boolean;
  visibility: number;
  coverage: number;
  sovPercent: number;
  sentiment: number | null;
  /** Pos/neu/neg split when sentiment is known (DB or debug heuristic). */
  sentimentBreakdown?: {
    positive: number;
    neutral: number;
    negative: number;
    positivePct: number;
    neutralPct: number;
    negativePct: number;
    label: "Positive" | "Neutral" | "Negative" | "Mixed";
  };
  mentions: number;
  domainCitations: number;
  avgPosition: number | null;
  change: string;
  color: string;
};

export type TrendSeriesPoint = {
  brandId: string;
  name: string;
  coverage: number;
};

export type TrendPoint = {
  date: string;
  series: TrendSeriesPoint[];
};

/** Brand Visibility Index daily scrub frame (Otterly-style). */
export type BviBrandPoint = {
  brandId: string;
  name: string;
  isPrimary: boolean;
  coverage: number;
  /** 0–100 score derived from average mention position (lower position → higher). */
  likelihoodToBuy: number;
  avgPosition: number | null;
};

export type BviFrame = {
  date: string;
  brands: BviBrandPoint[];
};

export type BviMetrics = {
  /** Midlines used to split Niche / Leaders / Low Performance / Low Conversion. */
  coverageMid: number;
  likelihoodMid: number;
  frames: BviFrame[];
};

export type NamedCount = {
  name: string;
  value: number;
  color: string;
};

export type CitedUrlRow = {
  url: string;
  title: string;
  cited: number;
  /** Citation count change vs previous equal-length window (Winners/Losers). */
  delta?: number;
  brandMentioned: "yes" | "no";
  domain: string;
  category: string;
  /** Whether the current user starred this URL. */
  starred?: boolean;
  competitors: Array<{
    brandId: string;
    name: string;
    domain: string;
    mark: string;
    color: string;
  }>;
};

export type DomainCitationShare = {
  domain: string;
  citations: number;
  share: number;
  type: string;
};

export type PromptCountRow = {
  promptId: string;
  q: string;
  count: number;
};

export type OverviewAction = {
  priority: string;
  title: string;
  description: string;
  category: string;
};

export type OverviewMetrics = {
  workspaceId: string;
  workspaceName: string;
  brandName: string;
  brandDomain: string;
  observationCount: number;
  range?: { from: string; to: string; days: number };
  metrics: MetricCard[];
  notice: { title: string; body: string };
  engines: EngineMetricRow[];
  competitors: CompetitorSovRow[];
  ranking: BrandMatrixRow[];
  quadrantLabel: string;
  visibility: number;
  rank: number;
  attentionPrompts: PromptMetricRow[];
  topPromptsByMentions: PromptCountRow[];
  topPromptsByDomainCites: PromptCountRow[];
  actions: OverviewAction[];
  trend: TrendPoint[];
  /** Daily Brand Visibility Index frames for scatter + time-lapse. */
  bvi: BviMetrics;
  promptTotal: number;
  primaryMentions: number;
  avgPosition: number | null;
  domainCoverage: number;
  domainCitations: number;
  citationShare: number;
  competitorMentions: NamedCount[];
  competitorPositions: NamedCount[];
  competitorDomainCites: NamedCount[];
  topCitedUrls: Array<{ url: string; title: string; cited: number }>;
  domainCitationTable: DomainCitationShare[];
};

export type PromptsMetrics = {
  items: PromptMetricRow[];
  total: number;
  markets: string[];
  range?: { from: string; to: string; days: number };
};

export type CitationsMetrics = {
  totalCitations: number;
  range?: { from: string; to: string; days: number };
  structure: Array<{ label: string; percent: number; color: string }>;
  opportunities: Array<{ domain: string; description: string; level: string }>;
  domains: CitationDomainRow[];
  urls: CitedUrlRow[];
  domainCitations: DomainCitationShare[];
  topPromptsByDomainCites: PromptCountRow[];
  winners: CitedUrlRow[];
  losers: CitedUrlRow[];
};

export type BrandsMetrics = {
  primaryName: string;
  visibility: number;
  rank: number;
  quadrantLabel: string;
  matrix: BrandMatrixRow[];
  range?: { from: string; to: string; days: number };
};

export type PromptDetailMetrics = {
  prompt: PromptMetricRow;
  observations: Array<{
    id: string;
    engine: string;
    engineMark: string;
    engineColor: string;
    observedOn: string;
    market: string;
    mentioned: boolean;
    answerText: string;
    citations: Array<{
      url: string;
      title: string;
      position: number;
      domain: string;
    }>;
  }>;
};

export type WorkspaceListItem = {
  id: string;
  name: string;
  slug: string;
  reportTitle: string | null;
  brandName: string | null;
  brandDomain: string | null;
  observationCount: number;
};
