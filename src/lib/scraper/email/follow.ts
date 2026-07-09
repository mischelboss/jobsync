import { flattenHtml } from "../greenhouse";

const FETCH_TIMEOUT_MS = 8_000;
const MIN_USEFUL_CHARS = 400;
const MAX_TEXT_CHARS = 12_000;

// Hosts that reliably serve a login/consent wall to unauthenticated fetches —
// following them just wastes a request, so we skip straight to the snippet.
const WALLED_HOSTS = [
  "linkedin.com",
  "lnkd.in",
  "glassdoor.com",
  "indeed.com",
];

// Heuristic markers that the page we got back is a wall/captcha, not the posting.
const WALL_MARKERS = [
  "authwall",
  "captcha",
  "please enable javascript",
  "sign in to continue",
  "log in to continue",
  "cf-challenge",
];

function isWalledHost(url: URL): boolean {
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  return WALLED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
}

// Best-effort full-text fetch for a single job link. Returns cleaned text on
// success, or null on any wall/captcha/error/timeout so the caller falls back to
// the email snippet. NEVER throws.
//
// TODO(ba): arbeitsagentur.de links could load the full posting via the BA API
// (see src/lib/scraper/ba) instead of scraping HTML — a future enhancement.
export async function followJobLink(rawUrl: string): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (isWalledHost(url)) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; JobSyncBot/1.0; +https://jobsync.local)",
        Accept: "text/html,application/xhtml+xml",
      },
    });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("html") && !contentType.includes("text")) {
      return null;
    }

    const html = await res.text();
    const lower = html.toLowerCase();
    if (WALL_MARKERS.some((m) => lower.includes(m))) return null;

    const text = flattenHtml(html);
    if (text.length < MIN_USEFUL_CHARS) return null;
    return text.slice(0, MAX_TEXT_CHARS);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
