import { SALARY_RANGES } from "@/lib/data/salaryRangeData";

/**
 * Maps an extracted yearly salary (min/max) to the closest SALARY_RANGES id.
 * Uses the midpoint of the given bounds; returns undefined when no salary is known.
 */
export function mapSalaryToRangeId(
  salaryMin?: number | null,
  salaryMax?: number | null,
): string | undefined {
  const bounds = [salaryMin, salaryMax].filter(
    (n): n is number => typeof n === "number" && n > 0,
  );
  if (bounds.length === 0) return undefined;

  const amount = bounds.reduce((a, b) => a + b, 0) / bounds.length;

  for (const range of SALARY_RANGES) {
    if (range.value.startsWith(">")) {
      return range.id;
    }
    const numbers = range.value
      .match(/[\d,]+/g)
      ?.map((n) => Number(n.replace(/,/g, "")));
    const upper = numbers?.[1];
    if (upper !== undefined && amount <= upper) {
      return range.id;
    }
  }

  return SALARY_RANGES[SALARY_RANGES.length - 1].id;
}
