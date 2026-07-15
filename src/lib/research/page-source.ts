import "server-only";

import { fetchPageText } from "@/lib/scraper/email/follow";
import { RESEARCH_FETCH_TIMEOUT_MS } from "./config";

/**
 * A source of cleaned page text. The default implementation uses plain fetch +
 * flattenHtml (no JS rendering). A PlaywrightPageSource can be added later
 * behind this same interface without touching callers or the Docker image.
 */
export interface PageSource {
  /** Best-effort cleaned page text. Returns null on wall/captcha/error/timeout.
   *  NEVER throws. */
  fetch(url: string): Promise<string | null>;
}

/** Default adapter: reuses the scraper's fetch+flatten pipeline, and (unlike
 *  email link following) attempts walled hosts, degrading via WALL_MARKERS. */
export class FetchPageSource implements PageSource {
  fetch(url: string): Promise<string | null> {
    return fetchPageText(url, {
      allowWalled: true,
      timeoutMs: RESEARCH_FETCH_TIMEOUT_MS,
    });
  }
}
