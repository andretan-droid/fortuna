/** Deterministic display colors — BNPL provider, payment-method kind, and
 *  category framework — mapped onto the existing chart/income palette
 *  (globals.css --chart-1..5 and --income) so a brand-new provider name never
 *  needs a manual color assignment. Single source of truth for every chip in
 *  the app. The palette is already dark-mode-aware (globals.css redefines
 *  --chart-N under .dark), so these tailwind classes need no separate dark:
 *  variants.
 *  Self-check: scripts/verify-colors.ts. */

export type Tone = { bg: string; text: string };

const CHART_TONES: Tone[] = [
  { bg: "bg-chart-1/15", text: "text-chart-1" },
  { bg: "bg-chart-2/15", text: "text-chart-2" },
  { bg: "bg-chart-3/15", text: "text-chart-3" },
  { bg: "bg-chart-4/15", text: "text-chart-4" },
  { bg: "bg-chart-5/15", text: "text-chart-5" },
];

const MUTED_TONE: Tone = { bg: "bg-muted", text: "text-muted-foreground" };

/** Stable string → array-index hash (FNV-ish). Same key always picks the same
 *  tone, so an unrecognised provider/name still gets a consistent color. */
function hashPick<T>(key: string, arr: readonly T[]): T {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

const PROVIDER_TONES: Record<string, Tone> = {
  atome: CHART_TONES[2], // amber
  shopee: CHART_TONES[2], // orange-ish — shares the warm slot
  spaylater: CHART_TONES[2],
  grab: CHART_TONES[1], // green
  gpaylater: CHART_TONES[1],
};

/** BNPL platform → tone. Known providers get a curated color; anything else
 *  gets a deterministic pick so it's still consistent across renders. */
export function providerColor(platform: string | null | undefined): Tone {
  const key = (platform ?? "").trim().toLowerCase();
  if (!key) return MUTED_TONE;
  return PROVIDER_TONES[key] ?? hashPick(key, CHART_TONES);
}

const KIND_TONES: Record<string, Tone> = {
  "Bank account": CHART_TONES[0],
  "Credit card": CHART_TONES[4],
  "E-wallet": CHART_TONES[3],
  BNPL: CHART_TONES[2],
  Cash: CHART_TONES[1],
  Other: MUTED_TONE,
};

/** Payment-method kind → tone (the 6 PAYMENT_METHOD_KINDS in schema.ts). */
export function kindColor(kind: string): Tone {
  return KIND_TONES[kind] ?? MUTED_TONE;
}

const FRAMEWORK_TONES: Record<string, Tone> = {
  Needs: CHART_TONES[0],
  Wants: CHART_TONES[2],
  Savings: CHART_TONES[1],
  Income: { bg: "bg-income/15", text: "text-income" },
  Deduction: CHART_TONES[4],
  Transfer: MUTED_TONE,
};

/** Category framework (Needs/Wants/Savings/Income/Deduction/Transfer) → tone.
 *  No schema change for per-category colors — the framework already groups
 *  every category into one of these six buckets. */
export function frameworkColor(framework: string): Tone {
  return FRAMEWORK_TONES[framework] ?? MUTED_TONE;
}
