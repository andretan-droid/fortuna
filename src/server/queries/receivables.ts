import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { receivables, receivablePayments } from "@/db/schema";
import {
  receivablesState,
  type ReceivableInput,
  type ReceivablePaymentInput,
  type ReceivablesSummary,
} from "@/lib/receivables";

/* Receivables read layer. Like fetchBnplInputs, fetchReceivableInputs is shared
 * so the /debts page, the wealth card, and net-worth history all read the same
 * rows the same way. */

export type ReceivableInputs = {
  receivables: ReceivableInput[];
  payments: ReceivablePaymentInput[];
};

export async function fetchReceivableInputs(
  db: ReturnType<typeof getDb>,
  userId: string,
): Promise<ReceivableInputs> {
  const [recRows, payRows] = await Promise.all([
    db
      .select({
        id: receivables.id,
        person: receivables.person,
        amountCents: receivables.amountCents,
        date: receivables.date,
        note: receivables.note,
      })
      .from(receivables)
      .where(eq(receivables.userId, userId))
      .orderBy(asc(receivables.date)),
    db
      .select({
        receivableId: receivablePayments.receivableId,
        date: receivablePayments.date,
        amountCents: receivablePayments.amountCents,
      })
      .from(receivablePayments)
      .where(eq(receivablePayments.userId, userId))
      .orderBy(asc(receivablePayments.date)),
  ]);
  return { receivables: recRows, payments: payRows };
}

/** Everything the /debts "Owed to me" section renders. */
export async function getReceivablesSummary(userId: string): Promise<ReceivablesSummary> {
  const db = getDb();
  const { receivables: recs, payments } = await fetchReceivableInputs(db, userId);
  return receivablesState(recs, payments);
}
