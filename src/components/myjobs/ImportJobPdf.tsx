"use client";

import { ChangeEvent, useRef, useState } from "react";
import { FileUp, Loader } from "lucide-react";
import { Button } from "../ui/button";
import { toast } from "../ui/use-toast";
import { AiModel, defaultModel } from "@/models/ai.model";
import { getUserSettings } from "@/actions/userSettings.actions";
import { JobImportData } from "@/models/job.model";

type ImportJobPdfProps = {
  onImported: (data: JobImportData) => void;
};

export function ImportJobPdf({ onImported }: ImportJobPdfProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isImporting, setIsImporting] = useState(false);

  const getSelectedModel = async (): Promise<AiModel> => {
    try {
      const result = await getUserSettings();
      if (result.success && result.data?.settings?.ai) {
        const aiSettings = result.data.settings.ai;
        return {
          provider: aiSettings.provider || defaultModel.provider,
          model: aiSettings.model,
        };
      }
    } catch (error) {
      console.error("Error fetching AI settings:", error);
    }
    return defaultModel;
  };

  const onFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Allow re-selecting the same file after an error
    event.target.value = "";
    if (!file) return;

    setIsImporting(true);
    try {
      const selectedModel = await getSelectedModel();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", JSON.stringify(selectedModel));

      const res = await fetch("/api/ai/job/import", {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        throw new Error(body.error || "Failed to import job from PDF");
      }

      onImported(body.data as JobImportData);
      toast({
        variant: "success",
        description: "Job details imported. Review and save.",
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description:
          error instanceof Error ? error.message : "Unknown error occurred.",
      });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={onFileSelected}
        data-testid="import-job-pdf-input"
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8 gap-1"
        disabled={isImporting}
        onClick={() => fileInputRef.current?.click()}
        data-testid="import-job-pdf-btn"
      >
        {isImporting ? (
          <Loader className="h-3.5 w-3.5 spinner" />
        ) : (
          <FileUp className="h-3.5 w-3.5" />
        )}
        <span className="sr-only sm:not-sr-only sm:whitespace-nowrap">
          Import PDF
        </span>
      </Button>
    </>
  );
}
