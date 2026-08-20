"use client";

import { useEffect, useState, type ReactNode } from "react";
import { FileDown, Loader } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { cn } from "@/lib/utils";
// Imported from ./types directly: the barrel re-exports generateResumePdfBlob,
// which would pull @react-pdf/renderer into this eagerly-loaded chunk.
import { RESUME_LAYOUT_LABELS, type ResumeLayout } from "./resume-pdf/types";

type ExportPdfDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isExporting: boolean;
  onExport: (layout: ResumeLayout) => void;
};

// Paper stays white in dark mode on purpose: the PDF page is white.
function SkeletonPage({ children }: { children: ReactNode }) {
  return (
    <div className="flex aspect-[3/4] w-full flex-col gap-1.5 rounded-md border bg-white p-3">
      {children}
    </div>
  );
}

// Mirrors SimpleTemplate: header, then titled sections (label + black divider).
function SimpleSkeleton() {
  return (
    <SkeletonPage>
      {/* Header */}
      <div className="flex flex-col gap-1.5">
        <div className="h-2.5 w-2/5 rounded-full bg-gray-800" />
        <div className="h-1.5 w-1/3 rounded-full bg-gray-400" />
        <div className="h-1 w-3/5 rounded-full bg-gray-300" />
      </div>
      {/* Summary */}
      <div className="flex flex-col gap-1">
        <div className="h-1.5 w-1/4 rounded-full bg-gray-700" />
        <div className="h-px w-full bg-gray-800" />
        <div className="h-1.5 w-full rounded-full bg-gray-200" />
        <div className="h-1.5 w-11/12 rounded-full bg-gray-200" />
      </div>
      {/* Skills — category label + values rows */}
      <div className="flex flex-col gap-1">
        <div className="h-1.5 w-1/5 rounded-full bg-gray-700" />
        <div className="h-px w-full bg-gray-800" />
        {[0, 1].map((i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="h-1.5 w-1/5 shrink-0 rounded-full bg-gray-400" />
            <div className="h-1.5 flex-1 rounded-full bg-gray-200" />
          </div>
        ))}
      </div>
      {/* Experience — entry title, meta, body */}
      <div className="flex flex-col gap-1">
        <div className="h-1.5 w-1/3 rounded-full bg-gray-700" />
        <div className="h-px w-full bg-gray-800" />
        <div className="h-1.5 w-1/2 rounded-full bg-gray-500" />
        <div className="h-1 w-2/5 rounded-full bg-gray-300" />
        <div className="h-1.5 w-full rounded-full bg-gray-200" />
        <div className="h-1.5 w-11/12 rounded-full bg-gray-200" />
      </div>
    </SkeletonPage>
  );
}

// Mirrors ProfessionalTemplate: accent headline/rules, heading-less summary,
// two-column skill categories, entry rows with right-aligned dates.
function ProfessionalSkeleton() {
  return (
    <SkeletonPage>
      {/* Header */}
      <div className="flex justify-between">
        <div className="flex w-1/2 flex-col gap-1.5">
          <div className="h-2.5 w-4/5 rounded-full bg-gray-800" />
          <div className="h-1.5 w-3/5 rounded-full bg-[#34506e]" />
        </div>
        <div className="flex w-1/3 flex-col items-end gap-1">
          <div className="h-1 w-4/5 rounded-full bg-gray-300" />
          <div className="h-1 w-3/5 rounded-full bg-gray-300" />
          <div className="h-1 w-2/5 rounded-full bg-gray-300" />
        </div>
      </div>
      {/* Thick rule */}
      <div className="h-0.5 w-full rounded-full bg-gray-900" />
      {/* Summary — no heading */}
      <div className="flex flex-col gap-1">
        <div className="h-1.5 w-full rounded-full bg-gray-200" />
        <div className="h-1.5 w-11/12 rounded-full bg-gray-200" />
      </div>
      {/* Skills — two-column categories */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1/5 rounded-full bg-[#34506e]" />
          <div className="h-px flex-1 bg-[#34506e]" />
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-0.5">
              <div className="h-1 w-2/5 rounded-full bg-gray-400" />
              <div className="h-1.5 w-full rounded-full bg-gray-200" />
            </div>
          ))}
        </div>
      </div>
      {/* Experience — title + right-aligned date, meta, body */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <div className="h-1.5 w-1/4 rounded-full bg-[#34506e]" />
          <div className="h-px flex-1 bg-[#34506e]" />
        </div>
        <div className="flex items-center justify-between">
          <div className="h-1.5 w-2/5 rounded-full bg-gray-500" />
          <div className="h-1 w-1/6 rounded-full bg-gray-300" />
        </div>
        <div className="h-1 w-1/3 rounded-full bg-gray-300" />
        <div className="h-1.5 w-full rounded-full bg-gray-200" />
        <div className="h-1.5 w-11/12 rounded-full bg-gray-200" />
      </div>
    </SkeletonPage>
  );
}

export function ExportPdfDialog({
  open,
  onOpenChange,
  isExporting,
  onExport,
}: ExportPdfDialogProps) {
  const [selected, setSelected] = useState<ResumeLayout>("simple");

  // Simple is the pre-selected default every time the dialog opens.
  useEffect(() => {
    if (open) setSelected("simple");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Export to PDF</DialogTitle>
          <DialogDescription>Choose a template.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          {(["simple", "professional"] as ResumeLayout[]).map((layout) => (
            <button
              key={layout}
              type="button"
              aria-pressed={selected === layout}
              disabled={isExporting}
              onClick={() => setSelected(layout)}
              className={cn(
                "flex flex-col gap-2 rounded-lg border p-3 transition-colors",
                selected === layout
                  ? "border-primary ring-2 ring-primary"
                  : "hover:border-primary/50",
              )}
            >
              {layout === "simple" ? (
                <SimpleSkeleton />
              ) : (
                <ProfessionalSkeleton />
              )}
              <span className="text-center text-sm font-medium">
                {RESUME_LAYOUT_LABELS[layout]}
              </span>
            </button>
          ))}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isExporting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isExporting}
            onClick={() => {
              onOpenChange(false);
              onExport(selected);
            }}
          >
            {isExporting ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <FileDown className="h-4 w-4" />
                Export
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
