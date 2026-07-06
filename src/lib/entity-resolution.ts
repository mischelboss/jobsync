/**
 * Entity resolution for job PDF import.
 * Uses the same fuzzy-matching algorithm (findBestMatches) as the CV import's
 * work experience/education resolution, so a company/title/location extracted
 * from a PDF resolves to an existing record whenever one is a close match.
 */

import db from "@/lib/db";
import { normalizeForSearch } from "@/lib/scraper/utils";
import { findBestMatches } from "@/lib/matching/similarity";

const AUTO_SELECT_THRESHOLD = 0.75;

export interface ResolvedEntity {
  id: string;
  label: string;
  value: string;
}

export async function resolveJobTitle(
  title: string,
  userId: string,
): Promise<ResolvedEntity> {
  const existingTitles = await db.jobTitle.findMany({
    where: { createdBy: userId },
  });

  const [best] = findBestMatches(title, existingTitles, (t) => t.label, {
    threshold: AUTO_SELECT_THRESHOLD,
    limit: 1,
  });
  if (best) return best.item;

  return db.jobTitle.create({
    data: {
      label: title,
      value: normalizeForSearch(title),
      createdBy: userId,
    },
  });
}

export async function resolveLocation(
  location: string,
  userId: string,
): Promise<ResolvedEntity | null> {
  if (!location) return null;

  const existingLocations = await db.location.findMany({
    where: { createdBy: userId },
  });

  const [best] = findBestMatches(location, existingLocations, (l) => l.label, {
    threshold: AUTO_SELECT_THRESHOLD,
    limit: 1,
  });
  if (best) return best.item;

  return db.location.create({
    data: {
      label: location,
      value: normalizeForSearch(location),
      createdBy: userId,
    },
  });
}

export async function resolveCompany(
  company: string,
  userId: string,
): Promise<ResolvedEntity> {
  const existingCompanies = await db.company.findMany({
    where: { createdBy: userId },
  });

  const [best] = findBestMatches(company, existingCompanies, (c) => c.label, {
    threshold: AUTO_SELECT_THRESHOLD,
    limit: 1,
  });
  if (best) return best.item;

  return db.company.create({
    data: {
      label: company,
      value: normalizeForSearch(company),
      createdBy: userId,
    },
  });
}
