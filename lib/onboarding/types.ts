export type ProfileData = {
  firstName: string;
  lastName: string;
  role: "brand" | "agency";
  source: string;
};

export type BrandData = {
  website: string;
  name: string;
  market: string;
  language: string;
};

export type PromptItem = { id: number; text: string; selected: boolean };
export type CompetitorItem = {
  id: number;
  name: string;
  domain: string;
  mark: string;
  color: string;
};

export type Screen =
  | "profile"
  | "brand"
  | "promptLoading"
  | "prompts"
  | "competitorLoading"
  | "competitors"
  | "processing"
  | "tourIntro"
  | "tour"
  | "ready";

export type OnboardingState = {
  version: 1;
  screen: Screen;
  profile: ProfileData;
  brand: BrandData;
  prompts: PromptItem[];
  competitors: CompetitorItem[];
  processingIndex: number;
  tourIndex: number;
  completedAt: string | null;
};

export type WorkspacePayload = {
  workspace: {
    id: string;
    name: string;
    reportTitle: string;
    slug: string;
    onboardingCompletedAt: string | null;
  };
  brand: {
    id: string;
    name: string;
    website: string;
    market: string;
    language: string;
  } | null;
  prompts: Array<{
    id: string;
    text: string;
    sortOrder: number;
    isActive: boolean;
  }>;
  competitors: Array<{
    id: string;
    name: string;
    domain: string;
    mark: string;
    color: string;
    sortOrder: number;
  }>;
  profile: {
    firstName: string;
    lastName: string;
    role: "brand" | "agency";
    source: string;
  } | null;
};
