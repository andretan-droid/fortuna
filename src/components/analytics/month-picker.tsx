"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { formatMonthLong } from "@/lib/dates";

/** Scopes the month-bound breakdowns (category + framework) via `?month=`, the
 *  same URL-searchParams idiom as the transactions feed. ponytail: native
 *  <select>; the RSC page re-renders for whatever the URL says. */
export function MonthPicker({
  months,
  selected,
}: {
  months: string[];
  selected: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setMonth(month: string) {
    const next = new URLSearchParams(sp.toString());
    next.set("month", month);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Month</span>
      <select
        value={selected}
        onChange={(e) => setMonth(e.target.value)}
        className="h-8 rounded-md border bg-background px-2 text-sm"
        aria-label="Select month for breakdowns"
      >
        {months.map((m) => (
          <option key={m} value={m}>
            {formatMonthLong(m)}
          </option>
        ))}
      </select>
    </label>
  );
}
