import type { JobBoard } from "@/models/automation.model";
import type { JobDetails, ScraperResult } from "../types";

// Keyword-search boards, as opposed to the company-watchlist ATS boards in
// ats/types.ts. These take a free-text query + location and return full job
// details up front, so they all share one downstream dedup/match/save pipeline.
export interface SearchProvider {
  id: JobBoard; // "jsearch" | "arbeitsagentur"
  label: string; // "JSearch" | "Bundesagentur für Arbeit"
  // Credential to resolve per-user before searching; omit for keyless boards.
  apiKeyService?: string;
  search(
    keywords: string,
    location: string,
    apiKey?: string,
  ): Promise<ScraperResult<JobDetails[]>>;
}
