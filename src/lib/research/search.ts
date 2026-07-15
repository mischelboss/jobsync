import "server-only";

import { resolveApiKey } from "@/lib/api-key-resolver";
import { RESEARCH_FETCH_TIMEOUT_MS } from "./config";

export interface SearchHit {
  title: string;
  url: string;
  snippet: string;
}

/**
 * Web search via Tavily. Returns [] when no key is configured or on any error —
 * NEVER throws — so callers degrade gracefully (Class 2/3 simply get omitted).
 */
export async function tavilySearch(
  userId: string,
  query: string,
  opts: { maxResults?: number } = {},
): Promise<SearchHit[]> {
  const key = await resolveApiKey(userId, "tavily");
  if (!key) return [];

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        max_results: opts.maxResults ?? 5,
        search_depth: "basic",
      }),
      signal: AbortSignal.timeout(RESEARCH_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return [];

    const data = await res.json();
    const results: unknown[] = Array.isArray(data?.results) ? data.results : [];
    return results
      .map((r): SearchHit => {
        const row = r as Record<string, unknown>;
        return {
          title: typeof row.title === "string" ? row.title : "",
          url: typeof row.url === "string" ? row.url : "",
          snippet: typeof row.content === "string" ? row.content : "",
        };
      })
      .filter((h) => h.url);
  } catch {
    return [];
  }
}
