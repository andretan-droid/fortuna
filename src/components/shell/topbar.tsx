"use client";

import { Command, Search } from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { openCommandMenu } from "@/lib/command";

/** Sticky frosted header. The ⌘K trigger is a static affordance here; it is
 *  wired to the command palette in Phase 3. */
export function Topbar() {
  return (
    <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border px-5 lg:px-8">
      <div className="flex items-center gap-3">
        <span className="font-display text-xl lg:hidden">Fortuna</span>
        <button
          type="button"
          onClick={openCommandMenu}
          className="interactive hidden h-9 items-center gap-2 rounded-md border border-border bg-card/50 pl-3 pr-2 text-sm text-muted-foreground hover:text-foreground lg:flex"
        >
          <Search className="size-4" />
          <span>Search or jump to…</span>
          <kbd className="ml-6 flex items-center gap-0.5 rounded border border-border px-1.5 py-0.5 text-[10px]">
            <Command className="size-3" />K
          </kbd>
        </button>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          aria-label="Search"
          onClick={openCommandMenu}
          className="interactive grid size-9 place-items-center rounded-md border border-border text-muted-foreground hover:text-foreground lg:hidden"
        >
          <Search className="size-4" strokeWidth={1.75} />
        </button>
        <ThemeToggle />
      </div>
    </header>
  );
}
