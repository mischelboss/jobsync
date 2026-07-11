/**
 * Interview-prep research configuration.
 *
 * Kept free of server-only imports so it can be referenced from anywhere.
 */

/** Cached company context / process research is re-fetched after this age. */
export const RESEARCH_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** Sentinel passed as {{companyContext}} when no company context is available.
 *  The interview-prep system prompt treats this as "return empty Class 2". */
export const NO_COMPANY_CONTEXT = "NONE";

/** Per-page fetch timeout for research scraping. */
export const RESEARCH_FETCH_TIMEOUT_MS = 8_000;

/** Minimum concatenated source characters worth sending to the LLM. */
export const MIN_RESEARCH_CHARS = 400;

/** Max concatenated source characters sent to the LLM. */
export const MAX_RESEARCH_CHARS = 12_000;
