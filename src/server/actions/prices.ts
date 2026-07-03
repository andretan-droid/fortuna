"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db/client";
import { fxRates, holdings, userSettings } from "@/db/schema";
import { requireUserId } from "@/server/auth-helpers";
import type { ActionResult } from "@/server/actions/transactions";

/* Live price refresh (dashboard Refresh button). The external feed contract is
 * not fixed yet, so we accept a deliberately loose JSON shape and skip anything
 * we can't read — this action must DEGRADE, never throw (V10 fault-tolerance).
 *
 * ponytail: assumed shape is { prices: {TICKER: number | {price, dayChangePct}},
 * fx: {PAIR: number} } with a Bearer token. Swap the parse/auth here once the
 * real feed contract is known — nothing else depends on the shape. */
type FeedQuote = { price?: number; dayChangePct?: number };
type FeedShape = {
  prices?: Record<string, number | FeedQuote>;
  fx?: Record<string, number>;
};

export async function refreshPrices(): Promise<ActionResult> {
  const userId = await requireUserId();
  const db = getDb();

  const [settings] = await db
    .select({ url: userSettings.priceFeedUrl, token: userSettings.priceFeedToken })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  if (!settings?.url) return { ok: false, error: "Set a price feed URL in Settings first" };

  let data: FeedShape;
  try {
    const res = await fetch(settings.url, {
      headers: settings.token ? { Authorization: `Bearer ${settings.token}` } : {},
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: `Feed returned ${res.status}` };
    data = (await res.json()) as FeedShape;
  } catch {
    return { ok: false, error: "Could not reach the price feed" };
  }

  const prices = data.prices ?? {};
  const fx = data.fx ?? {};
  const now = new Date();
  const writes: BatchItem<"pg">[] = [];

  // Update only holdings the feed knows about; leave the rest untouched.
  const held = await db
    .select({ id: holdings.id, ticker: holdings.ticker })
    .from(holdings)
    .where(eq(holdings.userId, userId));
  for (const h of held) {
    const q = prices[h.ticker] ?? prices[h.ticker.toUpperCase()];
    if (q == null) continue;
    const price = typeof q === "number" ? q : q.price;
    const chg = typeof q === "number" ? undefined : q.dayChangePct;
    if (price == null || !Number.isFinite(price)) continue;
    writes.push(
      db
        .update(holdings)
        .set({
          priceLive: String(price),
          dayChgPct: chg != null && Number.isFinite(chg) ? String(chg) : undefined,
          priceUpdatedAt: now,
        })
        .where(and(eq(holdings.id, h.id), eq(holdings.userId, userId))),
    );
  }

  for (const [pair, rate] of Object.entries(fx)) {
    if (typeof rate !== "number" || !Number.isFinite(rate)) continue;
    writes.push(
      db
        .update(fxRates)
        .set({ rateLive: String(rate) })
        .where(and(eq(fxRates.userId, userId), eq(fxRates.pair, pair))),
    );
  }

  // Stamp the refresh time regardless, so the UI can show "prices as of …".
  writes.push(
    db.update(userSettings).set({ pricesUpdatedAt: now }).where(eq(userSettings.userId, userId)),
  );

  await db.batch(writes as [BatchItem<"pg">, ...BatchItem<"pg">[]]);
  revalidatePath("/dashboard");
  return { ok: true, id: userId };
}
