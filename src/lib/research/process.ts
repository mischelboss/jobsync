import "server-only";

import { generateObject, type LanguageModel } from "ai";

import db from "@/lib/db";
import { resolvePromptPair } from "@/lib/ai/prompts/resolve";
import { ProcessResearchSchema, type ProcessResearch } from "@/models/ai.schemas";
import { TEMPERATURES } from "@/lib/ai/config";
import {
  RESEARCH_CACHE_TTL_MS,
  MIN_RESEARCH_CHARS,
  MAX_RESEARCH_CHARS,
} from "./config";
import { tavilySearch } from "./search";
import { FetchPageSource, type PageSource } from "./page-source";
import type { ResearchCompany } from "./company";

function isFresh(at: Date | null | undefined): boolean {
  return !!at && Date.now() - at.getTime() < RESEARCH_CACHE_TTL_MS;
}

/**
 * Class-3 interview-process research (best-effort). Reads the CompanyResearch
 * process cache first, then searches + scrapes anecdotal sources (allowing
 * walled hosts, degrading to snippets). Returns null whenever there is no
 * usable data — NEVER throws — so the caller simply omits Class 3.
 */
export async function getInterviewProcess(
  userId: string,
  company: ResearchCompany,
  model: LanguageModel,
  pageSource: PageSource = new FetchPageSource(),
): Promise<ProcessResearch | null> {
  try {
    const cached = await db.companyResearch.findUnique({
      where: { companyId: company.id },
    });

    if (cached?.process && isFresh(cached.processAt)) {
      return JSON.parse(cached.process) as ProcessResearch;
    }

    const hits = await tavilySearch(
      userId,
      `${company.label} interview process rounds candidate experience`,
      { maxResults: 5 },
    );
    if (hits.length === 0) return null;

    const chunks: string[] = [];
    for (const hit of hits.slice(0, 4)) {
      const text = (await pageSource.fetch(hit.url)) ?? hit.snippet;
      if (text && text.trim().length > 0) {
        chunks.push(`SOURCE: ${hit.url}\n${text}`);
      }
    }

    const pageText = chunks.join("\n\n").slice(0, MAX_RESEARCH_CHARS);
    if (pageText.length < MIN_RESEARCH_CHARS) return null;

    const { system, prompt } = await resolvePromptPair(
      "interview-process",
      userId,
      { companyName: company.label, pageText },
    );

    const { object } = await generateObject({
      model,
      schema: ProcessResearchSchema,
      system,
      prompt,
      temperature: TEMPERATURES.ANALYSIS,
    });

    // Persist onto the shared CompanyResearch row. Create if the company has no
    // row yet (e.g. process researched before any company context).
    await db.companyResearch.upsert({
      where: { companyId: company.id },
      update: { process: JSON.stringify(object), processAt: new Date() },
      create: {
        companyId: company.id,
        userId,
        process: JSON.stringify(object),
        processAt: new Date(),
      },
    });

    return object;
  } catch (error) {
    console.warn("[research] interview process failed", error);
    return null;
  }
}
