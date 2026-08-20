/**
 * Cover Letter User Prompts
 * Wraps the resume, the job description and the (possibly absent) prior match
 * analysis. The matchGuidance placeholder is ALWAYS rendered — callers pass the
 * sentinel "NONE" when the job has no saved match — so the raw placeholder never
 * leaks to the model and the ignore rule below has something to fire on. This
 * mirrors INTERVIEW_PREP_USER_TEMPLATE's handling of an optional section.
 */

import { interpolate } from "../interpolate";

/** Passed as matchGuidance when the job has no saved match analysis. */
export const NO_MATCH_GUIDANCE = "NONE";

export const COVER_LETTER_USER_TEMPLATE = `Write a cover letter for this candidate applying to this job.

RESUME:
{{resumeText}}

JOB DESCRIPTION:
{{jobDescription}}

PRIOR MATCH ANALYSIS (emphasise these keywords and act on these tips; ignore this section entirely if it reads "NONE"):
{{matchGuidance}}

Output only the letter, starting with the salutation.`;

export function buildCoverLetterPrompt(
  resumeText: string,
  jobText: string,
  guidance: string | null,
): string {
  return interpolate(COVER_LETTER_USER_TEMPLATE, {
    resumeText,
    jobDescription: jobText,
    matchGuidance: guidance ?? NO_MATCH_GUIDANCE,
  });
}
