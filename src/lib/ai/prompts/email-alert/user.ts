/**
 * Email Alert User Prompt
 * Wraps the alert email's text content for job extraction.
 */

import { interpolate } from "../interpolate";

export const EMAIL_ALERT_USER_TEMPLATE = `Extract all job listings from this job-alert email.

## EMAIL CONTENT:

{{emailText}}

## OUTPUT

Return a "jobs" array with one object per job listing (title, company, location,
description, url). Use null for any field not present for a listing, and return an
empty array if there are no job listings.`;

export function buildEmailAlertPrompt(emailText: string): string {
  return interpolate(EMAIL_ALERT_USER_TEMPLATE, { emailText });
}
