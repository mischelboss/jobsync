/**
 * Job Import User Prompt
 * Constructs the user prompt for job posting field extraction
 */

export function buildJobImportPrompt(jobText: string): string {
  return `Extract the job posting fields from this text.

## JOB POSTING TEXT:

${jobText}

## OUTPUT

Return jobTitle, company, location, jobType, salaryMin, salaryMax, jobUrl, and description as structured fields.
Use null for anything not present in the text above.`;
}
