import "server-only";

import { generateObject, type LanguageModel } from "ai";

import db from "@/lib/db";
import { resolvePromptPair } from "@/lib/ai/prompts/resolve";
import { CompanyResearchSchema, type CompanyResearch } from "@/models/ai.schemas";
import { TEMPERATURES } from "@/lib/ai/config";
import {
  RESEARCH_CACHE_TTL_MS,
  MIN_RESEARCH_CHARS,
  MAX_RESEARCH_CHARS,
} from "./config";
import { tavilySearch } from "./search";
import { FetchPageSource, type PageSource } from "./page-source";

/** Minimal company shape the research needs. */
export interface ResearchCompany {
  id: string;
  label: string;
}

export interface CompanyContextResult {
  context: CompanyResearch | null;
  sources: string[];
}

function isFresh(at: Date | null | undefined): boolean {
  return !!at && Date.now() - at.getTime() < RESEARCH_CACHE_TTL_MS;
}

/**
 * Company context for Class-2 enrichment. Reads the CompanyResearch cache first
 * and only researches when the cache is missing or stale. Returns
 * { context: null } whenever there is no usable data (no key, no sources, thin
 * pages, LLM failure) so the caller omits Class 2 rather than hallucinating.
 *
 * NEVER throws — every failure path resolves to { context: null, sources: [] }.
 */
export async function getCompanyContext(
  userId: string,
  company: ResearchCompany,
  model: LanguageModel,
  pageSource: PageSource = new FetchPageSource(),
): Promise<CompanyContextResult> {
  try {
    const cached = await db.companyResearch.findUnique({
      where: { companyId: company.id },
    });

    if (cached?.context && isFresh(cached.contextAt)) {
      return {
        context: JSON.parse(cached.context) as CompanyResearch,
        sources: cached.contextSources
          ? (JSON.parse(cached.contextSources) as string[])
          : [],
      };
    }

    const hits = await tavilySearch(
      userId,
      `${company.label} company mission values culture`,
      { maxResults: 4 },
    );
    if (hits.length === 0) return { context: null, sources: [] };

    // Fetch the top hits; fall back to their search snippets when a page is walled.
    const sources: string[] = [];
    const chunks: string[] = [];
    for (const hit of hits.slice(0, 3)) {
      const text = (await pageSource.fetch(hit.url)) ?? hit.snippet;
      if (text && text.trim().length > 0) {
        chunks.push(`SOURCE: ${hit.url}\n${text}`);
        sources.push(hit.url);
      }
    }

    const pageText = chunks.join("\n\n").slice(0, MAX_RESEARCH_CHARS);
    if (pageText.length < MIN_RESEARCH_CHARS) {
      return { context: null, sources: [] };
    }

    const { system, prompt } = await resolvePromptPair(
      "company-research",
      userId,
      { companyName: company.label, pageText },
    );

    const { object } = await generateObject({
      model,
      schema: CompanyResearchSchema,
      system,
      prompt,
      temperature: TEMPERATURES.ANALYSIS,
    });

    await db.companyResearch.upsert({
      where: { companyId: company.id },
      update: {
        context: JSON.stringify(object),
        contextAt: new Date(),
        contextSources: JSON.stringify(sources),
      },
      create: {
        companyId: company.id,
        userId,
        context: JSON.stringify(object),
        contextAt: new Date(),
        contextSources: JSON.stringify(sources),
      },
    });

    return { context: object, sources };
  } catch (error) {
    console.warn("[research] company context failed", error);
    return { context: null, sources: [] };
  }
}
