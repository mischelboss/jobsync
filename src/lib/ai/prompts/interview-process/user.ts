/**
 * Interview Process User Prompt
 * Wraps the company name and the fetched source text describing the process.
 */

import { interpolate } from "../interpolate";

export const INTERVIEW_PROCESS_USER_TEMPLATE = `Reconstruct the interview process for "{{companyName}}" from the sources below.

## SOURCE TEXT

{{pageText}}

## OUTPUT

Return roundsCount, rounds (each with name, character, confidence and source) and overallConfidence. Prefer "estimated" whenever a claim is not explicitly stated by a source. Return an empty rounds array if the sources reveal nothing concrete about the process.`;

export function buildInterviewProcessPrompt(
  companyName: string,
  pageText: string,
): string {
  return interpolate(INTERVIEW_PROCESS_USER_TEMPLATE, {
    companyName,
    pageText,
  });
}
