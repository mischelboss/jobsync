"use client";

import { NoResumesNotice } from "@/components/agent/AgentResultCard/NoResumesNotice";
import { ResumeSelectionPrompt } from "@/components/agent/AgentResultCard/ResumeSelectionPrompt";
import {
  InterviewPrepView,
  interviewQuestionCount,
} from "@/components/interview-prep/InterviewPrepView";
import type { AgentPrepareInterviewResult } from "@/models/agent.model";

// The questions come from the tool output, not from a streamed text part:
// prepare_interview generates an object, so there is nothing to stream.
export function InterviewPrepResult({
  output,
}: {
  output: AgentPrepareInterviewResult;
}) {
  if (output.status === "no_job") {
    return (
      <p className="text-sm">
        Open the job you want to prepare for first — I prepare for the job
        you&apos;re looking at.
      </p>
    );
  }

  if (output.status === "no_resumes") {
    return <NoResumesNotice />;
  }

  if (output.status === "needs_selection") {
    return (
      <ResumeSelectionPrompt
        prompt="Which resume should the preparation draw on?"
        resumes={output.resumes}
        messageFor={(title) =>
          `Prepare me for an interview for this job using my resume "${title}"`
        }
      />
    );
  }

  if (output.status === "unreadable") {
    return (
      <p className="text-sm">
        Couldn&apos;t read <strong>{output.title}</strong> — {output.reason}
      </p>
    );
  }

  if (output.status === "generation_failed") {
    return (
      <p className="text-sm">
        Couldn&apos;t prepare for <strong>{output.jobTitle}</strong> —{" "}
        {output.reason}
      </p>
    );
  }

  const total = interviewQuestionCount(output.questions);

  return (
    <div className="text-sm">
      <p className="mb-3 font-medium">
        {total} question{total === 1 ? "" : "s"} for {output.jobTitle}
        {output.company ? ` at ${output.company}` : ""}
      </p>
      <InterviewPrepView
        questions={output.questions}
        process={output.process}
      />
      <p className="mt-3 text-xs text-muted-foreground">
        Drawn from {output.resumeTitle} · saved to this job
        {output.contextSources.length > 0
          ? ` · company research from ${output.contextSources.length} source${
              output.contextSources.length === 1 ? "" : "s"
            }`
          : " · no company research available"}
      </p>
    </div>
  );
}
