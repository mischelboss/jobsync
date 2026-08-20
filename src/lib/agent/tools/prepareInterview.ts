import "server-only";

import { tool, type LanguageModel } from "ai";
import db from "@/lib/db";
import { AGENT_TOOL_DESCRIPTIONS } from "@/lib/agent/prompt";
import { AgentPrepareInterviewSchema } from "@/models/agent.schema";
import { resolveJobForAgent } from "@/lib/agent/jobLookup";
import { resolveResumeForAgent } from "@/lib/agent/resumeLookup";
import { preprocessResume } from "@/lib/ai/tools/preprocessing";
import { preprocessJob } from "@/lib/ai/tools/preprocessing-job";
import { generateInterviewPrepCore } from "@/lib/interviewPrep/generate";
import { defaultUserSettings } from "@/models/userSettings.model";
import type { NestedGenerationGuard } from "@/lib/agent/nestedGeneration";
import type { AgentPrepareInterviewResult } from "@/models/agent.model";

type PrepareInterviewContext = {
  userId: string;
  pageJobId?: string;
  model: LanguageModel;
  provider: string;
  modelName: string;
  guard: NestedGenerationGuard;
};

/**
 * The fourth generation surface wearing a tool's clothes, after review_resume,
 * match_job and generate_cover_letter. Unlike those three it produces a
 * schema-shaped object rather than markdown, so it takes the object path
 * through runNestedObjectGeneration and writes nothing to the transcript —
 * the result card renders the grouped questions instead.
 *
 * userId and pageJobId are closure parameters — the same IDOR boundary as the
 * other tools.
 */
export function buildPrepareInterviewTool(ctx: PrepareInterviewContext) {
  return tool({
    description: AGENT_TOOL_DESCRIPTIONS.prepare_interview,
    inputSchema: AgentPrepareInterviewSchema,
    // No needsApproval: this writes only an InterviewPrep row against the
    // caller's own job, replacing any previous one for that job.
    execute: async (raw, { abortSignal }): Promise<AgentPrepareInterviewResult> => {
      const jobLookup = await resolveJobForAgent(ctx.userId, ctx.pageJobId);
      if (jobLookup.status === "no_job") return { status: "no_job" };

      const job = jobLookup.job;
      const jobTitle = job.JobTitle?.label ?? "this job";
      const company = job.Company;
      if (!company?.id) {
        return {
          status: "unreadable",
          what: "job",
          title: jobTitle,
          reason: "It has no company set, and the company is what the research runs on.",
        };
      }

      // The job's linked resume takes the pageResumeId slot, exactly as in
      // match_job: a job page carries no pageContext.resumeId.
      const resumeLookup = await resolveResumeForAgent(ctx.userId, {
        title: raw?.resumeTitle,
        pageResumeId: job.resumeId ?? undefined,
      });
      if (resumeLookup.status === "no_resumes") return { status: "no_resumes" };
      if (resumeLookup.status === "needs_selection") {
        return { status: "needs_selection", resumes: resumeLookup.resumes };
      }

      const resume = resumeLookup.resume;
      const [resumePre, jobPre] = await Promise.all([
        preprocessResume(resume),
        preprocessJob(job),
      ]);
      if (!jobPre.success) {
        return {
          status: "unreadable",
          what: "job",
          title: jobTitle,
          reason: "Its description may be too short or missing. Add the full posting and try again.",
        };
      }
      if (!resumePre.success) {
        return {
          status: "unreadable",
          what: "resume",
          title: resume.title,
          reason: "It may be too short or missing content. Check it in Profile → Resumes.",
        };
      }

      // Class-3 research is opt-in and costs a second round of fetching, so
      // the user's setting decides — not the model.
      const settingsRow = await db.userSettings.findUnique({
        where: { userId: ctx.userId },
      });
      const parsed = settingsRow ? JSON.parse(settingsRow.settings) : {};
      const research = {
        ...defaultUserSettings.research,
        ...(parsed.research ?? {}),
      };

      const result = await generateInterviewPrepCore({
        userId: ctx.userId,
        jobId: job.id!,
        resumeText: resumePre.data.normalizedText,
        jobDescription: jobPre.data.normalizedText,
        company: { id: company.id, label: company.label },
        provider: ctx.provider,
        model: ctx.model,
        enableProcessResearch: research.enableProcessResearch,
        guard: ctx.guard,
        abortSignal,
      });

      if (result.status === "busy") {
        return {
          status: "generation_failed",
          jobTitle,
          reason: "Another analysis is already running — ask for this one once it finishes.",
        };
      }
      if (result.status === "failed") {
        return {
          status: "generation_failed",
          jobTitle,
          reason: "The preparation could not be generated, so nothing was saved.",
        };
      }

      return {
        status: "ok",
        jobId: job.id!,
        jobTitle,
        company: company.label,
        resumeId: resume.id!,
        resumeTitle: resume.title,
        questions: result.questions,
        process: result.process,
        contextSources: result.contextSources,
        generatedAt: result.generatedAt.toISOString(),
      };
    },
  });
}
