"use client";

import { MessagesSquare } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
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
        {data ? (
          <>
            <InterviewPrepView
              questions={data.questions}
              process={data.process}
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Generated {new Date(data.generatedAt).toLocaleString()}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No preparation saved for this job yet. Use the Interview Prep button
            above and the assistant will research the company and build your
            questions.
          </p>
        )}
      </CardContent>
    </Card>
  );
};
