/**
 * Prompt Registry
 *
 * The single list of prompts a user may customize in Settings → Prompt Library.
 * Default text is imported from the feature modules rather than duplicated here,
 * so the prompt keeps one source of truth.
 *
 * Keep this module free of `db` and `server-only` imports: the client-side
 * settings UI imports it directly (never through `@/lib/ai`, which is server-only).
 */

import { extractPlaceholders } from "./interpolate";

import { RESUME_REVIEW_SYSTEM_PROMPT } from "./resume-review/system";
import { RESUME_REVIEW_USER_TEMPLATE } from "./resume-review/user";
import { JOB_MATCH_SYSTEM_PROMPT } from "./job-match/system";
import { JOB_MATCH_USER_TEMPLATE } from "./job-match/user";
import { AUTOMATION_JOB_MATCH_SYSTEM_PROMPT } from "./automation-match/system";
import { AUTOMATION_JOB_MATCH_USER_TEMPLATE } from "./automation-match/user";
import { RESUME_IMPORT_SYSTEM_PROMPT } from "./resume-import/system";
import { RESUME_IMPORT_USER_TEMPLATE } from "./resume-import/user";
import { CV_IMPORT_SYSTEM_PROMPT } from "./cv-import/system";
import { CV_IMPORT_USER_TEMPLATE } from "./cv-import/user";
import { JOB_IMPORT_SYSTEM_PROMPT } from "./job-import/system";
import { JOB_IMPORT_USER_TEMPLATE } from "./job-import/user";
import { EMAIL_ALERT_SYSTEM_PROMPT } from "./email-alert/system";
import { EMAIL_ALERT_USER_TEMPLATE } from "./email-alert/user";

export type PromptType = "system" | "template";

export type PromptFeature =
  | "resume-review"
  | "job-match"
  | "automation-match"
  | "resume-import"
  | "cv-import"
  | "job-import"
  | "email-alert";

export interface PromptEntry {
  /** Stable identifier persisted in PromptOverride.promptId. Never rename. */
  id: string;
  feature: PromptFeature;
  label: string;
  description: string;
  type: PromptType;
  defaultText: string;
  /** Placeholders an override must keep, or the prompt loses its context. */
  requiredPlaceholders: string[];
  /** This prompt drives Zod-validated JSON extraction; a bad override breaks parsing. */
  structuredOutput: boolean;
}

export interface PromptFeatureMeta {
  feature: PromptFeature;
  label: string;
  description: string;
  structuredOutput: boolean;
  systemId: string;
  userId: string;
}

interface FeatureSpec {
  feature: PromptFeature;
  label: string;
  description: string;
  structuredOutput: boolean;
  systemText: string;
  userTemplate: string;
  systemDescription: string;
  userDescription: string;
}

const FEATURE_SPECS: FeatureSpec[] = [
  {
    feature: "resume-review",
    label: "Resume Review",
    description:
      "Scores a resume and returns a markdown review with improvement suggestions.",
    structuredOutput: false,
    systemText: RESUME_REVIEW_SYSTEM_PROMPT,
    userTemplate: RESUME_REVIEW_USER_TEMPLATE,
    systemDescription:
      "Defines the reviewer's role, scoring bands and required output sections.",
    userDescription: "Wraps the resume text that gets reviewed.",
  },
  {
    feature: "job-match",
    label: "Job Match",
    description:
      "Compares a resume against a job description on demand and returns a full markdown analysis.",
    structuredOutput: false,
    systemText: JOB_MATCH_SYSTEM_PROMPT,
    userTemplate: JOB_MATCH_USER_TEMPLATE,
    systemDescription:
      "Defines the recruiter's role, scoring bands and the required SCORES line plus markdown sections.",
    userDescription: "Wraps the resume and the job description being compared.",
  },
  {
    feature: "automation-match",
    label: "Automation Job Match",
    description:
      "The lean match used while an automation scans many discovered jobs. Returns a score and a short summary.",
    structuredOutput: false,
    systemText: AUTOMATION_JOB_MATCH_SYSTEM_PROMPT,
    userTemplate: AUTOMATION_JOB_MATCH_USER_TEMPLATE,
    systemDescription:
      "Defines the scoring bands and the required SCORES line plus a single Summary section.",
    userDescription: "Wraps the resume and the job description being compared.",
  },
  {
    feature: "resume-import",
    label: "Resume Import",
    description:
      "Parses an uploaded resume into structured sections (experience, education, skills).",
    structuredOutput: true,
    systemText: RESUME_IMPORT_SYSTEM_PROMPT,
    userTemplate: RESUME_IMPORT_USER_TEMPLATE,
    systemDescription:
      "Defines the extraction rules, worked examples and injection-handling policy.",
    userDescription: "Wraps the resume text being parsed.",
  },
  {
    feature: "cv-import",
    label: "CV Import",
    description:
      "Extracts contact details, summary, work experience and education from a CV.",
    structuredOutput: true,
    systemText: CV_IMPORT_SYSTEM_PROMPT,
    userTemplate: CV_IMPORT_USER_TEMPLATE,
    systemDescription: "Defines the extraction rules for profile fields.",
    userDescription: "Wraps the CV text and names the fields to return.",
  },
  {
    feature: "job-import",
    label: "Job Import",
    description:
      "Extracts job posting fields (title, company, salary, …) from pasted text.",
    structuredOutput: true,
    systemText: JOB_IMPORT_SYSTEM_PROMPT,
    userTemplate: JOB_IMPORT_USER_TEMPLATE,
    systemDescription: "Defines the extraction rules for job posting fields.",
    userDescription: "Wraps the posting text and names the fields to return.",
  },
  {
    feature: "email-alert",
    label: "Email Alert Extraction",
    description:
      "Pulls every job listing out of a job-alert email into an array.",
    structuredOutput: true,
    systemText: EMAIL_ALERT_SYSTEM_PROMPT,
    userTemplate: EMAIL_ALERT_USER_TEMPLATE,
    systemDescription:
      "Defines how to recognize individual listings inside a newsletter.",
    userDescription: "Wraps the email body being scanned.",
  },
];

export const systemPromptId = (feature: PromptFeature) => `${feature}.system`;
export const userPromptId = (feature: PromptFeature) => `${feature}.user`;

export const PROMPT_REGISTRY: PromptEntry[] = FEATURE_SPECS.flatMap((spec) => [
  {
    id: systemPromptId(spec.feature),
    feature: spec.feature,
    label: "System prompt",
    description: spec.systemDescription,
    type: "system" as const,
    defaultText: spec.systemText,
    requiredPlaceholders: [],
    structuredOutput: spec.structuredOutput,
  },
  {
    id: userPromptId(spec.feature),
    feature: spec.feature,
    label: "User prompt",
    description: spec.userDescription,
    type: "template" as const,
    defaultText: spec.userTemplate,
    // Derived from the default so the two can never drift apart.
    requiredPlaceholders: extractPlaceholders(spec.userTemplate),
    structuredOutput: spec.structuredOutput,
  },
]);

export const PROMPT_REGISTRY_BY_ID: Record<string, PromptEntry> =
  Object.fromEntries(PROMPT_REGISTRY.map((entry) => [entry.id, entry]));

export const PROMPT_FEATURES: PromptFeatureMeta[] = FEATURE_SPECS.map(
  (spec) => ({
    feature: spec.feature,
    label: spec.label,
    description: spec.description,
    structuredOutput: spec.structuredOutput,
    systemId: systemPromptId(spec.feature),
    userId: userPromptId(spec.feature),
  }),
);

/**
 * Why an override text is not storable, or null if it is. Shared by the settings
 * form (to disable Save) and by upsertPromptOverride (which is authoritative).
 */
export function validateOverrideText(
  entry: PromptEntry,
  overrideText: string,
): string | null {
  const present = extractPlaceholders(overrideText);
  const allowed = new Set(entry.requiredPlaceholders);

  const missing = entry.requiredPlaceholders.filter(
    (p) => !present.includes(p),
  );
  if (missing.length > 0) {
    return `Missing required placeholder${missing.length > 1 ? "s" : ""}: ${missing
      .map((p) => `{{${p}}}`)
      .join(", ")}`;
  }

  // An unknown placeholder is almost always a typo, and would otherwise be sent
  // to the model verbatim as "{{resumetext}}".
  const unknown = present.filter((p) => !allowed.has(p));
  if (unknown.length > 0) {
    return `Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${unknown
      .map((p) => `{{${p}}}`)
      .join(", ")}`;
  }

  return null;
}
