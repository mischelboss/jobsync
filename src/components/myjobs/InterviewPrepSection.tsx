"use client";

import { useEffect, useState } from "react";
import { MessagesSquare } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { InterviewPrepView } from "@/components/interview-prep/InterviewPrepView";
import {
  getInterviewPrep,
  type InterviewPrepData,
} from "@/actions/interview-prep.actions";

interface Props {
  jobId: string;
  open: boolean;
}

/**
 * Display-only view of the preparation saved against this job.
 *
 * Generation lives in the agent chat's prepare_interview tool, the same way
 * review, match and cover letter moved there upstream — so this section shows
 * what was saved and points at the chat when there is nothing yet.
 */
export const InterviewPrepSection = ({ jobId, open }: Props) => {
  const [hydrating, setHydrating] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<InterviewPrepData | null>(null);

  useEffect(() => {
    if (!open || hydrated) return;
    setHydrated(true);
    setHydrating(true);
    getInterviewPrep(jobId)
      .then((res) => {
        if (res?.success && res.data) setData(res.data as InterviewPrepData);
      })
      .finally(() => setHydrating(false));
  }, [open, hydrated, jobId]);

  if (!open) return null;

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessagesSquare className="h-4 w-4" />
          Interview Prep
        </CardTitle>
        <CardDescription>
          Likely questions from your CV and this job, with answer scaffolds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hydrating && <p className="text-sm text-muted-foreground">Loading…</p>}

        {!hydrating && !data && (
          <p className="text-sm text-muted-foreground">
            No preparation saved for this job yet. Use the Interview Prep button
            above and the assistant will research the company and build your
            questions.
          </p>
        )}

        {data && (
          <>
            <InterviewPrepView
              questions={data.questions}
              process={data.process}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Generated {new Date(data.generatedAt).toLocaleString()}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};
