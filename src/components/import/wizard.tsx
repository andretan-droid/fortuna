"use client";

import { useRef, useState, useTransition } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  previewImport,
  commitImport,
  type PreviewResult,
  type CommitResult,
} from "@/server/actions/import";

/** Import wizard: upload → preview (auto-mapped via the template spec) → commit.
 *  All parsing/validation is server-side (actions/import → lib/legacy-import);
 *  this only orchestrates the file and renders results. ponytail: one component
 *  instead of the plan's five step-files — the flow is small enough. */
export function ImportWizard() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Extract<PreviewResult, { ok: true }> | null>(null);
  const [result, setResult] = useState<Extract<CommitResult, { ok: true }> | null>(null);
  const [replace, setReplace] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function reset() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setReplace(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  function analyze(f: File) {
    const fd = new FormData();
    fd.append("file", f);
    startTransition(async () => {
      const res = await previewImport(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setPreview(res);
    });
  }

  function commit() {
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("replace", replace ? "1" : "0");
    startTransition(async () => {
      const res = await commitImport(fd);
      if (!res.ok) {
        toast.error(res.errors[0] ?? "Import failed");
        return;
      }
      setResult(res);
      toast.success("Import complete");
    });
  }

  // ── Done ──────────────────────────────────────────────────────────────────
  if (result) {
    const total = Object.values(result.counts).reduce((n, c) => n + c, 0);
    return (
      <Card>
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <CheckCircle2 className="size-10 text-income" />
          <h2 className="font-display text-2xl">Imported {total.toLocaleString()} rows</h2>
          <p className="text-sm text-muted-foreground">Your data is live across the app.</p>
          <div className="mt-2 flex gap-2">
            <Button asChild>
              <a href="/dashboard">Go to dashboard</a>
            </Button>
            <Button variant="outline" onClick={reset}>
              Import another
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // ── Preview ───────────────────────────────────────────────────────────────
  if (preview) {
    const rows = Object.entries(preview.counts);
    const blocked = preview.errors.length > 0 || (preview.hasExistingData && !replace);
    return (
      <Card>
        <div className="space-y-5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="size-5 text-brand" />
            <span className="text-sm text-muted-foreground">{file?.name}</span>
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No recognised sheets found in this file.</p>
          ) : (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {rows.map(([sheet, count]) => (
                <li key={sheet} className="flex items-center justify-between px-4 py-2.5 text-sm">
                  <span>{sheet}</span>
                  <span className="tabular text-muted-foreground">{count.toLocaleString()} rows</span>
                </li>
              ))}
            </ul>
          )}

          {preview.errors.length > 0 && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-destructive">
                <AlertTriangle className="size-4" />
                {preview.errors.length} issue{preview.errors.length > 1 ? "s" : ""} — fix and re-upload
              </div>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                {preview.errors.slice(0, 50).map((e, i) => (
                  <li key={i}>• {e}</li>
                ))}
                {preview.errors.length > 50 && <li>…and {preview.errors.length - 50} more</li>}
              </ul>
            </div>
          )}

          {preview.hasExistingData && preview.errors.length === 0 && (
            <label className="flex items-start gap-2.5 rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium text-warning">You already have data.</span> Importing
                replaces <strong>all</strong> of it. Tick to confirm you want to wipe and re-import.
              </span>
            </label>
          )}

          <div className="flex gap-2">
            <Button onClick={commit} disabled={blocked || pending}>
              {pending ? "Importing…" : replace ? "Replace all & import" : "Import"}
            </Button>
            <Button variant="ghost" onClick={reset} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  return (
    <Card>
      <div className="space-y-5">
        <div>
          <a
            href="/templates/fortuna-import.xlsx"
            download
            className="interactive inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-accent"
          >
            <Download className="size-4" />
            Download the import template
          </a>
          <p className="mt-2 text-xs text-muted-foreground">
            Fill the template (or export your existing sheet with the same tab/column names), then
            upload it below.
          </p>
        </div>

        <label className="interactive flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-input px-6 py-10 text-center hover:bg-accent">
          <Upload className="size-7 text-muted-foreground" />
          <span className="text-sm">
            {file ? file.name : "Choose an .xlsx or .csv file"}
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f) analyze(f);
            }}
          />
        </label>

        {pending && <p className="text-sm text-muted-foreground">Analysing…</p>}
      </div>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-6 shadow-[var(--shadow-paper)]">
      {children}
    </section>
  );
}
