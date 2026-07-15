/**
 * Interview Prep User Prompt
 * Wraps the CV, the job description and the (possibly absent) company context.
 * The companyContext placeholder is ALWAYS rendered — callers pass the sentinel
 * "NONE" when no company context is available, so the raw placeholder never
 * leaks to the model and the system prompt's Class-2 rule can fire.
 */

import { interpolate } from "../interpolate";

export const INTERVIEW_PREP_USER_TEMPLATE = `Prepare interview questions for this candidate and role.

## CANDIDATE CV

{{resumeText}}

## JOB DESCRIPTION

{{jobDescription}}

## COMPANY CONTEXT

{{companyContext}}

## OUTPUT

Return the grouped questions. Populate every Class 1 category you can from the CV and job description. Populate cultureValues and currentSituation ONLY if the COMPANY CONTEXT above is real information (not "NONE" or empty); otherwise return them as empty arrays.`;

export function buildInterviewPrepPrompt(
  resumeText: string,
  jobDescription: string,
  companyContext: string,
): string {
  return interpolate(INTERVIEW_PREP_USER_TEMPLATE, {
    resumeText,
    jobDescription,
    companyContext,
  });
}
