import { interpolate } from "../interpolate";

export const RESUME_IMPORT_USER_TEMPLATE = `Parse the following resume and extract structured data.

<resume>
{{normalizedText}}
</resume>

Return only the structured resume data described in your instructions.`;

export function buildResumeImportPrompt(normalizedText: string): string {
  return interpolate(RESUME_IMPORT_USER_TEMPLATE, { normalizedText });
}
