/**
 * Job Match User Prompts
 * Functions to construct user prompts for job match analysis.
 */

import { interpolate } from "../interpolate";

export const JOB_MATCH_USER_TEMPLATE = `Compare this resume against the job description.

RESUME:
{{resumeText}}

JOB DESCRIPTION:
{{jobDescription}}

Output the scores line first, then the markdown analysis with the required sections. Be specific and reference actual content from both documents.`;

/**
 * Build user prompt for comprehensive job match analysis
 */
export function buildJobMatchPrompt(
  resumeText: string,
  jobDescription: string,
): string {
  return interpolate(JOB_MATCH_USER_TEMPLATE, { resumeText, jobDescription });
}
