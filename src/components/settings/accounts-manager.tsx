"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { createAccount, setAccountActive, updateAccount } from "@/server/actions/settings";
import type { AccountRow } from "@/server/queries/settings";
import { SettingsSection } from "./section";

const KINDS = ["Asset", "Liability"] as const;

function KindSelect({
  value,
  onChange,
  id,
}: {
  value: "Asset" | "Liability";
  onChange: (v: "Asset" | "Liability") => void;
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as "Asset" | "Liability")}
      className="border-input bg-transparent h-9 rounded-md border px-3 text-sm shadow-xs outline-none"
    >
      {KINDS.map((k) => (
        <option key={k} value={k}>
          {k}
        </option>
      ))}
    </select>
  );
}

/** Net-worth accounts (Asset/Liability). Order via `sort`; archive over delete. */
export function AccountsManager({ rows }: { rows: AccountRow[] }) {
  const [pending, startTransition] = useTransition();
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<"Asset" | "Liability">("Asset");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editKind, setEditKind] = useState<"Asset" | "Liability">("Asset");

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, okMsg: string) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(okMsg);
      else toast.error(res.error ?? "Failed");
    });

  return (
    <SettingsSection
      title="Accounts"
      description="Asset and liability accounts tracked in the monthly net-worth grid."
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!newName.trim()) return;
          run(
            () => createAccount({ name: newName.trim(), kind: newKind, sort: rows.length }),
            `"${newName.trim()}" added`,
          );
          setNewName("");
        }}
        className="mb-3 flex gap-2"
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="e.g. Maybank Savings, ASB, PTPTN"
          autoComplete="off"
        />
        <KindSelect value={newKind} onChange={setNewKind} />
        <Button type="submit" disabled={pending || !newName.trim()}>
          Add
        </Button>
      </form>

      <div className="divide-y rounded-lg border">
        {rows.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">No accounts yet.</p>
        )}
        {rows.map((a) => (
          <div
            key={a.id}
            className={cn("flex items-center gap-2 px-4 py-2.5", !a.active && "opacity-50")}
          >
            {editingId === a.id ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  run(
                    () =>
                      updateAccount(a.id, { name: editName.trim(), kind: editKind, sort: a.sort }),
                    "Saved",
                  );
                  setEditingId(null);
                }}
                className="flex flex-1 flex-wrap gap-2"
              >
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  autoFocus
                  className="h-8 flex-1"
                />
                <KindSelect value={editKind} onChange={setEditKind} />
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
                    setEditingId(a.id);
                    setEditName(a.name);
                    setEditKind(a.kind);
                  }}
                >
                  {a.name}
                </button>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs",
                    a.kind === "Asset" ? "text-primary" : "text-destructive",
                  )}
                >
                  {a.kind}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  className="text-muted-foreground"
                  onClick={() =>
                    run(
                      () => setAccountActive(a.id, !a.active),
                      a.active ? `"${a.name}" archived` : `"${a.name}" restored`,
                    )
                  }
                >
                  {a.active ? "Archive" : "Restore"}
                </Button>
              </>
            )}
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
