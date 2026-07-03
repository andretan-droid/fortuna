import { Panel } from "./panel";
import { BalanceEditor } from "./balance-editor";
import { formatCents } from "@/lib/money";
import type { AccountBalance } from "@/server/queries/wealth";

/** Per-account latest balance with inline edit. Assets then liabilities; an
 *  account with no recorded balance shows "Not set" and a Set-balance action. */
export function AccountCards({ accounts }: { accounts: AccountBalance[] }) {
  if (!accounts.length) return null;
  const assets = accounts.filter((a) => a.kind === "Asset");
  const liabilities = accounts.filter((a) => a.kind === "Liability");

  return (
    <Panel title="Accounts">
      <div className="space-y-5">
        {assets.length > 0 && <Group heading="Assets" rows={assets} />}
        {liabilities.length > 0 && <Group heading="Liabilities" rows={liabilities} />}
      </div>
    </Panel>
  );
}

function Group({ heading, rows }: { heading: string; rows: AccountBalance[] }) {
  return (
    <div>
      <p className="mb-1.5 text-xs uppercase tracking-[0.16em] text-muted-foreground">{heading}</p>
      <ul className="divide-y divide-border">
        {rows.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-4 py-2.5">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{a.name}</p>
              <p className="text-xs text-muted-foreground">
                {a.balanceCents != null
                  ? `${formatCents(a.balanceCents)}${a.asOfMonth ? ` · ${a.asOfMonth}` : ""}`
                  : "Not set"}
              </p>
            </div>
            <BalanceEditor accountId={a.id} balanceCents={a.balanceCents} />
          </li>
        ))}
      </ul>
    </div>
  );
}
