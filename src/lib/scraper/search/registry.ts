import type { JobBoard } from "@/models/automation.model";
import { searchBaJobs } from "../ba";
import { searchJSearchJobs } from "../jsearch";
import type { SearchProvider } from "./types";

// Server-only: imports the real network-calling search fns. Never import this
// from client-bundled code — use isSearchBoard from automation.model.ts for the
// plain "is this board keyword-shaped" check. Mirrors ats/registry.ts.
export const SEARCH_PROVIDERS: Partial<Record<JobBoard, SearchProvider>> = {
  jsearch: {
    id: "jsearch",
    label: "JSearch",
    apiKeyService: "rapidapi",
    search: searchJSearchJobs,
  },
  // Free public API — no key to resolve.
  arbeitsagentur: {
    id: "arbeitsagentur",
    label: "Bundesagentur für Arbeit",
    search: searchBaJobs,
  },
};
