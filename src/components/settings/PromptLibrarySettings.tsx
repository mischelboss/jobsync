"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "../ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { toast } from "../ui/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import {
  AlertTriangle,
  ChevronDown,
  Loader2,
  RotateCcw,
  Save,
} from "lucide-react";
import {
  PROMPT_FEATURES,
  PROMPT_REGISTRY_BY_ID,
  validateOverrideText,
  type PromptEntry,
} from "@/lib/ai/prompts/registry";
import {
  getPromptOverrides,
  resetPromptOverride,
  upsertPromptOverride,
} from "@/actions/prompt.actions";
import type { PromptOverrideClientResponse } from "@/models/prompt.schema";

type OverrideMap = Record<string, PromptOverrideClientResponse>;

interface Draft {
  appendText: string;
  overrideText: string;
}

function draftFor(entry: PromptEntry, saved?: PromptOverrideClientResponse): Draft {
  return {
    appendText: saved?.appendText ?? "",
    // The default seeds the Advanced editor, so replacing it starts from working text.
    overrideText: saved?.overrideText ?? entry.defaultText,
  };
}

function PromptEditor({
  entry,
  saved,
  onSaved,
}: {
  entry: PromptEntry;
  saved?: PromptOverrideClientResponse;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFor(entry, saved));
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(saved?.overrideText));
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setDraft(draftFor(entry, saved));
    setAdvancedOpen(Boolean(saved?.overrideText));
  }, [entry, saved]);

  // Text identical to the default is not an override — it is the default.
  const overrideToSave =
    draft.overrideText.trim() && draft.overrideText !== entry.defaultText
      ? draft.overrideText
      : null;

  const validationError = overrideToSave
    ? validateOverrideText(entry, overrideToSave)
    : null;

  const appendToSave = draft.appendText.trim() ? draft.appendText : null;
  const isCustomized = Boolean(saved?.overrideText || saved?.appendText);
  const isDirty =
    (saved?.appendText ?? null) !== appendToSave ||
    (saved?.overrideText ?? null) !== overrideToSave;

  const handleSave = async () => {
    setSaving(true);
    const result = await upsertPromptOverride({
      promptId: entry.id,
      overrideText: overrideToSave,
      appendText: appendToSave,
    });
    setSaving(false);

    if (result?.success) {
      toast({ variant: "success", description: `${entry.label} saved` });
      onSaved();
    } else {
      toast({
        variant: "destructive",
        description: result?.message ?? "Failed to save prompt",
      });
    }
  };

  const handleReset = async () => {
    setResetting(true);
    const result = await resetPromptOverride(entry.id);
    setResetting(false);

    if (result?.success) {
      toast({ variant: "success", description: `${entry.label} reset to default` });
      onSaved();
    } else {
      toast({
        variant: "destructive",
        description: result?.message ?? "Failed to reset prompt",
      });
    }
  };

  return (
    <div className="rounded-md border p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-medium">{entry.label}</h4>
            {isCustomized && <Badge variant="secondary">Customized</Badge>}
          </div>
          <p className="text-sm text-muted-foreground">{entry.description}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${entry.id}-append`}>Additional instructions</Label>
        <Textarea
          id={`${entry.id}-append`}
          rows={3}
          placeholder="e.g. Always answer in German."
          value={draft.appendText}
          onChange={(e) =>
            setDraft((d) => ({ ...d, appendText: e.target.value }))
          }
        />
        <p className="text-xs text-muted-foreground">
          Appended to the end of this prompt. The safest way to adjust behaviour.
        </p>
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1 px-0 hover:bg-transparent">
            <ChevronDown
              className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`}
            />
            Advanced: replace default text
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-2 pt-2">
          <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p>
                Replacing the default text can change how the model responds. Use
                Reset to restore it.
              </p>
              {entry.structuredOutput && (
                <p className="font-medium text-amber-700 dark:text-amber-500">
                  This prompt drives structured JSON extraction. Instructions that
                  contradict the expected shape will make the import fail at runtime.
                </p>
              )}
            </div>
          </div>

          {entry.requiredPlaceholders.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">
                Must keep:
              </span>
              {entry.requiredPlaceholders.map((placeholder) => (
                <Badge key={placeholder} variant="outline" className="font-mono">
                  {`{{${placeholder}}}`}
                </Badge>
              ))}
            </div>
          )}

          <Textarea
            aria-label={`${entry.label} override text`}
            rows={12}
            className="font-mono text-xs"
            value={draft.overrideText}
            onChange={(e) =>
              setDraft((d) => ({ ...d, overrideText: e.target.value }))
            }
          />

          {validationError && (
            <p className="text-xs text-destructive">{validationError}</p>
          )}
        </CollapsibleContent>
      </Collapsible>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          onClick={handleSave}
          disabled={saving || !isDirty || Boolean(validationError)}
        >
          {saving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={!isCustomized || resetting}
            >
              {resetting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RotateCcw className="mr-2 h-4 w-4" />
              )}
              Reset
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reset {entry.label}?</AlertDialogTitle>
              <AlertDialogDescription>
                This discards your replacement text and your additional
                instructions for this prompt, restoring the shipped default.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset}>Reset</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function PromptLibrarySettings() {
  const [overrides, setOverrides] = useState<OverrideMap>({});
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await getPromptOverrides();
    if (result?.success && result.data) {
      setOverrides(
        Object.fromEntries(result.data.map((row) => [row.promptId, row])),
      );
    } else if (result?.message) {
      toast({ variant: "destructive", description: result.message });
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading prompts…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Prompt Library</h3>
        <p className="text-sm text-muted-foreground">
          Adjust the instructions JobSync sends to the AI model. Add extra
          instructions to a prompt, or replace it entirely. Changes apply to your
          account only, and take effect on the next AI request.
        </p>
      </div>

      <Accordion type="multiple" className="w-full">
        {PROMPT_FEATURES.map((feature) => {
          const entries = [
            PROMPT_REGISTRY_BY_ID[feature.systemId],
            PROMPT_REGISTRY_BY_ID[feature.userId],
          ];
          const customizedCount = entries.filter(
            (entry) =>
              overrides[entry.id]?.overrideText ||
              overrides[entry.id]?.appendText,
          ).length;

          return (
            <AccordionItem key={feature.feature} value={feature.feature}>
              <AccordionTrigger>
                <div className="flex flex-1 items-center justify-between pr-2 text-left">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{feature.label}</span>
                      {customizedCount > 0 && (
                        <Badge variant="secondary">
                          {customizedCount} customized
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-normal text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="space-y-3">
                {entries.map((entry) => (
                  <PromptEditor
                    key={entry.id}
                    entry={entry}
                    saved={overrides[entry.id]}
                    onSaved={load}
                  />
                ))}
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}

export default PromptLibrarySettings;
