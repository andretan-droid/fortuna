"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { RANGES, type Range } from "./range";

const LABEL: Record<Range, string> = {
  "3m": "3M",
  "6m": "6M",
  "12m": "12M",
  ytd: "YTD",
  all: "All",
};

/** One control for the timeline of all trend charts (cash flow, savings rate,
 *  net worth). Writes `?range=` — same URL-searchParams idiom as MonthPicker;
 *  the RSC page slices the series server-side. */
export function RangePicker({ selected }: { selected: Range }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  function setRange(range: Range) {
    const next = new URLSearchParams(sp.toString());
    next.set("range", range);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="inline-flex rounded-md border p-0.5" role="group" aria-label="Chart time range">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => setRange(r)}
          aria-pressed={r === selected}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            r === selected
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {LABEL[r]}
        </button>
      ))}
    </div>
  );
}
