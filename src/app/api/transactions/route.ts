import { NextRequest, NextResponse } from "next/server";
import { requireUserId } from "@/server/auth-helpers";
import {
  getTransactionsPage,
  type FeedCursor,
  type FeedFilters,
} from "@/server/queries/transactions";
import { ISO_DATE_RE } from "@/lib/dates";

const TYPES = ["Income", "Expense", "Deduction", "Transfer"] as const;

/** GET /api/transactions — cursor-paginated feed for TanStack infinite query.
 *  Thin wrapper: parse searchParams → the same query fn the RSC page uses. */
export async function GET(req: NextRequest) {
  let userId: string;
  try {
    userId = await requireUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sp = req.nextUrl.searchParams;

  // Cursor wire format: 'date|createdAtISO|uuid'
  let cursor: FeedCursor | undefined;
  const rawCursor = sp.get("cursor");
  if (rawCursor) {
    const [date, createdAt, id] = rawCursor.split("|");
    if (!date || !ISO_DATE_RE.test(date) || !createdAt || !id) {
      return NextResponse.json({ error: "Bad cursor" }, { status: 400 });
    }
    cursor = { date, createdAt, id };
  }

  const typeParam = sp.get("type");
  const filters: FeedFilters = {
    q: sp.get("q") || undefined,
    categoryId: sp.get("categoryId") || undefined,
    paymentMethodId: sp.get("paymentMethodId") || undefined,
    type: TYPES.includes(typeParam as (typeof TYPES)[number])
      ? (typeParam as FeedFilters["type"])
      : undefined,
    showDeleted: sp.get("showDeleted") === "1",
  };

  const page = await getTransactionsPage(userId, filters, cursor);
  return NextResponse.json(page);
}
