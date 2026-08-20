import "server-only";

import type { LanguageModel } from "ai";
import db from "@/lib/db";
import { resolvePromptPair } from "@/lib/ai/prompts/resolve";
import { TEMPERATURES, TEXT_LIMITS } from "@/lib/ai/config";
import { InterviewQuestionsSchema } from "@/models/ai.schemas";
import type { InterviewQuestions, ProcessResearch } from "@/models/ai.schemas";
import { AiProvider } from "@/models/ai.model";
import { getCompanyContext } from "@/lib/research/company";
import { getInterviewProcess } from "@/lib/research/process";
import { NO_COMPANY_CONTEXT } from "@/lib/research/config";
import { APP_CONSTANTS } from "@/lib/constants";
import {
  runNestedObjectGeneration,
  type NestedGenerationGuard,
} from "@/lib/agent/nestedGeneration";

export interface InterviewPrepCoreArgs {
  userId: string;
  jobId: string;
  /** Already preprocessed and normalized by the caller. */
  resumeText: string;
  jobDescription: string;
  company: { id: string; label: string };
  provider: AiProvider | string;
  model: LanguageModel;
  enableProcessResearch: boolean;
  guard: NestedGenerationGuard;
  abortSignal?: AbortSignal;
}

export type InterviewPrepCoreResult =
  | {
      status: "ok";
      questions: InterviewQuestions;
      process: ProcessResearch | null;
      contextSources: string[];
      generatedAt: Date;
    }
  | { status: "busy" }
  | { status: "failed" };

/**
 * The three-class generation, lifted out of the server action so the agent
 * chat tool and any future caller share one implementation.
 *
 * Degradation contract:
 *  - Class 1 (technical/gaps/cvBreaks/behavioural/candidateQuestions) is the
 *    trunk and the only mandatory LLM call. If it fails, so does this.
 *  - Class 2 (culture/situation) is a branch: any failure resets companyContext
 *    to the NONE sentinel, and the system prompt then forces empty Class-2
 *    arrays rather than inventing culture.
 *  - Class 3 (process research) is flag-gated and best-effort: failure is null.
 */
export async function generateInterviewPrepCore(
  args: InterviewPrepCoreArgs,
): Promise<InterviewPrepCoreResult> {
  const {
    userId,
    jobId,
    company,
    model,
    provider,
    enableProcessResearch,
    guard,
    abortSignal,
  } = args;

  const limits =
    provider === AiProvider.OLLAMA ? TEXT_LIMITS.OLLAMA : TEXT_LIMITS.CLOUD;
  const resumeText = args.resumeText.slice(0, limits.RESUME);
  const jobDescription = args.jobDescription.slice(0, limits.JOB);

  // ── Class 2 enrichment (branch: failure ⇒ sentinel) ───────────────────────
  let companyContext = NO_COMPANY_CONTEXT;
  let contextSources: string[] = [];
  const { context, sources } = await getCompanyContext(userId, company, model);
  if (context) {
    companyContext = JSON.stringify(context);
    contextSources = sources;
  }

  // ── Class 1 + Class 2 questions (trunk: the only mandatory LLM call) ───────
  const { system, prompt } = await resolvePromptPair("interview-prep", userId, {
    resumeText,
    jobDescription,
    companyContext, // ALWAYS passed, sentinel included
  });

  const generation = await runNestedObjectGeneration({
    model,
    schema: InterviewQuestionsSchema,
    system,
    prompt,
    temperature: TEMPERATURES.ANALYSIS,
    numCtx: APP_CONSTANTS.AI_OLLAMA_NUM_CTX,
    timeoutMs: APP_CONSTANTS.AI_INTERVIEW_PREP_TIMEOUT_MS,
    abortSignal,
    guard,
    label: "prepare_interview",
  });
  if (generation.status !== "ok") return generation;

  const questions = generation.object;

  // ── Class 3 process research (flag-gated branch: failure ⇒ null) ──────────
  let process: ProcessResearch | null = null;
  if (enableProcessResearch) {
    process = await getInterviewProcess(userId, company, model);
  }

  const saved = await db.interviewPrep.upsert({
    where: { jobId },
    update: {
      questions: JSON.stringify(questions),
      process: process ? JSON.stringify(process) : null,
      generatedAt: new Date(),
    },
    create: {
      jobId,
      userId,
      questions: JSON.stringify(questions),
      process: process ? JSON.stringify(process) : null,
    },
  });

  return {
    status: "ok",
    questions,
    process,
    contextSources,
    generatedAt: saved.generatedAt,
  };
}
