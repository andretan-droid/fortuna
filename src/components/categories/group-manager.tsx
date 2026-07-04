"use client";

import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { renameMainCategory } from "@/server/actions/categories";
import type { CategoryRow } from "@/server/queries/categories";

/** Rename or ungroup main-category groups. Groups are derived from the existing
 *  categories (no dedicated table) — renaming here rewrites every category filed
 *  under a group in one action. Controlled dialog (matches the category editor). */
export function GroupManager({ rows }: { rows: CategoryRow[] }) {
  const [open, setOpen] = useState(false);

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (!r.mainCategory) continue;
      counts.set(r.mainCategory, (counts.get(r.mainCategory) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Manage groups
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">Main-category groups</DialogTitle>
            <DialogDescription>
              Renaming a group updates every category filed under it. Clearing the
              name ungroups them.
            </DialogDescription>
          </DialogHeader>

          {groups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No groups yet — assign a main category when editing a category.
            </p>
          ) : (
            <ul className="space-y-3">
              {groups.map((g) => (
                <GroupRow key={g.name} name={g.name} count={g.count} />
              ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function GroupRow({ name, count }: { name: string; count: number }) {
  const [value, setValue] = useState(name);
  const [pending, startTransition] = useTransition();
  const dirty = value.trim() !== name;

  function save() {
    startTransition(async () => {
      const res = await renameMainCategory(name, value);
      if (res.ok) toast.success(value.trim() ? `Group renamed to "${value.trim()}"` : "Group cleared");
      else toast.error(res.error);
    });
  }

  return (
    <li className="flex items-end gap-2">
      <div className="min-w-0 flex-1 space-y-1">
        <Input value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" />
        <p className="text-xs text-muted-foreground">
          {count} categor{count === 1 ? "y" : "ies"}
        </p>
      </div>
      <Button type="button" size="sm" variant="ghost" disabled={pending || !dirty} onClick={save}>
        {pending ? "Saving…" : "Save"}
      </Button>
    </li>
  );
}
