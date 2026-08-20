"use client";

import type { LucideIcon } from "lucide-react";

/**
 * One labelled block inside the job card.
 *
 * The job description, the AI match analysis, the interview prep and the cover
 * letter are four long bodies of prose stacked on one page. Before this they
 * each had their own treatment — the description had no heading at all, the
 * match had a bare h4, and the prep was a nested Card — so it was not obvious
 * where one ended and the next began. They all render through here instead, so
 * the rhythm is identical and the heading is what tells them apart.
 */
export function JobSection({
  icon: Icon,
  title,
  meta,
  children,
}: {
  icon: LucideIcon;
  title: string;
  /** Small right-aligned note: a timestamp, a source count, a resume name. */
  meta?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-4 mb-6">
      <div className="mb-2 flex items-center justify-between gap-2 border-b pb-1.5">
        <h4 className="flex items-center gap-2 font-medium">
          <Icon className="h-4 w-4 shrink-0" />
          {title}
        </h4>
        {meta && (
          <span className="text-xs text-muted-foreground">{meta}</span>
        )}
      </div>
      {children}
    </section>
  );
}
