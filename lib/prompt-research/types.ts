export type PromptResearchMode = "keywords" | "url" | "brand";

export type PromptResearchInput = {
  mode: PromptResearchMode;
  workspaceId?: string;
  language: string;
  country: string;
  keywords?: string[];
  url?: string;
  brandName?: string;
  brandDomain?: string;
  brandIndustry?: string;
};

export type ResearchPromptItem = {
  text: string;
  intentScore: number;
  intent?: string;
  funnel?: string;
};

export type PromptResearchResult = {
  prompts: ResearchPromptItem[];
  engine: "llm" | "heuristic";
};

export type PromptResearchJobStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed";

export type PromptResearchJobView = {
  id: string;
  workspaceId: string;
  mode: PromptResearchMode;
  status: PromptResearchJobStatus;
  input: PromptResearchInput;
  result: PromptResearchResult | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};
