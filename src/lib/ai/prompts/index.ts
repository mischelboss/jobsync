/**
 * AI Prompts - Main Barrel File
 *
 * Re-exports from feature-specific modules for backward compatibility.
 * For new code, import directly from the specific module:
 *   - ./resume-review for resume analysis prompts
 *   - ./job-match for job matching prompts
 */

// Resume Review exports
export {
  RESUME_REVIEW_SYSTEM_PROMPT,
  buildResumeReviewPrompt,
} from "./resume-review";

// Job Match exports
export {
  JOB_MATCH_SYSTEM_PROMPT,
  buildJobMatchPrompt,
} from "./job-match";

// Automation Job Match exports (lean variant for automation loops)
export {
  AUTOMATION_JOB_MATCH_SYSTEM_PROMPT,
  buildAutomationJobMatchPrompt,
} from "./automation-match";

// Resume Import exports
export {
  RESUME_IMPORT_SYSTEM_PROMPT,
  buildResumeImportPrompt,
} from "./resume-import";

// CV Import exports
export {
  CV_IMPORT_SYSTEM_PROMPT,
  buildCvImportPrompt,
} from "./cv-import";

// Job Import exports
export {
  JOB_IMPORT_SYSTEM_PROMPT,
  buildJobImportPrompt,
} from "./job-import";

// Email Alert exports (array extraction of multiple jobs per email)
export {
  EMAIL_ALERT_SYSTEM_PROMPT,
  buildEmailAlertPrompt,
} from "./email-alert";
