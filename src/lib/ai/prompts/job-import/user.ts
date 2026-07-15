/**
 * Job Import User Prompt
 * Constructs the user prompt for job posting field extraction
 */

import { interpolate } from "../interpolate";

export const JOB_IMPORT_USER_TEMPLATE = `Extract the job posting fields from this text.

## JOB POSTING TEXT:

{{jobText}}

## OUTPUT

Return jobTitle, company, location, jobType, salaryMin, salaryMax, jobUrl, and description as structured fields.
Use null for anything not present in the text above.`;

export function buildJobImportPrompt(jobText: string): string {
  return interpolate(JOB_IMPORT_USER_TEMPLATE, { jobText });
}
