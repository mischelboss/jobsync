"use client";

import { MessagesSquare } from "lucide-react";

import { JobSection } from "./JobSection";
import { InterviewPrepView } from "@/components/interview-prep/InterviewPrepView";
import type { InterviewPrepData } from "@/actions/interview-prep.actions";

interface Props {
  data: InterviewPrepData | null;
  open: boolean;
}

/**
 * Display-only view of the preparation saved against this job.
 *
 * Generation lives in the agent chat's prepare_interview tool, the same way
 * review, match and cover letter moved there upstream.
 *
 * `data` is a server prop rather than a client fetch on purpose: the chat
 * saves the prep server-side and then calls router.refresh(), which re-runs
 * the page. A useEffect that had already hydrated would never see that write,
 * which is exactly how a generated prep could sit in the database while this
 * section still read "no preparation yet".
 */
export const InterviewPrepSection = ({ data, open }: Props) => {
  if (!open) return null;

  return (
    <JobSection
      icon={MessagesSquare}
      title="Interview Prep"
      meta={
        data ? new Date(data.generatedAt).toLocaleDateString() : undefined
      }
    >
      {data ? (
        <InterviewPrepView questions={data.questions} process={data.process} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No preparation saved for this job yet. Use the Interview Prep button
          above and the assistant will research the company and build your
          questions.
        </p>
      )}
    </JobSection>
  );
};
