"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { wipeAllData } from "@/server/actions/settings";

const PHRASE = "WIPE EVERYTHING";

/** Deletes every domain row for this user in one atomic batch. The typed
 *  phrase is re-checked server-side — the input is the confirmation. */
export function DangerZone() {
  const [confirmation, setConfirmation] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <section className="border-destructive/40 rounded-lg border p-5">
      <h2 className="font-display text-destructive text-xl">Danger zone</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">
        Permanently deletes all transactions, categories, accounts, and settings.
        Your sign-in survives; the data does not. There is no undo.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const res = await wipeAllData(confirmation);
            if (res.ok) {
              toast.success("All data wiped");
              setConfirmation("");
            } else toast.error(res.error);
          });
        }}
        className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
      >
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="dz-confirm">
            Type <span className="font-mono text-destructive">{PHRASE}</span> to confirm
          </Label>
          <Input
            id="dz-confirm"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            autoComplete="off"
          />
        </div>
        <Button
          type="submit"
          variant="destructive"
          disabled={pending || confirmation !== PHRASE}
        >
          {pending ? "Wiping…" : "Wipe all data"}
        </Button>
      </form>
    </section>
  );
}
