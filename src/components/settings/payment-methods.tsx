"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  createPaymentMethod,
  renamePaymentMethod,
  setPaymentMethodActive,
} from "@/server/actions/settings";
import type { PaymentMethodRow } from "@/server/queries/settings";
import { SettingsSection } from "./section";

/** Name-list manager: add, inline rename, archive/restore (RESTRICT FK →
 *  methods referenced by the ledger are never hard-deleted). */
export function PaymentMethods({ rows }: { rows: PaymentMethodRow[] }) {
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(okMsg);
      else toast.error(res.error ?? "Failed");
    });

  return (
    <SettingsSection title="Payment methods" description="Chips shown on every transaction.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          run(() => createPaymentMethod({ name: newName.trim() }), `"${newName.trim()}" added`);
          setNewName("");
        }}
        className="mb-3 flex gap-2"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. TnG, Maybank, Cash"
          autoComplete="off"
        />
        <Button type="submit" disabled={pending || !newName.trim()}>
          Add
        </Button>
      </form>

      <div className="divide-y rounded-lg border">
        {rows.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No payment methods yet.
          </p>
        )}
        {rows.map((m) => (
          <div
            key={m.id}
            className={cn("flex items-center gap-2 px-4 py-2.5", !m.active && "opacity-50")}
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
                <Button type="button" size="sm" variant="ghost" onClick={() => setEditingId(null)}>
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
    </SettingsSection>
  );
}
