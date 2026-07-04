"use client";

import { useState, useTransition } from "react";
import { ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/dashboard/panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatCents, formatAmount, toCents } from "@/lib/money";
import { formatDayHeader, todayISO } from "@/lib/dates";
import { cn } from "@/lib/utils";
import {
  createReceivable,
  updateReceivable,
  deleteReceivable,
  logReceivablePayment,
} from "@/server/actions/receivables";
import type { ReceivableState, ReceivablesSummary } from "@/lib/receivables";

/** One outstanding IOU — person, what's left, lent date/note, repayment progress.
 *  Click to edit; "Log repayment" opens the partial-payment dialog. */
function IouRow({
  r,
  onEdit,
  onRepay,
}: {
  r: ReceivableState;
  onEdit: () => void;
  onRepay: () => void;
}) {
  const pct = r.amountCents > 0 ? Math.round((r.paidCents / r.amountCents) * 100) : 0;
  return (
    <li className={cn("py-4", r.settled && "opacity-60")}>
      <div className="flex items-baseline justify-between gap-4">
        <button type="button" onClick={onEdit} className="group min-w-0 text-left outline-none">
          <p className="truncate text-sm font-medium underline-offset-4 group-hover:underline">
            {r.person}
          </p>
          <p className="text-xs text-muted-foreground">
            Lent {formatDayHeader(r.date)}
            {r.note ? ` · ${r.note}` : ""}
            {r.paidCents > 0 && !r.settled ? ` · ${formatCents(r.paidCents)} repaid` : ""}
          </p>
        </button>
        <div className="shrink-0 text-right">
          <p className="tabular font-display text-lg leading-none">
            {formatCents(r.settled ? r.amountCents : r.outstandingCents)}
          </p>
          {!r.settled && (
            <button
              type="button"
              onClick={onRepay}
              className="mt-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
            >
              Log repayment
            </button>
          )}
        </div>
      </div>
      {!r.settled && r.paidCents > 0 && (
        <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-income" style={{ width: `${pct}%` }} />
        </div>
      )}
    </li>
  );
}

/** "Owed to me" — the asset-side mirror of the BNPL ladder. Outstanding IOUs on
 *  top; fully-repaid ones collapse into a "Settled" section. */
export function OwedToMe({ summary }: { summary: ReceivablesSummary }) {
  const [editing, setEditing] = useState<ReceivableState | "new" | null>(null);
  const [repaying, setRepaying] = useState<ReceivableState | null>(null);

  return (
    <Panel
      title="Owed to me"
      headerRight={
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> Add IOU
        </Button>
      }
    >
      {!summary.items.length ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nobody owes you money yet. Add an IOU to track what you&apos;re owed — it
          counts as an asset in your net worth.
        </p>
      ) : (
        <>
          {summary.totalOutstandingCents > 0 && (
            <div className="mb-3 border-b border-border pb-3">
              <p className="tabular font-display text-3xl leading-none text-income">
                {formatCents(summary.totalOutstandingCents)}
              </p>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Outstanding across {summary.outstanding.length} · counts as an asset in
                net worth
              </p>
            </div>
          )}
          {summary.outstanding.length > 0 ? (
            <ul className="divide-y divide-border">
              {summary.outstanding.map((r) => (
                <IouRow
                  key={r.id}
                  r={r}
                  onEdit={() => setEditing(r)}
                  onRepay={() => setRepaying(r)}
                />
              ))}
            </ul>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              All settled up. 🎉
            </p>
          )}

          {summary.settled.length > 0 && (
            <details className="group mt-5 border-t pt-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                  Settled ({summary.settledCount})
                </span>
              </summary>
              <ul className="mt-1 divide-y divide-border">
                {summary.settled.map((r) => (
                  <IouRow
                    key={r.id}
                    r={r}
                    onEdit={() => setEditing(r)}
                    onRepay={() => setRepaying(r)}
                  />
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <IouEditor
        key={editing === "new" ? "new" : (editing?.id ?? "closed")}
        iou={editing}
        onClose={() => setEditing(null)}
      />
      <RepaymentDialog
        key={repaying?.id ?? "no-repay"}
        iou={repaying}
        onClose={() => setRepaying(null)}
      />
    </Panel>
  );
}

/** Add / edit / delete an IOU. Same Dialog shape as the BNPL PlanEditor. */
function IouEditor({
  iou,
  onClose,
}: {
  iou: ReceivableState | "new" | null;
  onClose: () => void;
}) {
  const editing = iou !== null && iou !== "new" ? iou : null;
  const [pending, startTransition] = useTransition();
  const [person, setPerson] = useState(editing?.person ?? "");
  const [amount, setAmount] = useState(editing ? formatAmount(editing.amountCents) : "");
  const [date, setDate] = useState(editing?.date ?? todayISO());
  const [note, setNote] = useState(editing?.note ?? "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!person.trim()) return void toast.error("Who owes you?");
    const cents = toCents(amount);
    if (cents == null || cents < 0) return void toast.error("Enter a valid amount");
    const payload = { person: person.trim(), amountCents: cents, date, note: note.trim() || null };
    startTransition(async () => {
      const res = editing
        ? await updateReceivable(editing.id, payload)
        : await createReceivable(payload);
      if (res.ok) {
        toast.success(editing ? "IOU saved" : "IOU added");
        onClose();
      } else toast.error(res.error);
    });
  }

  function handleDelete() {
    if (!editing) return;
    startTransition(async () => {
      const res = await deleteReceivable(editing.id);
      if (res.ok) {
        toast.success(`"${editing.person}" removed`);
        onClose();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={iou !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">
            {editing ? "Edit IOU" : "New IOU"}
          </DialogTitle>
          <DialogDescription>
            Money someone owes you. Repayments are logged separately — outstanding is
            derived from them.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="iou-person">Person</Label>
            <Input
              id="iou-person"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              required
              autoComplete="off"
              placeholder="e.g. Aiman"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="iou-amount">Amount (RM)</Label>
              <Input
                id="iou-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iou-date">Date lent</Label>
              {/* ponytail: native date input over a picker lib */}
              <Input id="iou-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="iou-note">Note</Label>
            <Input
              id="iou-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              autoComplete="off"
              placeholder="Optional — what it was for"
            />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="lg" disabled={pending} className="flex-1">
              {pending ? "Saving…" : editing ? "Save changes" : "Add IOU"}
            </Button>
            {editing && (
              <Button
                type="button"
                size="lg"
                variant="ghost"
                disabled={pending}
                onClick={handleDelete}
                className="text-destructive hover:text-destructive"
              >
                Delete
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Log a (partial) repayment against one IOU. Amount pre-filled to what's left. */
function RepaymentDialog({
  iou,
  onClose,
}: {
  iou: ReceivableState | null;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState(iou ? formatAmount(iou.outstandingCents) : "");
  const [date, setDate] = useState(todayISO());

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!iou) return;
    const cents = toCents(amount);
    if (cents == null || cents <= 0) return void toast.error("Enter a repayment amount");
    startTransition(async () => {
      const res = await logReceivablePayment(iou.id, { amountCents: cents, date });
      if (res.ok) {
        toast.success("Repayment logged");
        onClose();
      } else toast.error(res.error);
    });
  }

  return (
    <Dialog open={iou !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">Log repayment</DialogTitle>
          <DialogDescription>
            {iou
              ? `${iou.person} · ${formatCents(iou.outstandingCents)} outstanding`
              : ""}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="rp-amount">Amount (RM)</Label>
              <Input
                id="rp-amount"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                inputMode="decimal"
                autoComplete="off"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rp-date">Date</Label>
              <Input id="rp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>
          <Button type="submit" size="lg" disabled={pending}>
            {pending ? "Saving…" : "Log repayment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
