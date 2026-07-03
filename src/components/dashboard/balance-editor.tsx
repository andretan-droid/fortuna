"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatAmount, toCents } from "@/lib/money";
import { saveAccountBalance } from "@/server/actions/settings";

/** Inline editor for an account's current-month balance. Writes a net-worth
 *  entry for this month (upsert), so the account card + net worth update. */
export function BalanceEditor({
  accountId,
  balanceCents,
}: {
  accountId: string;
  balanceCents: number | null;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(balanceCents != null ? formatAmount(balanceCents) : "");
  const [pending, startTransition] = useTransition();

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        {balanceCents != null ? "Edit" : "Set balance"}
      </button>
    );
  }

  function submit() {
    const cents = toCents(value);
    if (cents == null) {
      toast.error("Enter a valid amount");
      return;
    }
    startTransition(async () => {
      const res = await saveAccountBalance({ accountId, balanceCents: cents });
      if (res.ok) {
        toast.success("Balance updated");
        setEditing(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="0.00"
        inputMode="decimal"
        autoFocus
        className="h-8 w-28 text-right"
      />
      <Button size="sm" onClick={submit} disabled={pending}>
        {pending ? "…" : "Save"}
      </Button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Cancel
      </button>
    </div>
  );
}
