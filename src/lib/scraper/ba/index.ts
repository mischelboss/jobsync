import type { JobDetails, ScraperResult, ScraperError } from "../types";

// Bundesagentur für Arbeit Jobbörse — the largest legal German job source,
// free via the official app endpoint. Endpoint and fixed API key are not
// contractually guaranteed and can change, so every call is defensively
// error-mapped (a failure becomes a run error, never a crash).
const BA_BASE_URL =
  "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service/pc/v4";
const BA_API_KEY = "jobboerse-jobsuche";
// Public job detail page, used as the canonical URL for dedup and storage.
const BA_JOBDETAIL_PAGE = "https://www.arbeitsagentur.de/jobsuche/jobdetail/";

// Days back to search and how many hits to pull. The runner dedups and caps
// to its own per-run limit afterwards.
const PUBLISHED_SINCE_DAYS = 7;
const SEARCH_SIZE = 25;

interface BaArbeitsort {
  plz?: string;
  ort?: string;
  region?: string;
}

interface BaStellenangebot {
  titel?: string;
  beruf?: string;
  refnr: string;
  arbeitgeber?: string;
  arbeitsort?: BaArbeitsort;
}

interface BaSearchResponse {
  stellenangebote?: BaStellenangebot[];
}

interface BaJobDetails {
  stellenangebotsTitel?: string;
  stellenangebotsBeschreibung?: string;
  firma?: string;
  hauptberuf?: string;
  referenznummer?: string;
  datumErsteVeroeffentlichung?: string;
  verguetungsangabe?: string;
  stellenlokationen?: Array<{
    adresse?: { plz?: string; ort?: string; region?: string };
  }>;
}

function formatLocation(ort?: string, region?: string, plz?: string): string {
  const parts = [ort, region].filter(
    (part, index, arr): part is string =>
      Boolean(part) && arr.indexOf(part) === index,
  );
  const location = parts.join(", ");
  if (location && plz) return `${plz} ${location}`;
  return location || plz || "";
}

function detailUrlForRefnr(refnr: string): string {
  return `${BA_JOBDETAIL_PAGE}${encodeURIComponent(refnr)}`;
}

function mapHttpError(status: number, statusText: string): ScraperError {
  if (status === 429) return { type: "rate_limited", retryAfter: 60 };
  if (status === 403)
    return { type: "blocked", reason: "Bundesagentur API access denied" };
  return {
    type: "network",
    message: `Bundesagentur API error: ${status} ${statusText}`,
  };
}

// Fetch the full posting for one reference number.
async function fetchBaDetails(
  refnr: string,
): Promise<ScraperResult<JobDetails>> {
  const encoded = Buffer.from(refnr).toString("base64");
  const response = await fetch(`${BA_BASE_URL}/jobdetails/${encoded}`, {
    method: "GET",
    headers: { "X-API-Key": BA_API_KEY },
  });

  if (!response.ok) {
    return { success: false, error: mapHttpError(response.status, response.statusText) };
  }

  const data: BaJobDetails = await response.json();
  const adresse = data.stellenlokationen?.[0]?.adresse;
  const salary =
    data.verguetungsangabe && data.verguetungsangabe !== "KEINE_ANGABEN"
      ? data.verguetungsangabe
      : undefined;

  return {
    success: true,
    data: {
      title: data.stellenangebotsTitel || data.hauptberuf || "",
      company: data.firma || "",
      location: formatLocation(adresse?.ort, adresse?.region, adresse?.plz),
      description: data.stellenangebotsBeschreibung || "",
      url: detailUrlForRefnr(data.referenznummer || refnr),
      postedDate: data.datumErsteVeroeffentlichung,
      salary,
    },
  };
}

/**
 * Search the Bundesagentur Jobbörse and return full job details.
 *
 * Two-stage by nature: the search endpoint returns a list without full text, so
 * we fetch each posting's detail endpoint. Mirrors searchJSearchJobs so the
 * runner's JSearch pipeline can consume the result unchanged.
 */
export async function searchBaJobs(
  keywords: string,
  location: string,
): Promise<ScraperResult<JobDetails[]>> {
  try {
    const url = new URL(`${BA_BASE_URL}/jobs`);
    url.searchParams.set("was", keywords);
    url.searchParams.set("wo", location);
    url.searchParams.set("angebotsart", "1");
    url.searchParams.set("veroeffentlichtseit", String(PUBLISHED_SINCE_DAYS));
    url.searchParams.set("size", String(SEARCH_SIZE));
    url.searchParams.set("page", "1");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { "X-API-Key": BA_API_KEY },
    });

    if (!response.ok) {
      return { success: false, error: mapHttpError(response.status, response.statusText) };
    }

    const data: BaSearchResponse = await response.json();
    const listings = data.stellenangebote || [];

    const jobs: JobDetails[] = [];
    for (const listing of listings) {
      if (!listing.refnr) continue;
      const detail = await fetchBaDetails(listing.refnr);
      if (detail.success) {
        jobs.push(detail.data);
        continue;
      }
      // Surface rate limiting to the run so it is logged, not swallowed.
      if (detail.error.type === "rate_limited") {
        return { success: false, error: detail.error };
      }
      // Other per-posting failures: fall back to the search-list fields so the
      // hit is not lost (description is thinner but matching can still run).
      jobs.push({
        title: listing.titel || listing.beruf || "",
        company: listing.arbeitgeber || "",
        location: formatLocation(
          listing.arbeitsort?.ort,
          listing.arbeitsort?.region,
          listing.arbeitsort?.plz,
        ),
        description: listing.beruf || "",
        url: detailUrlForRefnr(listing.refnr),
      });
    }

    return { success: true, data: jobs };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: { type: "network", message } };
  }
}
