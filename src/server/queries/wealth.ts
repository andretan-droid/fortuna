import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  accounts,
  fxRates,
  holdings,
  netWorthEntries,
  userSettings,
} from "@/db/schema";
import { bnplState } from "@/lib/bnpl";
import { monthKey, todayISO } from "@/lib/dates";
import { fetchBnplInputs } from "@/server/queries/debts";

/* Wealth read layer — net worth (manual account balances) + live portfolio
 * (holdings × price × FX). Kept separate from the ledger queries because this
 * side is live-price float math rounded to cents at the edge, NOT exact ledger
 * money. Net worth = (assets − liabilities) + portfolio; accounts and holdings
 * are distinct instruments in the legacy model, so they add (no double-count). */

export type AccountBalance = {
  id: string;
  name: string;
  kind: "Asset" | "Liability";
  sort: number;
  /** Latest recorded balance (positive for both kinds); null = never recorded. */
  balanceCents: number | null;
  /** 'YYYY-MM' the latest balance was recorded, or null. */
  asOfMonth: string | null;
};

export type HoldingValue = {
  id: string;
  ticker: string;
  name: string | null;
  ccy: string; // defaults 'MYR' when unset
  shares: number;
  /** Effective unit price used (manual override wins over live), holding ccy. */
  price: number;
  fxToMyr: number; // 1 for MYR; rateLive ?? fallback otherwise
  marketValueCents: number; // shares × price × fx → MYR cents
  dayChgPct: number | null;
};

export type WealthSummary = {
  accounts: AccountBalance[];
  assetsCents: number; // Σ latest asset balances
  liabilitiesCents: number; // Σ latest liability balances (stored positive)
  accountsNetCents: number; // (assets − account liabilities − BNPL outstanding)
  bnplOutstandingCents: number; // Σ active-plan outstanding, folded into liabilities
  holdings: HoldingValue[];
  portfolioValueCents: number; // Σ live holding market values (MYR)
  netWorthCents: number; // accountsNetCents + portfolioValueCents
  pricesUpdatedAt: string | null; // ISO, from userSettings
};

/** Everything the wealth-card / account-cards / holdings-table render. */
export async function getWealthSummary(userId: string): Promise<WealthSummary> {
  const db = getDb();

  const [acctRows, nweRows, holdingRows, fxRows, settingsRows, bnplInputs] = await Promise.all([
    db
      .select()
      .from(accounts)
      .where(and(eq(accounts.userId, userId), eq(accounts.active, true)))
      .orderBy(asc(accounts.sort), asc(accounts.name)),
    // Sparse monthly history; small by nature (accounts × months tracked).
    // ponytail: pull all + reduce to latest-per-account in JS. Ceiling: if this
    // grows large, switch to `distinct on (account_id) ... order by month desc`.
    db
      .select({
        accountId: netWorthEntries.accountId,
        month: netWorthEntries.month,
        balanceCents: netWorthEntries.balanceCents,
      })
      .from(netWorthEntries)
      .where(eq(netWorthEntries.userId, userId))
      .orderBy(asc(netWorthEntries.accountId), asc(netWorthEntries.month)),
    db.select().from(holdings).where(eq(holdings.userId, userId)).orderBy(asc(holdings.ticker)),
    db.select().from(fxRates).where(eq(fxRates.userId, userId)),
    db.select({ pricesUpdatedAt: userSettings.pricesUpdatedAt }).from(userSettings).where(eq(userSettings.userId, userId)),
    fetchBnplInputs(db, userId),
  ]);

  // asc(month) → the last write for each account wins = its latest balance.
  const latest = new Map<string, { month: string; balanceCents: number }>();
  for (const e of nweRows) latest.set(e.accountId, { month: e.month, balanceCents: e.balanceCents });

  const accountBalances: AccountBalance[] = acctRows.map((a) => {
    const l = latest.get(a.id);
    return {
      id: a.id,
      name: a.name,
      kind: a.kind,
      sort: a.sort,
      balanceCents: l?.balanceCents ?? null,
      asOfMonth: l?.month ?? null,
    };
  });

  let assetsCents = 0;
  let liabilitiesCents = 0;
  for (const a of accountBalances) {
    if (a.balanceCents == null) continue;
    if (a.kind === "Asset") assetsCents += a.balanceCents;
    else liabilitiesCents += a.balanceCents;
  }
  // BNPL outstanding is a liability the account list doesn't capture (legacy
  // calc.js:259-260). Fold it in BEFORE netting so net worth drops by exactly it.
  const bnplOutstandingCents = bnplState(
    bnplInputs.plans,
    bnplInputs.txns,
    monthKey(todayISO()),
  ).totalOutstandingCents;
  liabilitiesCents += bnplOutstandingCents;
  const accountsNetCents = assetsCents - liabilitiesCents;

  // FX map: 'USDMYR' → rate. rateLive is authoritative; fallback until refreshed.
  const fxMap = new Map<string, number>();
  for (const f of fxRows) {
    const rate = num(f.rateLive) ?? num(f.fallback);
    if (rate != null) fxMap.set(f.pair, rate);
  }

  const holdingValues: HoldingValue[] = holdingRows.map((h) => {
    const ccy = h.ccy ?? "MYR";
    const shares = num(h.shares) ?? 0;
    const price = num(h.manualPriceOverride) ?? num(h.priceLive) ?? 0;
    const fxToMyr = ccy === "MYR" ? 1 : fxMap.get(`${ccy}MYR`) ?? 0;
    return {
      id: h.id,
      ticker: h.ticker,
      name: h.name,
      ccy,
      shares,
      price,
      fxToMyr,
      marketValueCents: Math.round(shares * price * fxToMyr * 100),
      dayChgPct: num(h.dayChgPct),
    };
  });

  const portfolioValueCents = holdingValues.reduce((n, h) => n + h.marketValueCents, 0);

  return {
    accounts: accountBalances,
    assetsCents,
    liabilitiesCents,
    accountsNetCents,
    bnplOutstandingCents,
    holdings: holdingValues,
    portfolioValueCents,
    netWorthCents: accountsNetCents + portfolioValueCents,
    pricesUpdatedAt: settingsRows[0]?.pricesUpdatedAt?.toISOString() ?? null,
  };
}

/** numeric() columns come back as string | null → number | null (null-safe). */
function num(v: string | null): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
