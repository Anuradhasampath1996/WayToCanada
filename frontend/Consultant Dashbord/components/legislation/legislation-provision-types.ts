export type MapleSummary = {
  summary: string;
  key_points: string[];
  openai_used?: boolean;
};

export type ResolvedProvision = {
  act_code: string;
  provision_key: string;
  language: string;
  marginal_note: string | null;
  text_content: string;
  html_fragment: string;
  popup_html?: string;
  citation: string;
  document: { id: number; title: string; slug: string };
  maple_summary?: MapleSummary | null;
  summary_available?: boolean;
};
