import { z } from "zod";

// RESUME REVIEW SCORES SCHEMA
// The review body is free-form markdown; only the four scores are structured
// (they drive the radial chart and score grid).

export const ResumeScoresSchema = z.object({
  overall: z.number().min(0).max(100),
  impact: z.number().min(0).max(100),
  clarity: z.number().min(0).max(100),
  atsCompatibility: z.number().min(0).max(100),
});

export type ResumeScores = z.infer<typeof ResumeScoresSchema>;

// Persisted shape stored in Resume.reviewData (JSON string).
export type ResumeReviewData = ResumeScores & {
  body: string;
  reviewedAt?: string;
  provider?: string;
  model?: string;
};

// JOB MATCH TYPES
// The match analysis is free-form markdown; only the score + recommendation are
// machine-readable (they drive the radial chart, jobs-table sorting, and the
// automation match threshold). Parsed from the leading `SCORES:` line.

export type JobMatchRecommendation =
  | "strong match"
  | "good match"
  | "partial match"
  | "weak match";

export type JobMatchScores = {
  matchScore: number;
  recommendation: JobMatchRecommendation;
};

// Parsed stream result (scores + markdown body).
export type JobMatchResult = {
  scores?: JobMatchScores;
  body: string;
};

// Lexical pre-rank breakdown persisted next to the LLM verdict (tuning signal).
export type PrerankComponents = {
  titleScore: number;
  keywordScore: number;
  locScore: number;
  titleHits: string[]; // target-title tokens that matched
  keywordHits: string[]; // distinct keyword/skill terms that matched
};

// Persisted shape stored in Job.matchData (JSON string).
export type JobMatchData = JobMatchScores & {
  body: string;
  resumeId?: string;
  resumeTitle?: string;
  matchedAt?: string;
  provider?: string;
  model?: string;
  // Greenhouse-specific
  prerankScore?: number; // raw lexical score (internal sort only; NOT shown as %)
  analyzed?: boolean; // true once LLM match has run (auto top-K or on-demand)
  prerankComponents?: PrerankComponents;
};

// CV IMPORT SCHEMA
// Extracts contact info, summary, work experience, and education from a raw CV/resume text dump

const CvWorkExperienceSchema = z.object({
  jobTitle: z.string().describe("Job title exactly as written on the CV"),
  company: z.string().describe("Company/employer name exactly as written on the CV"),
  location: z.string().nullable().describe("City/location for this role, null if not mentioned"),
  startDate: z
    .string()
    .nullable()
    .describe("Start date in YYYY-MM format (e.g. '2021-03'), null if it cannot be determined"),
  endDate: z
    .string()
    .nullable()
    .describe("End date in YYYY-MM format, null if this is the current/ongoing role"),
  isCurrent: z.boolean().describe("True if the CV explicitly marks this as the current/ongoing role"),
  description: z
    .string()
    .describe("Concise description of responsibilities/achievements for this role, based only on the CV text"),
});

const CvEducationSchema = z.object({
  institution: z.string().describe("School/university name exactly as written on the CV"),
  degree: z.string().describe("Degree name, e.g. 'Bachelor of Science'"),
  fieldOfStudy: z.string().describe("Field of study / major"),
  location: z.string().nullable().describe("City/location of the institution, null if not mentioned"),
  startDate: z
    .string()
    .nullable()
    .describe("Start date in YYYY-MM format, null if it cannot be determined"),
  endDate: z
    .string()
    .nullable()
    .describe("End date in YYYY-MM format, null if ongoing or not mentioned"),
  isCompleted: z.boolean().describe("True if the CV explicitly indicates the degree was completed"),
  description: z.string().nullable().describe("Short additional description, null if none is given"),
});

export const CvImportSchema = z.object({
  firstName: z.string().nullable().describe("Candidate's first name, null if not found"),
  lastName: z.string().nullable().describe("Candidate's last name, null if not found"),
  headline: z
    .string()
    .nullable()
    .describe("Professional headline/title (e.g. 'Senior Frontend Developer'), null if not found"),
  email: z.string().nullable().describe("Contact email address, null if not found"),
  phone: z.string().nullable().describe("Contact phone number, null if not found"),
  address: z.string().nullable().describe("Postal address or city/country, null if not found"),
  summary: z
    .string()
    .nullable()
    .describe(
      "Professional summary/profile text, 2-5 sentences. Use the existing summary if the CV has one; otherwise write a concise one from the candidate's experience. Keep the original language of the CV. Null only if there is truly no basis to write one.",
    ),
  workExperiences: z
    .array(CvWorkExperienceSchema)
    .describe("Every work experience entry found in the CV, in the order listed there. Empty array if none."),
  educations: z
    .array(CvEducationSchema)
    .describe("Every education entry found in the CV, in the order listed there. Empty array if none."),
});

export type CvImportResponse = z.infer<typeof CvImportSchema>;
export type CvWorkExperienceImport = z.infer<typeof CvWorkExperienceSchema>;
export type CvEducationImport = z.infer<typeof CvEducationSchema>;

// JOB IMPORT SCHEMA
// Single LLM call to extract job posting fields from raw PDF text

export const JobImportSchema = z.object({
  jobTitle: z.string().nullable().describe("The advertised job title, null if not found"),
  company: z.string().nullable().describe("Hiring company name, null if not found"),
  location: z
    .string()
    .nullable()
    .describe("Job location as city plus country/state if given (e.g. 'Berlin, Germany'), null if not found"),
  jobType: z
    .enum(["FT", "PT", "C"])
    .nullable()
    .describe("Employment type: FT = full-time, PT = part-time, C = contract. Null if not stated"),
  salaryMin: z
    .number()
    .nullable()
    .describe("Lower bound of the advertised yearly salary as a plain number, null if not stated"),
  salaryMax: z
    .number()
    .nullable()
    .describe("Upper bound of the advertised yearly salary as a plain number, null if not stated"),
  jobUrl: z
    .string()
    .nullable()
    .describe("URL of the job posting if one appears in the text, null otherwise"),
  description: z
    .string()
    .nullable()
    .describe("The full job description text (responsibilities, requirements, benefits), lightly cleaned, in the posting's language"),
});

export type JobImportResponse = z.infer<typeof JobImportSchema>;

// EMAIL ALERT SCHEMA
// A single job-alert email (StepStone, LinkedIn, Bundesagentur, …) typically
// lists several jobs. One LLM call extracts them all as an array.

const EmailAlertJobSchema = z.object({
  title: z.string().describe("The job title exactly as written in the email"),
  company: z
    .string()
    .nullable()
    .describe("Hiring company name, null if the email does not name one"),
  location: z
    .string()
    .nullable()
    .describe("Job location (city plus country/state if given), null if not shown"),
  description: z
    .string()
    .nullable()
    .describe(
      "The job snippet/teaser text shown for this listing in the email, lightly cleaned. Null if the email shows only a title.",
    ),
  url: z
    .string()
    .nullable()
    .describe("The link to this specific job posting, null if none is present"),
});

export const EmailAlertSchema = z.object({
  jobs: z
    .array(EmailAlertJobSchema)
    .describe(
      "Every distinct job listing found in the alert email, in the order shown. Do not invent jobs, do not include unrelated links (unsubscribe, account, search-more). Empty array if the email contains no job listings.",
    ),
});

export type EmailAlertResponse = z.infer<typeof EmailAlertSchema>;
export type EmailAlertJob = z.infer<typeof EmailAlertJobSchema>;
