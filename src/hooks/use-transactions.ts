"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import type {
  FeedCursor,
  FeedFilters,
  FeedPage,
  FeedRow,
} from "@/server/queries/transactions";
import {
  createTransaction,
  updateTransaction,
  setTransactionDeleted,
  type TxnInput,
} from "@/server/actions/transactions";

/* Query keys: ['transactions', normalizedFilters]. Normalization drops empty
   values so {q:''} and {} hit the same cache entry. */
export function normalizeFilters(f: FeedFilters): FeedFilters {
  const out: FeedFilters = {};
  if (f.q?.trim()) out.q = f.q.trim();
  if (f.categoryId) out.categoryId = f.categoryId;
  if (f.paymentMethodId) out.paymentMethodId = f.paymentMethodId;
  if (f.type) out.type = f.type;
  if (f.showDeleted) out.showDeleted = true;
  return out;
}

export const txnKeys = {
  all: ["transactions"] as const,
  list: (filters: FeedFilters) => ["transactions", normalizeFilters(filters)] as const,
};

function feedUrl(filters: FeedFilters, cursor?: FeedCursor): string {
  const sp = new URLSearchParams();
  const f = normalizeFilters(filters);
  if (f.q) sp.set("q", f.q);
  if (f.categoryId) sp.set("categoryId", f.categoryId);
  if (f.paymentMethodId) sp.set("paymentMethodId", f.paymentMethodId);
  if (f.type) sp.set("type", f.type);
  if (f.showDeleted) sp.set("showDeleted", "1");
  if (cursor) sp.set("cursor", `${cursor.date}|${cursor.createdAt}|${cursor.id}`);
  const qs = sp.toString();
  return `/api/transactions${qs ? `?${qs}` : ""}`;
}

export function useTransactionsFeed(filters: FeedFilters, initialPage?: FeedPage) {
  return useInfiniteQuery({
    queryKey: txnKeys.list(filters),
    queryFn: async ({ pageParam }): Promise<FeedPage> => {
      const res = await fetch(feedUrl(filters, pageParam ?? undefined));
      if (!res.ok) throw new Error(`Feed failed (${res.status})`);
      return res.json();
    },
    initialPageParam: null as FeedCursor | null,
    getNextPageParam: (last) => last.nextCursor,
    // RSC page server-renders page 0 → instant paint, no double fetch.
    initialData: initialPage
      ? { pages: [initialPage], pageParams: [null] }
      : undefined,
  });
}

type Feed = InfiniteData<FeedPage, FeedCursor | null>;

/** Optimistic quick-log: insert a placeholder at the head of page 0, roll back
 *  on error, invalidate on settle (the refetch swaps in the real server row
 *  with its derived type + BNPL badge). */
export function useCreateTransaction(filters: FeedFilters, display: {
  category: (id: string) => { name: string; mainCategory: string | null; type: FeedRow["type"]; framework: string } | undefined;
  paymentMethod: (id: string | null | undefined) => string | null;
}) {
  const qc = useQueryClient();
  const key = txnKeys.list(filters);

  return useMutation({
    mutationFn: async (input: TxnInput) => {
      const result = await createTransaction(input);
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<Feed>(key);
      const cat = display.category(input.categoryId);
      const optimistic: FeedRow = {
        id: `optimistic-${crypto.randomUUID()}`,
        date: input.date,
        amountCents: input.amountCents,
        description: input.description || null,
        type: cat?.type ?? "Expense",
        categoryId: input.categoryId,
        category: cat?.name ?? "…",
        mainCategory: cat?.mainCategory ?? null,
        framework: cat?.framework ?? "Wants",
        paymentMethodId: input.paymentMethodId ?? null,
        paymentMethod: display.paymentMethod(input.paymentMethodId),
        paymentMethodKind: null, // real kind arrives with the settle refetch
        bnplPlanId: input.bnplPlanId ?? null,
        bnpl: null, // real badge arrives with the settle refetch
        deleted: false,
        createdAt: new Date().toISOString(),
      };
      qc.setQueryData<Feed>(key, (old) =>
        old
          ? {
              ...old,
              pages: old.pages.map((p, i) =>
                i === 0 ? { ...p, rows: [optimistic, ...p.rows] } : p,
              ),
            }
          : old,
      );
      return { previous };
    },
    onError: (_err, _input, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: txnKeys.all }),
  });
}

/** Edit + soft-delete/restore go through the editor (not optimistic — they're
 *  rare, and a 300ms settle beats reconciling three cache shapes). */
export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: TxnInput }) => {
      const result = await updateTransaction(id, input);
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: txnKeys.all }),
  });
}

export function useSetTransactionDeleted() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, deleted }: { id: string; deleted: boolean }) => {
      const result = await setTransactionDeleted(id, deleted);
      if (!result.ok) throw new Error(result.error);
      return result;
    },
    onSettled: () => qc.invalidateQueries({ queryKey: txnKeys.all }),
  });
}
