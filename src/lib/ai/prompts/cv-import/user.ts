/**
 * CV Import User Prompt
 * Constructs the user prompt for contact info + summary + experience + education extraction
 */

import { interpolate } from "../interpolate";

export const CV_IMPORT_USER_TEMPLATE = `Extract the candidate's contact information, professional summary, work experience, and education from this CV text.

## CV TEXT:

{{cvText}}

## OUTPUT

Return firstName, lastName, headline, email, phone, address, and summary as structured fields.
Use null for anything not present in the text above.

Return workExperiences and educations as arrays covering every entry found in the CV
(empty arrays if none are present). Use exact names as written for jobTitle/company/institution/location
so they can be matched against the candidate's existing records later.`;

export function buildCvImportPrompt(cvText: string): string {
  return interpolate(CV_IMPORT_USER_TEMPLATE, { cvText });
}
