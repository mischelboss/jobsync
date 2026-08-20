import { APP_CONSTANTS } from "@/lib/constants";
import { checkMcpRateLimit } from "@/lib/mcp/rate-limit";
import { getDefaultResumeForUser } from "@/lib/jobs/getDefaultResumeForUser";
import { preprocessResume } from "@/lib/ai/tools/preprocessing";
import { resolvePromptPair } from "@/lib/ai/prompts/resolve";

// Do not restate the SCORES line format, the "##" section list or the
// serialization disclaimer here — the shared system prompt and user-prompt
// builder specify all three. Restating any of them creates a second source
// that can drift.
//
// Resolved through the Prompt Library rather than imported directly, so a user
// who edits the resume-review prompt in Settings gets the same reviewer here as
// in the agent chat.
async function buildReviewDirective(
  userId: string,
  resumeId: string,
  normalizedResumeText: string,
): Promise<string> {
  const { system, prompt } = await resolvePromptPair(
    "resume-review",
    userId,
    { resumeText: normalizedResumeText },
  );

  return (
    `Act as the reviewer described below and produce a review of the ` +
    `resume shown here.\n\n` +
    `${system}\n\n` +
    `${prompt}\n\n` +
    `Then call save_resume_review with the full SCORES line + markdown body ` +
    `you just produced as the "reviewText" argument (not as a chat message):\n` +
    `    { "resumeId": "${resumeId}", "reviewText": "<the full SCORES line + markdown body>" }`
  );
}

export async function handleReviewResume(
  userId: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  const rateCheck = checkMcpRateLimit(userId);
  if (!rateCheck.allowed) {
    const resetSec = Math.ceil(rateCheck.resetIn / 1000);
    return {
      content: [
        { type: "text", text: `Rate limit exceeded. Try again in ${resetSec}s.` },
      ],
    };
  }

  const resume = await getDefaultResumeForUser(userId);
  if (!resume) {
    return {
      content: [
        {
          type: "text",
          text: "No default resume set — set one in Profile → Resumes.",
        },
      ],
    };
  }

  const pre = await preprocessResume(resume);
  if (!pre.success) {
    return {
      content: [
        {
          type: "text",
          text: "Default resume couldn't be used for review (it may be too short or missing content) — check it in Profile → Resumes.",
        },
      ],
    };
  }

  if (
    pre.data.normalizedText.length < APP_CONSTANTS.MCP_REVIEW_MIN_RESUME_LENGTH
  ) {
    return {
      content: [{ type: "text", text: "Resume too short to review." }],
    };
  }

  const directive = await buildReviewDirective(
    userId,
    resume.id!,
    pre.data.normalizedText,
  );
  return { content: [{ type: "text", text: directive }] };
}
