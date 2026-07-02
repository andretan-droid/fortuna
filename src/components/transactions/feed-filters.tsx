"use client";

import { useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CategoryOption, SimpleOption } from "./txn-form";

const TYPES = ["Income", "Expense", "Deduction", "Transfer"] as const;

/** Filter state lives in URL searchParams (plan) — shareable, survives reload,
 *  and the RSC page server-renders page 0 for whatever the URL says. */
export function FeedFilters({
  categories,
  paymentMethods,
}: {
  categories: CategoryOption[];
  paymentMethods: SimpleOption[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const activeType = sp.get("type");
  const showDeleted = sp.get("showDeleted") === "1";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-44 flex-1 sm:max-w-xs">
        <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          defaultValue={sp.get("q") ?? ""}
          placeholder="Search descriptions…"
          className="pl-8"
          onChange={(e) => {
            if (debounce.current) clearTimeout(debounce.current);
            const v = e.target.value;
            debounce.current = setTimeout(() => setParam("q", v.trim() || null), 300);
          }}
        />
      </div>

      {TYPES.map((t) => (
        <Button
          key={t}
          size="sm"
          variant={activeType === t ? "default" : "outline"}
          onClick={() => setParam("type", activeType === t ? null : t)}
        >
          {t}
        </Button>
      ))}

      {/* ponytail: native selects for low-frequency filters; comboboxes stay in the form */}
      <select
        value={sp.get("categoryId") ?? ""}
        onChange={(e) => setParam("categoryId", e.target.value || null)}
        className="h-8 rounded-md border bg-background px-2 text-sm"
        aria-label="Filter by category"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <select
        value={sp.get("paymentMethodId") ?? ""}
        onChange={(e) => setParam("paymentMethodId", e.target.value || null)}
        className="h-8 rounded-md border bg-background px-2 text-sm"
        aria-label="Filter by payment method"
      >
        <option value="">All methods</option>
        {paymentMethods.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>

      <Button
        size="sm"
        variant={showDeleted ? "secondary" : "ghost"}
        onClick={() => setParam("showDeleted", showDeleted ? null : "1")}
      >
        {showDeleted ? "Hiding nothing" : "Show deleted"}
      </Button>
    </div>
  );
}
