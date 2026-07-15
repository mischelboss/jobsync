/**
 * Automation Job Match User Prompts
 * Functions to construct user prompts for lean automation job match analysis.
 */

import { interpolate } from "../interpolate";

export const AUTOMATION_JOB_MATCH_USER_TEMPLATE = `Compare this resume against the job description.

RESUME:
{{resumeText}}

JOB DESCRIPTION:
{{jobDescription}}

Output the scores line first, then a 2-3 sentence Summary. Be specific and reference actual content from both documents.`;

/**
 * Build user prompt for lean automation job match analysis
 */
export function buildAutomationJobMatchPrompt(
  resumeText: string,
  jobDescription: string,
): string {
  return interpolate(AUTOMATION_JOB_MATCH_USER_TEMPLATE, {
    resumeText,
    jobDescription,
  });
}
