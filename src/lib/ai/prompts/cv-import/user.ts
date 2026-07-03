/**
 * CV Import User Prompt
 * Constructs the user prompt for contact info + summary extraction
 */

export function buildCvImportPrompt(cvText: string): string {
  return `Extract the candidate's contact information and a professional summary from this CV text.

## CV TEXT:

${cvText}

## OUTPUT

Return firstName, lastName, headline, email, phone, address, and summary as structured fields.
Use null for anything not present in the text above.`;
}
