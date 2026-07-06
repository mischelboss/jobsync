import "server-only";

import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { generateObject } from "ai";
import { getModel } from "@/lib/ai/providers";
import { checkRateLimit } from "@/lib/ai/rate-limiter";
import {
  JobImportSchema,
  JOB_IMPORT_SYSTEM_PROMPT,
  buildJobImportPrompt,
  AIUnavailableError,
  extractTextFromPdf,
} from "@/lib/ai";
import {
  resolveCompany,
  resolveJobTitle,
  resolveLocation,
} from "@/lib/entity-resolution";
import { normalizeJobUrl } from "@/lib/scraper/utils";
import { mapSalaryToRangeId } from "@/lib/salary.utils";
import { AiModel } from "@/models/ai.model";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Converts extracted plain text into simple paragraph HTML for the Tiptap editor */
const textToHtml = (text: string) =>
  text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");

/**
 * Job Import Endpoint
 * Extracts job posting fields from an uploaded PDF and resolves
 * company/title/location entities to prefill the Add Job form.
 */
export const POST = async (req: NextRequest) => {
  const session = await auth();
  const userId = session?.user?.id;

  if (!session || !userId) {
    return NextResponse.json({ message: "Not Authenticated" }, { status: 401 });
  }

  const rateLimit = checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Try again in ${Math.ceil(
          rateLimit.resetIn / 1000,
        )} seconds.`,
      },
      { status: 429 },
    );
  }

  let selectedModel: AiModel;
  let file: File;
  try {
    const formData = await req.formData();
    const fileEntry = formData.get("file");
    const modelEntry = formData.get("model");
    if (!(fileEntry instanceof File) || typeof modelEntry !== "string") {
      throw new Error("PDF file and model selection required");
    }
    file = fileEntry;
    selectedModel = JSON.parse(modelEntry) as AiModel;
  } catch {
    return NextResponse.json(
      { error: "PDF file and model selection required" },
      { status: 400 },
    );
  }

  if (file.type && file.type !== "application/pdf") {
    return NextResponse.json(
      { error: "Only PDF files are supported" },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extraction = await extractTextFromPdf(buffer, "Job posting");
    if (!extraction.success) {
      return NextResponse.json(
        { error: extraction.error!.message, code: extraction.error!.code },
        { status: 400 },
      );
    }

    const model = await getModel(
      selectedModel.provider,
      selectedModel.model || "llama3.2",
      userId,
    );

    const { object } = await generateObject({
      model,
      schema: JobImportSchema,
      system: JOB_IMPORT_SYSTEM_PROMPT,
      prompt: buildJobImportPrompt(extraction.text),
      temperature: 0.2,
    });

    // Resolve entities with the same find-or-create logic used by the scraper
    const jobTitle =
      object.jobTitle && object.jobTitle.trim().length >= 2
        ? await resolveJobTitle(object.jobTitle.trim(), userId)
        : null;
    const company =
      object.company && object.company.trim().length >= 2
        ? await resolveCompany(object.company.trim(), userId)
        : null;
    const location =
      object.location && object.location.trim().length >= 2
        ? await resolveLocation(object.location.trim(), userId)
        : null;

    const description = object.description?.trim() || extraction.text;

    return NextResponse.json({
      success: true,
      data: {
        prefill: {
          title: jobTitle?.id,
          company: company?.id,
          location: location?.id,
          type: object.jobType ?? undefined,
          salaryRange: mapSalaryToRangeId(object.salaryMin, object.salaryMax),
          jobDescription: textToHtml(description),
          jobUrl: object.jobUrl ? normalizeJobUrl(object.jobUrl) : undefined,
        },
        jobTitle,
        company,
        location,
      },
    });
  } catch (error) {
    console.error("Job import error:", error);

    if (error instanceof AIUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    const message =
      error instanceof Error ? error.message : "AI request failed";

    if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
      return NextResponse.json(
        {
          error: `Cannot connect to ${selectedModel.provider} service. Please ensure the service is running.`,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
};
