"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { PAYMENT_METHOD_KINDS } from "@/db/schema";
import {
  createPaymentMethod,
  renamePaymentMethod,
  setPaymentMethodActive,
  setPaymentMethodKind,
} from "@/server/actions/settings";
import type { PaymentMethodRow } from "@/server/queries/settings";
import { SettingsSection } from "./section";

type Kind = (typeof PAYMENT_METHOD_KINDS)[number];

/** Native kind picker — same pattern as accounts-manager's KindSelect. */
function KindSelect({
  value,
  onChange,
  id,
  className,
}: {
  value: Kind;
  onChange: (v: Kind) => void;
  id?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      aria-label="Payment method type"
      value={value}
      onChange={(e) => onChange(e.target.value as Kind)}
      className={cn(
        "border-input bg-transparent h-8 rounded-md border px-2 text-sm shadow-xs outline-none",
        className,
      )}
    >
      {PAYMENT_METHOD_KINDS.map((k) => (
        <option key={k} value={k}>
          {k}
        </option>
      ))}
    </select>
  );
}

/** Manager: add (with kind), inline rename, kind change, archive/restore. Rows
 *  grouped by kind so HSBC sits under Credit card, Atome under BNPL, etc.
 *  (RESTRICT FK → methods referenced by the ledger are archived, never deleted.) */
export function PaymentMethods({ rows }: { rows: PaymentMethodRow[] }) {
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<Kind>("Other");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(okMsg);
      else toast.error(res.error ?? "Failed");
    });

  // Group by kind, in the canonical kind order; skip empty groups.
  const groups = useMemo(() => {
    const byKind = new Map<Kind, PaymentMethodRow[]>();
    for (const m of rows) {
      const list = byKind.get(m.kind) ?? [];
      list.push(m);
      byKind.set(m.kind, list);
    }
    return PAYMENT_METHOD_KINDS.filter((k) => byKind.has(k)).map((k) => ({
      kind: k,
      rows: byKind.get(k)!,
    }));
  }, [rows]);

  return (
    <SettingsSection
      title="Payment methods"
      description="Categorised (bank, credit card, e-wallet, BNPL…) and shown on every transaction."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          run(
            () => createPaymentMethod({ name: newName.trim(), kind: newKind }),
            `"${newName.trim()}" added`,
          );
          setNewName("");
          setNewKind("Other");
        }}
        className="mb-3 flex gap-2"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. HSBC, Maybank, Atome"
          autoComplete="off"
        />
        <KindSelect value={newKind} onChange={setNewKind} />
        <Button type="submit" disabled={pending || !newName.trim()}>
          Add
        </Button>
      </form>

      {rows.length === 0 ? (
        <div className="rounded-lg border">
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No payment methods yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => (
            <div key={g.kind}>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                {g.kind}
              </p>
              <div className="divide-y rounded-lg border">
                {g.rows.map((m) => (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5",
                      !m.active && "opacity-50",
                    )}
                  >
                    {editingId === m.id ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          run(() => renamePaymentMethod(m.id, { name: editName.trim() }), "Renamed");
                          setEditingId(null);
                        }}
                        className="flex flex-1 gap-2"
                      >
                        <Input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          autoFocus
                          className="h-8"
                        />
                        <Button type="submit" size="sm" disabled={pending}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          Cancel
                        </Button>
                      </form>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="flex-1 truncate text-left text-sm underline-offset-4 hover:underline"
                          onClick={() => {
                            setEditingId(m.id);
                            setEditName(m.name);
                          }}
                        >
                          {m.name}
                        </button>
                        <KindSelect
                          value={m.kind}
                          onChange={(k) =>
                            run(() => setPaymentMethodKind(m.id, k), `"${m.name}" set to ${k}`)
                          }
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={pending}
                          className="text-muted-foreground"
                          onClick={() =>
                            run(
                              () => setPaymentMethodActive(m.id, !m.active),
                              m.active ? `"${m.name}" archived` : `"${m.name}" restored`,
                            )
                          }
                        >
                          {m.active ? "Archive" : "Restore"}
                        </Button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SettingsSection>
  );
}
