"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTransactionsFeed } from "@/hooks/use-transactions";
import { formatDayHeader } from "@/lib/dates";
import type { FeedFilters, FeedPage, FeedRow } from "@/server/queries/transactions";
import { FeedFilters as Filters } from "./feed-filters";
import { FeedRowItem } from "./feed-row";
import { QuickLog } from "./quick-log";
import { BatchAdd } from "./batch-add";
import { TxnEditor } from "./txn-editor";
import type { BnplOption, CategoryOption, SimpleOption } from "./txn-form";

/** Client orchestrator: filters bar, day-grouped infinite feed, quick-log FAB,
 *  and the editor dialog. Page 0 arrives server-rendered via initialPage. */
export function TransactionsView({
  filters,
  initialPage,
  categories,
  paymentMethods,
  bnplPlans,
}: {
  filters: FeedFilters;
  initialPage: FeedPage;
  categories: CategoryOption[];
  paymentMethods: SimpleOption[];
  bnplPlans: BnplOption[];
}) {
  const feed = useTransactionsFeed(filters, initialPage);
  const [editing, setEditing] = useState<FeedRow | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  // Infinite scroll: fetch the next page when the sentinel enters view.
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && feed.hasNextPage && !feed.isFetchingNextPage) {
          feed.fetchNextPage();
        }
      },
      { rootMargin: "600px" }, // start loading well before the bottom
    );
    io.observe(el);
    return () => io.disconnect();
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed]);

  const rows = useMemo(
    () => feed.data?.pages.flatMap((p) => p.rows) ?? [],
    [feed.data],
  );

  // Day grouping — rows arrive date-DESC, so one linear pass preserves order.
  const groups = useMemo(() => {
    const out: { date: string; rows: FeedRow[] }[] = [];
    for (const r of rows) {
      const last = out[out.length - 1];
      if (last && last.date === r.date) last.rows.push(r);
      else out.push({ date: r.date, rows: [r] });
    }
    return out;
  }, [rows]);

  const hasFilters = Boolean(
    filters.q || filters.categoryId || filters.paymentMethodId || filters.type,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <Filters categories={categories} paymentMethods={paymentMethods} />
        </div>
        <BatchAdd categories={categories} paymentMethods={paymentMethods} />
      </div>

      {groups.length === 0 ? (
        <div className="rounded-lg border border-dashed py-20 text-center">
          <p className="font-display text-xl">
            {hasFilters ? "Nothing matches" : "No transactions yet"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {hasFilters
              ? "Loosen a filter or clear the search."
              : "Tap the + button to log your first one."}
          </p>
        </div>
      ) : (
        <div>
          {groups.map((g) => (
            <section key={g.date}>
              {/* Sticky serif day header — sits just below the h-16 topbar. */}
              <h2 className="glass sticky top-16 z-10 -mx-1 px-1 py-2 font-display text-sm text-muted-foreground">
                {formatDayHeader(g.date)}
              </h2>
              {g.rows.map((r) => (
                <FeedRowItem key={r.id} row={r} onEdit={setEditing} />
              ))}
            </section>
          ))}
          <div ref={sentinel} aria-hidden />
          {feed.isFetchingNextPage && (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading more…</p>
          )}
          {!feed.hasNextPage && rows.length > 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              End of ledger · {rows.length} loaded
            </p>
          )}
        </div>
      )}

      <QuickLog
        filters={filters}
        categories={categories}
        paymentMethods={paymentMethods}
        bnplPlans={bnplPlans}
      />
      <TxnEditor
        row={editing}
        onClose={() => setEditing(null)}
        categories={categories}
        paymentMethods={paymentMethods}
        bnplPlans={bnplPlans}
      />
    </div>
  );
}
