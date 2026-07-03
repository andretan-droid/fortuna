"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { getDb } from "@/db/client";
import { fxRates, holdings, userSettings } from "@/db/schema";
import { requireUserId } from "@/server/auth-helpers";
import type { ActionResult } from "@/server/actions/transactions";

/* Live price refresh (dashboard Refresh button). Talks to the v5 Apps Script
 * backend: GET <url>?action=bootstrap&token=<token>. That endpoint returns
 * { ok, data:{ holdings:[{ticker, price, day_chg_pct}], fx:[{pair, rate}] } }
 * with GOOGLEFINANCE-resolved live values. The token MUST be a query param —
 * Apps Script /exec 302-redirects to googleusercontent and fetch drops the
 * Authorization header across that cross-origin hop, so a Bearer header never
 * authenticates. This action must DEGRADE, never throw (V10 fault-tolerance). */
type FeedHolding = { ticker?: string; price?: number; day_chg_pct?: number };
type FeedFx = { pair?: string; rate?: number };
type FeedShape = {
  ok?: boolean;
  error?: string;
  data?: { holdings?: FeedHolding[]; fx?: FeedFx[] };
};

export async function refreshPrices(): Promise<ActionResult> {
  const userId = await requireUserId();
  const db = getDb();

  const [settings] = await db
    .select({ url: userSettings.priceFeedUrl, token: userSettings.priceFeedToken })
    .from(userSettings)
    .where(eq(userSettings.userId, userId));
  if (!settings?.url) return { ok: false, error: "Set a price feed URL in Settings first" };

  let feedUrl: string;
  try {
    const u = new URL(settings.url);
    u.searchParams.set("action", "bootstrap");
    if (settings.token) u.searchParams.set("token", settings.token);
    feedUrl = u.toString();
  } catch {
    return { ok: false, error: "Price feed URL is not valid" };
  }

  let data: FeedShape;
  try {
    const res = await fetch(feedUrl, { cache: "no-store" });
    if (!res.ok) return { ok: false, error: `Feed returned ${res.status}` };
    data = (await res.json()) as FeedShape;
  } catch {
    return { ok: false, error: "Could not reach the price feed" };
  }
  if (data.ok === false) {
    // e.g. bad/missing token → Apps Script answers { ok:false, error:'Unauthorized' }
    return { ok: false, error: data.error ?? "Price feed rejected the request" };
  }

  // Index the feed's holdings by upper-cased ticker for lookup.
  const quotes = new Map<string, FeedHolding>();
  for (const q of data.data?.holdings ?? []) {
    if (q.ticker) quotes.set(String(q.ticker).toUpperCase(), q);
  }
  const now = new Date();
  const writes: BatchItem<"pg">[] = [];

  // Update only holdings the feed knows about; leave the rest untouched.
  const held = await db
    .select({ id: holdings.id, ticker: holdings.ticker })
    .from(holdings)
    .where(eq(holdings.userId, userId));
  for (const h of held) {
    const q = quotes.get(h.ticker.toUpperCase());
    if (q == null) continue;
    const price = q.price;
    const chg = q.day_chg_pct;
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

  for (const f of data.data?.fx ?? []) {
    if (!f.pair || typeof f.rate !== "number" || !Number.isFinite(f.rate)) continue;
    writes.push(
      db
        .update(fxRates)
        .set({ rateLive: String(f.rate) })
        .where(and(eq(fxRates.userId, userId), eq(fxRates.pair, f.pair))),
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
