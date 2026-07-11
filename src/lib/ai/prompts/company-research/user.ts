/**
 * Company Research User Prompt
 * Wraps the company name and the fetched page text to extract from.
 */

import { interpolate } from "../interpolate";

export const COMPANY_RESEARCH_USER_TEMPLATE = `Extract company information for "{{companyName}}" from the text below.

## SOURCE TEXT

{{pageText}}

## OUTPUT

Return mission, values, culture and currentSituation. Use null (or an empty values array) for anything the source text does not explicitly state.`;

export function buildCompanyResearchPrompt(
  companyName: string,
  pageText: string,
): string {
  return interpolate(COMPANY_RESEARCH_USER_TEMPLATE, { companyName, pageText });
}
