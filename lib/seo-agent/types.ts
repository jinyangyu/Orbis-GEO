export type ArticleListItem = {
  id: string;
  batch_id: string;
  sequence_number: number;
  keyword: string;
  title: string;
  status: string;
  status_label: string;
  current_step: string;
  step_status: string;
  review_status: string;
  site: string;
  market: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  preview_url: string;
  preview_ready: boolean;
  snippet?: string;
};

export type ArticleListResponse = {
  items: ArticleListItem[];
  page: number;
  page_size: number;
  total: number;
  auth?: string;
};

export type ArticleListQuery = {
  site?: string;
  market?: string;
  status?: string;
  owner_id?: string;
  q?: string;
  page?: number;
  page_size?: number;
};
