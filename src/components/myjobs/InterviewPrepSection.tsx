"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessagesSquare, Plus, Check, ExternalLink } from "lucide-react";

import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import { toast } from "../ui/use-toast";
import { APP_CONSTANTS } from "@/lib/constants";
import {
  generateInterviewPrep,
  getInterviewPrep,
  type InterviewPrepData,
} from "@/actions/interview-prep.actions";
import { createQuestion } from "@/actions/question.actions";
import type {
  InterviewQuestion,
  InterviewQuestions,
  ProcessResearch,
} from "@/models/ai.schemas";

interface Props {
  jobId: string;
  open: boolean;
}

// Class-1 groups render always; Class-2 groups only when non-empty.
const CLASS_1_GROUPS: { key: keyof InterviewQuestions; label: string }[] = [
  { key: "technical", label: "Technical & role" },
  { key: "gaps", label: "Gaps vs. requirements" },
  { key: "cvBreaks", label: "CV breaks & transitions" },
  { key: "behavioural", label: "Behavioural (STAR)" },
  { key: "candidateQuestions", label: "Questions to ask them" },
];

const CLASS_2_GROUPS: { key: keyof InterviewQuestions; label: string }[] = [
  { key: "cultureValues", label: "Culture & values" },
  { key: "currentSituation", label: "Current situation" },
];

export const InterviewPrepSection = ({ jobId, open }: Props) => {
  const [loading, setLoading] = useState(false);
  const [hydrating, setHydrating] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [data, setData] = useState<InterviewPrepData | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [addingKey, setAddingKey] = useState<string | null>(null);

  // Hydrate any persisted prep the first time the section is opened.
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

  const runGenerate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await generateInterviewPrep(jobId);
      if (res?.success) {
        setData(res.data as InterviewPrepData);
        setAdded(new Set());
        toast({ variant: "success", description: "Interview prep generated." });
      } else {
        toast({
          variant: "destructive",
          title: "Error!",
          description: res?.message ?? "Failed to generate interview prep.",
        });
      }
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const addToBank = useCallback(
    async (groupKey: string, index: number, q: InterviewQuestion) => {
      const key = `${groupKey}:${index}`;
      // createQuestion requires an answer of at least MIN_QUESTION_ANSWER_LENGTH.
      const answer =
        q.answerScaffold &&
        q.answerScaffold.length >= APP_CONSTANTS.MIN_QUESTION_ANSWER_LENGTH
          ? q.answerScaffold
          : `${q.answerScaffold ?? ""} (prepare a concrete example)`.trim();

      setAddingKey(key);
      try {
        const res = await createQuestion({ question: q.question, answer });
        if (res?.success) {
          setAdded((prev) => new Set(prev).add(key));
          toast({ variant: "success", description: "Added to Question Bank." });
        } else {
          toast({
            variant: "destructive",
            title: "Error!",
            description: res?.message ?? "Could not add to Question Bank.",
          });
        }
      } finally {
        setAddingKey(null);
      }
    },
    [],
  );

  if (!open) return null;

  const hasClass2 =
    data &&
    CLASS_2_GROUPS.some((g) => (data.questions[g.key]?.length ?? 0) > 0);

  return (
    <Card className="mt-4">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <MessagesSquare className="h-4 w-4" />
              Interview Prep
            </CardTitle>
            <CardDescription>
              Likely questions from your CV and this job, with answer scaffolds.
            </CardDescription>
          </div>
          <Button size="sm" onClick={runGenerate} disabled={loading || hydrating}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Generating…
              </>
            ) : data ? (
              "Regenerate"
            ) : (
              "Generate"
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {hydrating && (
          <p className="text-sm text-muted-foreground">Loading…</p>
        )}

        {!hydrating && !data && (
          <p className="text-sm text-muted-foreground">
            No preparation yet. Click Generate to create likely interview
            questions for this role.
          </p>
        )}

        {data && (
          <div className="space-y-6">
            <Accordion type="multiple" className="w-full">
              {CLASS_1_GROUPS.map((g) => {
                const items = data.questions[g.key] ?? [];
                if (items.length === 0) return null;
                return (
                  <AccordionItem key={g.key} value={g.key}>
                    <AccordionTrigger className="text-sm font-semibold">
                      {g.label}{" "}
                      <span className="ml-2 text-muted-foreground">
                        ({items.length})
                      </span>
                    </AccordionTrigger>
                    <AccordionContent>
                      <QuestionList
                        groupKey={g.key}
                        items={items}
                        added={added}
                        addingKey={addingKey}
                        onAdd={addToBank}
                      />
                    </AccordionContent>
                  </AccordionItem>
                );
              })}

              {hasClass2 &&
                CLASS_2_GROUPS.map((g) => {
                  const items = data.questions[g.key] ?? [];
                  if (items.length === 0) return null;
                  return (
                    <AccordionItem key={g.key} value={g.key}>
                      <AccordionTrigger className="text-sm font-semibold">
                        {g.label}{" "}
                        <span className="ml-2 text-muted-foreground">
                          ({items.length})
                        </span>
                      </AccordionTrigger>
                      <AccordionContent>
                        <QuestionList
                          groupKey={g.key}
                          items={items}
                          added={added}
                          addingKey={addingKey}
                          onAdd={addToBank}
                        />
                      </AccordionContent>
                    </AccordionItem>
                  );
                })}
            </Accordion>

            {data.process && <ProcessPanel process={data.process} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

function QuestionList({
  groupKey,
  items,
  added,
  addingKey,
  onAdd,
}: {
  groupKey: string;
  items: InterviewQuestion[];
  added: Set<string>;
  addingKey: string | null;
  onAdd: (groupKey: string, index: number, q: InterviewQuestion) => void;
}) {
  return (
    <ul className="space-y-4">
      {items.map((q, i) => {
        const key = `${groupKey}:${i}`;
        const isAdded = added.has(key);
        return (
          <li key={key} className="border-l-2 border-muted pl-3">
            <p className="font-medium">{q.question}</p>
            {q.rationale && (
              <p className="mt-1 text-xs italic text-muted-foreground">
                {q.rationale}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {q.answerScaffold}
            </p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2 h-7"
              disabled={isAdded || addingKey === key}
              onClick={() => onAdd(groupKey, i, q)}
            >
              {addingKey === key ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : isAdded ? (
                <Check className="mr-1 h-3 w-3" />
              ) : (
                <Plus className="mr-1 h-3 w-3" />
              )}
              {isAdded ? "In Question Bank" : "Add to Question Bank"}
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function ProcessPanel({ process }: { process: ProcessResearch }) {
  return (
    <div className="rounded-md border border-dashed p-4">
      <div className="mb-2 flex items-center gap-2">
        <h4 className="text-sm font-semibold">Interview process</h4>
        <Badge variant="outline">Researched · best effort</Badge>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">
        Estimated from anecdotal public sources — verify before relying on it.
        {process.roundsCount != null && ` Likely ${process.roundsCount} round(s).`}
      </p>
      {process.rounds.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No concrete process details found.
        </p>
      ) : (
        <ol className="space-y-3">
          {process.rounds.map((r, i) => (
            <li key={i} className="border-l-2 border-muted pl-3">
              <div className="flex items-center gap-2">
                <span className="font-medium">{r.name}</span>
                <Badge
                  variant={r.confidence === "verified" ? "default" : "secondary"}
                >
                  {r.confidence}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{r.character}</p>
              {r.source && (
                <a
                  href={r.source}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  source
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
