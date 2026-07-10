import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  accounts,
  paymentMethods,
  recurringRules,
  sinkingFunds,
  userSettings,
} from "@/db/schema";

export type SettingsProfile = typeof userSettings.$inferSelect | null;

/** Net (take-home) salary in cents, or null if unset. Cheap single-column read
 *  for the categories metrics header + budget-cap checks. */
export async function getNetSalaryCents(userId: string): Promise<number | null> {
  const [row] = await getDb()
    .select({ netSalaryCents: userSettings.netSalaryCents })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return row?.netSalaryCents ?? null;
}

/** Default payment method for quick-log prefill, or null if unset. Cheap
 *  single-column read — mirrors getNetSalaryCents above. */
export async function getDefaultPaymentMethodId(userId: string): Promise<string | null> {
  const [row] = await getDb()
    .select({ defaultPaymentMethodId: userSettings.defaultPaymentMethodId })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  return row?.defaultPaymentMethodId ?? null;
}
export type PaymentMethodRow = typeof paymentMethods.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type SinkingFundRow = typeof sinkingFunds.$inferSelect;
export type RecurringRuleRow = typeof recurringRules.$inferSelect;

/** Everything the settings page renders, in one Promise.all round-trip.
 *  Profile is null until first save (row created lazily by the action). */
export async function getSettingsBundle(userId: string): Promise<{
  profile: SettingsProfile;
  paymentMethods: PaymentMethodRow[];
  accounts: AccountRow[];
  sinkingFunds: SinkingFundRow[];
  recurringRules: RecurringRuleRow[];
}> {
  const db = getDb();
  const [profileRows, pms, accts, sinking, recurring] = await Promise.all([
    db.select().from(userSettings).where(eq(userSettings.userId, userId)),
    db
      .select()
      .from(paymentMethods)
      .where(eq(paymentMethods.userId, userId))
      .orderBy(asc(paymentMethods.name)),
    db
      .select()
      .from(accounts)
      .where(eq(accounts.userId, userId))
      .orderBy(asc(accounts.sort), asc(accounts.name)),
    db
      .select()
      .from(sinkingFunds)
      .where(eq(sinkingFunds.userId, userId))
      .orderBy(asc(sinkingFunds.name)),
    db
      .select()
      .from(recurringRules)
      .where(eq(recurringRules.userId, userId))
      .orderBy(asc(recurringRules.description)),
  ]);
  return {
    profile: profileRows[0] ?? null,
    paymentMethods: pms,
    accounts: accts,
    sinkingFunds: sinking,
    recurringRules: recurring,
  };
}
